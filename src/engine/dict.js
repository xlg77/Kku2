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

const cache = new Map();
export function loadDict(lang, onProgress, fetchExtra) {
  if (cache.has(lang)) return cache.get(lang);
  const p = (async () => {
    const res = await fetch(`${import.meta.env?.BASE_URL ?? "./"}data/${lang}.txt`);
    if (!res.ok) throw new Error(`사전을 불러오지 못했어요 (${res.status})`);
    const total = +res.headers.get('content-length') || 0;
    let text;
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
      text = new TextDecoder('utf-8').decode(await new Blob(chunks).arrayBuffer());
    } else {
      text = await res.text();
    }
    await new Promise((r) => setTimeout(r, 0)); // 화면 갱신 기회
    const dict = new Dict(lang, text);
    try { // 관리자가 DB 에 올린 추가 단어 (실패해도 기본 사전으로 진행)
      for (const x of (fetchExtra ? await fetchExtra() : [])) dict.add(x.word, (x.loanword ? 1 : 0) | (x.injeong ? 2 : 0), x.strict ? 1 : 0);
    } catch { /* ignore */ }
    return dict;
  })();
  p.catch(() => cache.delete(lang));
  cache.set(lang, p);
  return p;
}
