// 단어 사전: public/data/{ko,en}.txt 를 받아 인덱스를 만든다.
// ko 줄 형식: <단어><flag 1자><strict 0/1><hit 0-9>   en 줄 형식: <word><hit 0-9>
const B = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-';

export class Dict {
  constructor(lang, text) {
    this.lang = lang;
    this.words = new Map();
    this.byFirst = new Map();
    this.byLast = new Map();
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line) continue;
      let w, flag = 0, strict = 0, hit;
      if (lang === 'ko') {
        w = line.slice(0, -3);
        flag = B.indexOf(line[line.length - 3]);
        strict = line[line.length - 2] === '1' ? 1 : 0;
        hit = +line[line.length - 1];
      } else {
        w = line.slice(0, -1);
        hit = +line[line.length - 1];
      }
      const e = { w, flag, strict, hit };
      this.words.set(w, e);
      push(this.byFirst, w[0], e);
      push(this.byLast, w[w.length - 1], e);
    }
  }
  add(w, flag = 0, strict = 0, hit = 0) {
    const old = this.words.get(w);
    if (old) { old.flag = flag; old.strict = strict; return; }
    const e = { w, flag, strict, hit };
    this.words.set(w, e);
    push(this.byFirst, w[0], e);
    push(this.byLast, w[w.length - 1], e);
  }
  get(w) { return this.words.get(w); }
  get size() { return this.words.size; }
}
function push(map, k, e) {
  const a = map.get(k);
  if (a) a.push(e); else map.set(k, [e]);
}

// 사전의 기준은 DB(kkutu_private.words)다. 관리자가 올린 사전이 혼자 하기·멀티 모두에 쓰인다.
// 받은 사전은 브라우저(IndexedDB)에 버전과 함께 저장해 두고, DB 사전이 바뀌었을 때만 다시 받는다.
// DB 사전이 비어 있거나 DB 에 닿지 못하면 사이트에 들어 있는 기본 파일(public/data)로 대신한다.
const IDB = 'kkutu-dict';
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open(IDB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('d');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function idbGet(k) { try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('d').objectStore('d').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } }
async function idbSet(k, v) { try { const db = await idb(); await new Promise((res) => { const tx = db.transaction('d', 'readwrite'); tx.objectStore('d').put(v, k); tx.oncomplete = res; tx.onerror = res; }); } catch { /* ignore */ } }

async function fromDb(lang, supabase, onProgress) {
  const { data: info, error } = await supabase.rpc('kk_dict_info');
  if (error || !info || !info[lang] || !info[lang].count) return null; // 비어 있음
  const { version, count } = info[lang];
  const hit = await idbGet(lang);
  if (hit && hit.version === version) return hit.text;
  const parts = [];
  let after = '', got = 0;
  for (;;) {
    const { data, error: e } = await supabase.rpc('kk_dict_chunk', { p_lang: lang, p_after: after, p_limit: 40000 });
    if (e || !data || data.error) throw new Error('사전을 불러오지 못했어요');
    if (data.lines) { parts.push(data.lines); got += data.lines.split('\n').length; }
    onProgress && onProgress(Math.min(1, got / count));
    after = data.last;
    if (data.done) break;
  }
  const text = parts.join('\n');
  await idbSet(lang, { version, text });
  return text;
}

async function fromFile(lang, onProgress) {
  const res = await fetch(`${import.meta.env?.BASE_URL ?? './'}data/${lang}.txt`);
  if (!res.ok) throw new Error(`사전을 불러오지 못했어요 (${res.status})`);
  const total = +res.headers.get('content-length') || 0;
  if (res.body && total && onProgress) {
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      onProgress(Math.min(1, got / total));
    }
    return new TextDecoder('utf-8').decode(await new Blob(chunks).arrayBuffer());
  }
  return res.text();
}

const cache = new Map();
export function loadDict(lang, onProgress, supabase) {
  if (cache.has(lang)) return cache.get(lang);
  const p = (async () => {
    let text = null;
    if (supabase) { try { text = await fromDb(lang, supabase, onProgress); } catch { text = null; } }
    if (text == null) text = await fromFile(lang, onProgress);
    await new Promise((r) => setTimeout(r, 0)); // 화면 갱신 기회
    return new Dict(lang, text);
  })();
  p.catch(() => cache.delete(lang));
  cache.set(lang, p);
  return p;
}
