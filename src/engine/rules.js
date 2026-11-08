// 끄투 클래식 규칙 (원본 Server/lib/Game/games/classic.js, const.js 포팅)
import { koSubChar, initialStart } from './hangul.js';

export const MODES = {
  KSH: { lang: 'ko', name: '끝말잇기', desc: '앞 단어의 마지막 글자로 시작하는 단어를 이어요', opts: ['manner', 'mission', 'injeong', 'loanword', 'strict'] },
  KKT: { lang: 'ko', name: '쿵쿵따', desc: '세 글자 단어만! 리듬을 타며 이어가요', opts: ['manner', 'mission', 'injeong', 'loanword', 'strict'] },
  KAP: { lang: 'ko', name: '앞말잇기', desc: '앞 단어의 첫 글자로 끝나는 단어를 이어요', opts: ['manner', 'mission', 'injeong', 'loanword', 'strict'] },
  ESH: { lang: 'en', name: 'English 끝말잇기', desc: '마지막 알파벳으로 시작하는 영단어', opts: ['manner', 'mission'] },
  EKT: { lang: 'en', name: 'English 3글자', desc: '마지막 세 알파벳(또는 뒤 두 알파벳)으로 시작', opts: ['manner', 'mission'] },
};

export const OPT_LABELS = {
  manner: ['매너', '다음 단어가 없는 “한방 단어”는 금지'],
  mission: ['미션', '미션 글자를 넣으면 보너스 점수'],
  injeong: ['어인정', '어인정(비표준) 단어도 허용'],
  loanword: ['외래어 금지', '외래어는 사용할 수 없어요'],
  strict: ['엄격', '표준 국어대사전 표제어만 허용'],
};

export const BOT_LEVELS = ['하수', '초보', '중수', '고수', '신'];
export const ROBOT_START_DELAY = [1200, 800, 400, 200, 0];
export const ROBOT_TYPE_COEF = [1250, 750, 500, 250, 0];
export const ROBOT_THINK_COEF = [4, 2, 1, 0, 0];
export const ROBOT_HIT_LIMIT = [3, 2, 2, 1, 0]; // 원본 [8,4,2,1,0] 을 로그 구간으로 환산
export const ROBOT_LENGTH_LIMIT = [3, 4, 9, 99, 99];

export const MISSION_KO = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
export const MISSION_EN = 'abcdefghijklmnopqrstuvwxyz'.split('');

const FLAG = { LOANWORD: 1, INJEONG: 2 };

export const getPreScore = (text, chain, tr) =>
  2 * (Math.pow(5 + 7 * text.length, 0.74) + 0.88 * chain.length) * (0.5 + 0.5 * tr);
export const getPenalty = (chain, score) =>
  -1 * Math.round(Math.min(10 + chain.length * 2.1 + score * 0.15, score));
export function getTurnSpeed(rt) {
  const T = [5000, 11000, 18000, 26000, 35000, 45000, 56000, 68000, 81000, 95000];
  for (let i = 0; i < T.length; i++) if (rt < T[i]) return 10 - i;
  return 0;
}

export const getChar = (mode, text) =>
  mode === 'EKT' ? text.slice(-3) : mode === 'KAP' ? text[0] : text.slice(-1);
export function getSubChar(mode, char) {
  if (mode === 'EKT') return char.length > 2 ? char.slice(1) : undefined;
  if (mode === 'KSH' || mode === 'KKT' || mode === 'KAP') return koSubChar(char);
  return undefined;
}

export function isChainable(mode, text, char, sub, wordLength) {
  const l = char.length;
  if (!text || text.length <= l) return false;
  if (wordLength && text.length !== wordLength) return false;
  if (mode === 'KAP') return text.slice(-1) === char || text.slice(-1) === sub;
  switch (l) {
    case 1: return text[0] === char || text[0] === sub;
    case 2: return text.slice(0, 2) === char;
    case 3: return text.slice(0, 3) === char || text.slice(0, 2) === char.slice(1);
    default: return false;
  }
}

// 사전 항목이 옵션상 허용되는지 → 0 이면 OK, 아니면 오류 코드
export function entryDenied(e, opts) {
  if (!e) return 404;
  if (!opts.injeong && (e.flag & FLAG.INJEONG)) return 404;
  if (opts.strict && (!e.strict)) return 406;
  if (opts.loanword && (e.flag & FLAG.LOANWORD)) return 405;
  return 0;
}

// (char, sub) 로 이어질 수 있는 후보 단어들
export function candidates(dict, mode, char, sub, opts, { exclude, wordLength, limit } = {}) {
  const out = [];
  const lang = MODES[mode]?.lang || 'ko';
  let pools;
  if (mode === 'KAP') pools = [dict.byLast.get(char), sub && dict.byLast.get(sub)];
  else if (mode === 'EKT' && char.length === 3) pools = [dict.byFirst.get(char[0]), dict.byFirst.get(char[1])];
  else pools = [dict.byFirst.get(char[0]), sub && dict.byFirst.get(sub)];
  for (const pool of pools) {
    if (!pool) continue;
    for (const e of pool) {
      if (!isChainable(mode, e.w, char, sub, wordLength)) continue;
      if (lang === 'ko' && entryDenied(e, opts)) continue;
      if (exclude && exclude.has(e.w)) continue;
      out.push(e);
      if (limit && out.length >= limit) return out;
    }
  }
  return out;
}

export const hasNext = (dict, mode, char, opts, { exclude, wordLength } = {}) =>
  candidates(dict, mode, char, getSubChar(mode, char), opts, { exclude, wordLength, limit: 1 }).length > 0;

export const mkMission = (lang) => {
  const a = lang === 'ko' ? MISSION_KO : MISSION_EN;
  return a[Math.floor(Math.random() * a.length)];
};

const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export { shuffle };

// 라운드 수와 정확히 같은 글자 수를 가진 실제 사전 단어를 제시어로 고른다.
// 제시어 자체를 화면에 공개하지 않고, 각 라운드에 해당 글자만 순서대로 제시한다.
export function makeTitle(dict, mode, rounds, opts) {
  const lang = MODES[mode]?.lang || 'ko';
  const length = Math.max(1, Math.floor(Number(rounds) || 1));
  const wordLength = mode === 'KKT' ? 3 : 0;
  const pool = [];

  // 무작위 초성만 반복 탐색하다가 '가나다...' 같은 가짜 글자로 대체하던 기존 방식을 제거한다.
  // 실제로 로드된 사전 전체에서 라운드 수와 글자 수가 일치하는 단어만 찾는다.
  for (const entry of dict.words.values()) {
    const letters = Array.from(entry.w || '');
    if (letters.length !== length) continue;
    if (lang === 'ko' && entryDenied(entry, opts)) continue;

    const usable = letters.every((char) => (
      candidates(dict, mode, char, getSubChar(mode, char), opts, {
        limit: 1,
        wordLength,
      }).length > 0
    ));
    if (usable) pool.push(entry.w);
  }

  if (!pool.length) {
    throw new Error(`현재 사전에서 ${length}글자 제시어를 찾지 못했어요. 사전 데이터와 게임 규칙을 확인하거나 라운드 수를 바꿔주세요.`);
  }

  const word = pool[Math.floor(Math.random() * pool.length)];
  return Array.from(word);
}

export const cleanOpts = (modeKey, opts) =>
  Object.fromEntries(Object.keys(OPT_LABELS).map((k) => [k, MODES[modeKey].opts.includes(k) && !!opts[k]]));
