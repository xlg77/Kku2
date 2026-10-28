// 두음법칙 (원본 classic.js 의 getSubChar 로직)
const RIEUL_TO_NIEUN = [4449, 4450, 4457, 4460, 4462, 4467];
const RIEUL_TO_IEUNG = [4451, 4455, 4456, 4461, 4466, 4469];
const NIEUN_TO_IEUNG = [4455, 4461, 4466, 4469];

export function koSubChar(char) {
  const k = char.charCodeAt(0) - 0xac00;
  if (k < 0 || k > 11171) return undefined;
  const cb = [Math.floor(k / 28 / 21) + 0x1100, (Math.floor(k / 28) % 21) + 0x1161, (k % 28) + 0x11a7];
  let changed = false;
  if (cb[0] === 4357) { // ㄹ
    changed = true;
    if (RIEUL_TO_NIEUN.includes(cb[1])) cb[0] = 4354;
    else if (RIEUL_TO_IEUNG.includes(cb[1])) cb[0] = 4363;
    else changed = false;
  } else if (cb[0] === 4354) { // ㄴ
    if (NIEUN_TO_IEUNG.includes(cb[1])) { cb[0] = 4363; changed = true; }
  }
  if (!changed) return undefined;
  return String.fromCharCode(((cb[0] - 0x1100) * 21 + (cb[1] - 0x1161)) * 28 + (cb[2] - 0x11a7) + 0xac00);
}

// 초성 19개 각각의 시작 코드 (가, 까, 나, ...)
export const initialStart = (i) => 44032 + 588 * i;
