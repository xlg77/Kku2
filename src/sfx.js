// 아주 가벼운 WebAudio 효과음
import { load, save } from './storage.js';
let ctx = null;
let muted = load('muted', false);
export const isMuted = () => muted;
export const setMuted = (m) => { muted = m; save('muted', m); };

function tone(freq, dur = 0.12, type = 'sine', when = 0, vol = 0.08) {
  if (muted) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}
export const sfx = {
  ok: () => { tone(660, 0.1, 'triangle'); tone(880, 0.14, 'triangle', 0.08); },
  bad: () => tone(180, 0.18, 'sawtooth', 0, 0.05),
  boom: () => { tone(120, 0.5, 'sawtooth', 0, 0.09); tone(70, 0.6, 'square', 0.05, 0.06); },
  round: () => { tone(523, 0.12, 'triangle'); tone(659, 0.12, 'triangle', 0.12); tone(784, 0.2, 'triangle', 0.24); },
  tick: () => tone(1000, 0.04, 'square', 0, 0.03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', i * 0.13)),
};
