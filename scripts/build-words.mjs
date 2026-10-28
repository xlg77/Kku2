// db.sql(원본 끄투 단어 DB 덤프)에서 정적 사전 파일을 뽑아내는 스크립트
// 사용법: node scripts/build-words.mjs <db.sql 경로> [출력 디렉터리]
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const out = process.argv[3] || 'public/data';
if (!src) { console.error('usage: node scripts/build-words.mjs <db.sql> [outDir]'); process.exit(1); }

const KOR_GROUP = /(,|^)(0|1|3|7|8|11|9|16|15|17|2|18|20|26|19|INJEONG)(,|$)/;
const ENG_ID = /^[a-z]+$/i;
const lines = fs.readFileSync(src, 'utf8').split('\n');

function section(name) {
  const start = lines.findIndex((l) => l.startsWith(`COPY ${name} `));
  if (start < 0) throw new Error('no table ' + name);
  const rows = [];
  for (let i = start + 1; lines[i] !== '\\.'; i++) rows.push(lines[i].split('\t'));
  return rows;
}
// 원본 hit(사용 횟수)를 0~9 로그 구간으로 압축 (봇 난이도의 "자주 쓰는 단어" 판단용)
const hitDigit = (h) => { h = +h || 0; return h <= 0 ? 0 : Math.min(9, Math.round(Math.log2(h + 1))); };

// 한국어: word \t flagCode \t isStrict(1/0) \t hit(0-9)   → 한 줄 "단어|F|H" 로 압축
// F = flag(0~63) 를 한 글자(base64류)로, strict 여부는 type 에 '1' 또는 INJEONG 포함 && flag<4
const B = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-';
const ko = [];
for (const r of section('kkutu_ko')) {
  const [id, type, , hit, flag] = r;
  if (!id || !KOR_GROUP.test(type)) continue;
  if (/[^가-힣]/.test(id) || id.length < 2) continue; // 한글 완성형만, 2글자 이상
  const f = (+flag || 0) & 63;
  const strict = /(^|,)(1|INJEONG)($|,)/.test(type) && f < 4 ? 1 : 0;
  ko.push(`${id}${B[f]}${strict}${hitDigit(hit)}`);
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'ko.txt'), ko.join('\n'));

const en = [];
for (const r of section('kkutu_en')) {
  const [id, , , hit] = r;
  if (!ENG_ID.test(id) || id.length < 2) continue;
  en.push(`${id.toLowerCase()}${hitDigit(hit)}`);
}
fs.writeFileSync(path.join(out, 'en.txt'), [...new Set(en)].join('\n'));
console.log('ko', ko.length, 'en', en.length);
