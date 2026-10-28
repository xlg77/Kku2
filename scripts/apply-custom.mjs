// words/custom.tsv (관리자가 저장소에 push 하는 추가 단어) → public/data/custom.json
// 열: 단어 \t 언어(ko|en, 비우면 자동) \t 외래어(0/1) \t 어인정(0/1) \t 표준(0/1, 비우면 ko=1)
// 첫 줄이 "단어" 로 시작하면 헤더로 보고 건너뜁니다. # 로 시작하는 줄은 주석.
import fs from 'node:fs';

const src = process.argv[2] || 'words/custom.tsv';
const out = process.argv[3] || 'public/data/custom.json';
const res = { ko: [], en: [] };
const skipped = [];
if (fs.existsSync(src)) {
  const lines = fs.readFileSync(src, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    if (!raw.trim() || raw.startsWith('#')) return;
    const c = raw.split('\t').map((x) => x.trim());
    if (i === 0 && c[0] === '단어') return;
    const w = c[0];
    let lang = (c[1] || '').toLowerCase();
    if (!lang) lang = /^[가-힣]{2,}$/.test(w) ? 'ko' : /^[a-z]{2,}$/i.test(w) ? 'en' : '';
    if (lang === 'ko' && /^[가-힣]{2,}$/.test(w)) {
      res.ko.push({ w, loan: c[2] === '1' ? 1 : 0, inj: c[3] === '1' ? 1 : 0, strict: c[4] === '0' ? 0 : 1 });
    } else if (lang === 'en' && /^[a-z]{2,}$/i.test(w)) {
      res.en.push({ w: w.toLowerCase() });
    } else skipped.push(`${i + 1}행: ${JSON.stringify(raw)}`);
  });
}
fs.mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res));
console.log(`custom words: ko ${res.ko.length}, en ${res.en.length}` + (skipped.length ? `\n건너뜀(형식 오류):\n  ${skipped.join('\n  ')}` : ''));
