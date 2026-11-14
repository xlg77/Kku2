// 단어의 주제 이름 찾기. 단어 첫 글자로 정해진 작은 조각 파일(public/data/themes/N.txt)만 받아 와서 기억해 둔다.
import { themeShard, parseThemeShard, themeNames } from './themes.js';

const shards = new Map(); // 조각 번호 → Promise<Map<단어, 주제 번호[]>>

function loadShard(n) {
  let p = shards.get(n);
  if (!p) {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
    p = fetch(`${base}data/themes/${n}.txt`)
      .then((r) => (r.ok ? r.text() : ''))
      .then(parseThemeShard)
      .catch(() => { shards.delete(n); return new Map(); }); // 못 받으면 다음에 다시 시도
    shards.set(n, p);
  }
  return p;
}

/** 단어의 주제 이름들을 돌려준다. 주제가 없거나 파일을 못 받으면 빈 배열. */
export async function lookupThemes(word) {
  const n = themeShard(word);
  if (!word || n === 254) return []; // 한글이 아닌 단어(영어 등)는 주제가 없다
  const m = await loadShard(n);
  return themeNames(m.get(word));
}
