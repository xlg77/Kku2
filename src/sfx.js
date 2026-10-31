// Web Audio 효과음: 게임 시작 사용자 동작에서 컨텍스트를 활성화한다.
import { load, save } from './storage.js';

let ctx = null;
let muted = load('muted', false);
let unlockPromise = null;

export const isMuted = () => muted;
export const setMuted = (m) => { muted = !!m; save('muted', muted); };

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!ctx || ctx.state === 'closed') ctx = new AudioContextClass();
  return ctx;
}

// 반드시 클릭/터치/키 입력 이벤트 안에서 호출해야 브라우저가 오디오를 허용할 수 있다.
export function unlockAudio() {
  try {
    const audio = getAudioContext();
    if (!audio) return Promise.reject(new Error('이 브라우저는 Web Audio를 지원하지 않습니다.'));
    if (audio.state === 'running') return Promise.resolve(true);
    if (!unlockPromise) {
      unlockPromise = audio.resume().then(() => {
        if (audio.state !== 'running') throw new Error('오디오 컨텍스트가 활성화되지 않았습니다.');
        return true;
      }).catch((error) => {
        console.warn('[Kku2] 오디오 활성화 실패:', error);
        unlockPromise = null;
        throw error;
      });
    }
    return unlockPromise;
  } catch (error) {
    console.warn('[Kku2] 오디오 초기화 실패:', error);
    return Promise.reject(error);
  }
}

function tone(freq, dur = 0.12, type = 'sine', when = 0, vol = 0.08) {
  if (muted) return;
  try {
    const audio = getAudioContext();
    if (!audio) return;
    const play = () => {
      if (muted || audio.state !== 'running') return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      const startAt = audio.currentTime + Math.max(0, when);
      gain.gain.setValueAtTime(vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + dur + 0.02);
    };
    if (audio.state === 'running') play();
    else void unlockAudio().then(play).catch((error) => console.warn('[Kku2] 효과음 재생 불가:', error));
  } catch (error) {
    console.warn('[Kku2] 효과음 생성 실패:', error);
  }
}

export const sfx = {
  ok: () => { tone(660, 0.1, 'triangle'); tone(880, 0.14, 'triangle', 0.08); },
  bad: () => tone(180, 0.18, 'sawtooth', 0, 0.05),
  boom: () => { tone(120, 0.5, 'sawtooth', 0, 0.09); tone(70, 0.6, 'square', 0.05, 0.06); },
  round: () => { tone(523, 0.12, 'triangle'); tone(659, 0.12, 'triangle', 0.12); tone(784, 0.2, 'triangle', 0.24); },
  tick: () => tone(1000, 0.04, 'square', 0, 0.03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', i * 0.13)),
};
