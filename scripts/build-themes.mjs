// db.sql(원본 끄투 단어 DB 덤프)의 theme 열을 읽어, 단어별 주제 조각 파일(public/data/themes/*.txt)을 만든다.
// 사용법: node scripts/build-themes.mjs <db.sql 경로> [출력 디렉터리]
//
// 원본에 없는 주제(넷플릭스, 원신, 직업 …)는 scripts/theme-extra/*.txt 에 `@주제 이름` 줄 + 공백으로 나눈 단어들 (또는 `주제<TAB>단어`)로
// 적어 두면 함께 합쳐진다. (주제 이름은 src/engine/themes.js 의 THEME_NAMES 와 똑같이 써야 한다.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEME_NAMES, ORIGIN_CODES, themeId, themeShard, THEME_SHARDS } from '../src/engine/themes.js';

const src = process.argv[2];
const out = process.argv[3] || 'public/data/themes';
if (!src) { console.error('usage: node scripts/build-themes.mjs <db.sql> [outDir]'); process.exit(1); }

const lines = fs.readFileSync(src, 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith('COPY kkutu_ko '));
if (start < 0) throw new Error('no table kkutu_ko');
const cols = /\(([^)]*)\)/.exec(lines[start])[1].split(',').map((s) => s.trim());
const ci = { id: cols.indexOf('_id'), theme: cols.indexOf('theme') };
if (ci.id < 0 || ci.theme < 0) throw new Error('kkutu_ko 에 _id/theme 열이 없어요');

const words = new Map(); // 단어 → Set(주제 번호)
const unmapped = new Map();
const add = (w, id) => { let s = words.get(w); if (!s) words.set(w, (s = new Set())); s.add(id); };

for (let i = start + 1; lines[i] !== '\\.'; i++) {
  const r = lines[i].split('\t');
  const w = r[ci.id];
  if (!w || /[^가-힣]/.test(w) || w.length < 2) continue; // 게임에서 쓰는 한글 2글자 이상만
  for (const code of (r[ci.theme] || '').split(',')) {
    if (!code || code === '0' || code === '\\N') continue;
    const name = ORIGIN_CODES[code];
    if (name) add(w, themeId(name));
    else unmapped.set(code, (unmapped.get(code) || 0) + 1);
  }
}

// 직접 적어 둔 추가 주제 단어
const extraDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'theme-extra');
let extra = 0;
if (fs.existsSync(extraDir)) {
  for (const f of fs.readdirSync(extraDir).filter((x) => x.endsWith('.tsv') || x.endsWith('.txt'))) {
    let cur = null; // `@주제 이름` 줄 다음에 오는 줄들은 공백으로 나눈 단어들
    fs.readFileSync(path.join(extraDir, f), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, n) => {
      if (!raw.trim() || raw.startsWith('#')) return;
      const where = `${f} ${n + 1}행`;
      const put = (name, w) => {
        const id = themeId(name);
        if (id === undefined) throw new Error(`${where}: 알 수 없는 주제 "${name}"`);
        if (!/^[가-힣]{2,}$/.test(w || '')) throw new Error(`${where}: 단어는 한글 2글자 이상이어야 해요 "${w}"`);
        add(w, id); extra++;
      };
      if (raw.startsWith('@')) { cur = raw.slice(1).trim(); if (themeId(cur) === undefined) throw new Error(`${where}: 알 수 없는 주제 "${cur}"`); return; }
      if (raw.includes('\t')) { const [name, w] = raw.split('\t').map((x) => x.trim()); put(name, w); return; }
      if (cur === null) throw new Error(`${where}: 먼저 @주제 줄이 필요해요`);
      for (const w of raw.trim().split(/\s+/)) put(cur, w);
    });
  }
}

// 조각별로 모아 쓰기
const shards = Array.from({ length: THEME_SHARDS }, () => []);
const perTheme = new Array(THEME_NAMES.length).fill(0);
for (const [w, set] of words) {
  const ids = [...set].sort((a, b) => a - b);
  ids.forEach((id) => perTheme[id]++);
  shards[themeShard(w)].push(`${w}\t${ids.join(',')}`);
}
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^\d+\.txt$/.test(f)) fs.rmSync(path.join(out, f));
let files = 0, bytes = 0;
shards.forEach((rows, i) => {
  if (!rows.length) return;
  rows.sort();
  const text = rows.join('\n');
  fs.writeFileSync(path.join(out, `${i}.txt`), text);
  files++; bytes += Buffer.byteLength(text);
});

console.log(`주제가 붙은 단어 ${words.size}개 → 조각 ${files}개 (${(bytes / 1048576).toFixed(2)}MB), 직접 추가한 줄 ${extra}`);
console.log('주제별 단어 수:');
THEME_NAMES.forEach((n, i) => console.log(`  ${String(perTheme[i]).padStart(6)}  ${n}`));
if (unmapped.size) console.log('목록에 연결하지 않은 원본 코드:', [...unmapped].map(([c, n]) => `${c}(${n})`).join(' '));
