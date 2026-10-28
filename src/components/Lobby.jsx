import { useState } from 'react';
import { MODES, OPT_LABELS, BOT_LEVELS } from '../engine/rules.js';
import { load, save } from '../storage.js';
import Account from './Account.jsx';
import Leaderboard from './Leaderboard.jsx';

const BOT_NAMES = ['끄투왕', '말잇기장인', '사전먹은봇', '쿵쿵따마스터', '초성귀신', '한방단어', '어휘력만렙', '단어수집가', '글자요정', '말꼬리봇', '낱말도둑', '받침귀신'];
const TIMES = [30, 60, 90, 120, 150];

const defaults = { nick: '', mode: 'KSH', rounds: 3, time: 60, bots: 2, level: 2, opts: { manner: true, mission: true, injeong: false, loanword: false, strict: false } };

export default function Lobby({ onStart, loading, error, auth, lbVersion }) {
  const [s, setS] = useState(() => {
    const saved = load('settings', {});
    const merged = { ...defaults, ...saved, opts: { ...defaults.opts, ...(saved.opts || {}) } };
    if (!MODES[merged.mode]) merged.mode = 'KSH';
    return merged;
  });
  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const mode = MODES[s.mode];

  function go(e) {
    e.preventDefault();
    if (loading) return;
    save('settings', s);
    const nick = auth.profile.nickname;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, s.bots);
    const players = [
      { id: 'me', name: nick, bot: false },
      ...names.map((n, i) => ({ id: 'bot' + i, name: n, bot: true, level: s.level })),
    ];
    const opts = Object.fromEntries(Object.keys(OPT_LABELS).map((k) => [k, mode.opts.includes(k) && !!s.opts[k]]));
    onStart({ mode: s.mode, rounds: s.rounds, time: s.time, opts, players });
  }

  return (
    <main className="lobby">
      <header className="hero">
        <div className="logo" aria-label="끄투">
          <span>끄</span><span>투</span>
        </div>
        <p className="tagline">글자로 놀자! <b>끄투 프리서버</b></p>
        <p className="sub">설치도 로그인도 없이, 브라우저에서 봇과 바로 한 판.</p>
      </header>

      <Account auth={auth} />

      <form className="panel" onSubmit={go}>
        <div className="field">
          <span className="field-label">게임 모드</span>
          <div className="modes" role="radiogroup" aria-label="게임 모드">
            {Object.entries(MODES).map(([k, m]) => (
              <button type="button" key={k} role="radio" aria-checked={s.mode === k} className={'mode' + (s.mode === k ? ' on' : '')} onClick={() => set({ mode: k })}>
                <b>{m.name}</b>
                <small>{m.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="grid2">
          <Stepper label="라운드 수" value={s.rounds} min={1} max={10} onChange={(v) => set({ rounds: v })} unit="라운드" />
          <Stepper label="봇 수" value={s.bots} min={1} max={7} onChange={(v) => set({ bots: v })} unit="명" />
        </div>

        <div className="field">
          <span className="field-label">라운드 시간</span>
          <div className="seg" role="radiogroup" aria-label="라운드 시간">
            {TIMES.map((t) => (
              <button type="button" key={t} role="radio" aria-checked={s.time === t} className={s.time === t ? 'on' : ''} onClick={() => set({ time: t })}>{t}초</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">봇 실력</span>
          <div className="seg" role="radiogroup" aria-label="봇 실력">
            {BOT_LEVELS.map((n, i) => (
              <button type="button" key={n} role="radio" aria-checked={s.level === i} className={s.level === i ? 'on' : ''} onClick={() => set({ level: i })}>{n}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">규칙</span>
          <div className="opts">
            {mode.opts.map((k) => (
              <label key={k} className={'opt' + (s.opts[k] ? ' on' : '')}>
                <input type="checkbox" checked={!!s.opts[k]} onChange={(e) => set({ opts: { ...s.opts, [k]: e.target.checked } })} />
                <span><b>{OPT_LABELS[k][0]}</b><small>{OPT_LABELS[k][1]}</small></span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="go" type="submit" disabled={!!loading || !auth.profile}>
          {loading ? `사전 불러오는 중… ${Math.round((loading.pct || 0) * 100)}%` : '게임 시작'}
          {loading && <i className="go-fill" style={{ width: (loading.pct || 0) * 100 + '%' }} />}
        </button>
      </form>

      <Leaderboard meId={auth.user?.id} version={lbVersion} />

      <footer className="foot">
        <p>
          원본 <a href="https://github.com/JJoriping/KKuTu" target="_blank" rel="noreferrer">JJoriping/KKuTu</a>의 규칙·점수식·봇 로직·단어 DB를 정적 웹용으로 옮긴 비공식 프리서버입니다. (GPL-3.0)
        </p>
        <p>영어 사전은 <a href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">WordNet</a> 자료를 포함합니다. © Princeton University.</p>
      </footer>
    </main>
  );
}

function Stepper({ label, value, min, max, onChange, unit }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`${label} 줄이기`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
        <output>{value}<small>{unit}</small></output>
        <button type="button" aria-label={`${label} 늘리기`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
      </div>
    </div>
  );
}
