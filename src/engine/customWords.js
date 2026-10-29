// 관리자 단어 업로드 파싱: 한 줄에 하나. 탭/쉼표로 열을 나눌 수 있다.
// 열: 단어, 언어(ko|en, 비우면 자동), 외래어(0/1), 어인정(0/1), 표준(0/1, 비우면 1)
export function parseWords(text, defaultLang = '') {
  const rows = new Map();
  const skipped = [];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || raw.startsWith('#')) return;
    const c = raw.split(/\t|,/).map((x) => x.trim());
    if (i === 0 && c[0] === '단어') return;
    const word = c[0].toLowerCase() === c[0] ? c[0] : c[0].toLowerCase();
    let lang = (c[1] || '').toLowerCase() || defaultLang;
    if (!lang) lang = /^[가-힣]{2,}$/.test(word) ? 'ko' : /^[a-z]{2,}$/.test(word) ? 'en' : '';
    const ok = (lang === 'ko' && /^[가-힣]{2,}$/.test(word)) || (lang === 'en' && /^[a-z]{2,}$/.test(word));
    if (!ok) { skipped.push(`${i + 1}행: ${raw.slice(0, 40)}`); return; }
    rows.set(word, { word, lang, loanword: c[2] === '1', injeong: c[3] === '1', strict: c[4] !== '0' });
  });
  return { rows: [...rows.values()], skipped };
}
