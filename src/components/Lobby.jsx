import { useState } from 'react';
import { BOT_NAMES } from '../engine/names.js';
import { load, save } from '../storage.js';
import Account from './Account.jsx';
import Leaderboard from './Leaderboard.jsx';
import AdminPanel from './AdminPanel.jsx';
import SettingsFields from './SettingsFields.jsx';
import { MODES, cleanOpts } from '../engine/rules.js';

export const defaultSettings = { mode: 'KSH', rounds: 3, time: 60, bots: 2, level: 2, opts: { manner: true, mission: true, injeong: false, loanword: false, strict: false } };
export const loadSettings = () => {
  const saved = load('settings', {});
  const m = { ...defaultSettings, ...saved, opts: { ...defaultSettings.opts, ...(saved.opts || {}) } };
  if (!MODES[m.mode]) m.mode = 'KSH';
  return m;
};

export default function Lobby({ onStart, onMulti, loading, error, auth, lbVersion }) {
  const [s, setS] = useState(loadSettings);
  const set = (patch) => setS((p) => ({ ...p, ...patch }));

  function go(e) {
    e.preventDefault();
    if (loading) return;
    save('settings', s);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, s.bots);
    const players = [
      { id: 'me', name: auth.profile.nickname, bot: false },
      ...names.map((n, i) => ({ id: 'bot' + i, name: n, bot: true, level: s.level })),
    ];
    onStart({ mode: s.mode, rounds: s.rounds, time: s.time, opts: cleanOpts(s.mode, s.opts), players });
  }

  return (
    <main className="lobby">
      <header className="hero">
        <div className="logo" aria-label="끄투">
          <span>끄</span><span>투</span>
        </div>
        <p className="tagline">글자로 놀자! <b>끄투 프리서버</b></p>
      </header>

      <Account auth={auth} />

      <button className="go multi-go" type="button" onClick={() => { save('settings', s); onMulti(); }} disabled={!auth.profile}>🌐 멀티플레이 (친구와 함께)</button>
      <p className="or">또는 봇과 연습하기</p>

      <form className="panel" onSubmit={go}>
        <SettingsFields s={s} set={set} minBots={1} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="go" type="submit" disabled={!!loading || !auth.profile}>
          {loading ? `사전 불러오는 중… ${Math.round((loading.pct || 0) * 100)}%` : '봇과 게임 시작'}
          {loading && <i className="go-fill" style={{ width: (loading.pct || 0) * 100 + '%' }} />}
        </button>
      </form>

      <Leaderboard meId={auth.user?.id} version={lbVersion} />

      {auth.isAdmin && <AdminPanel />}

      <footer className="foot">
        <p>
          원본 <a href="https://github.com/JJoriping/KKuTu" target="_blank" rel="noreferrer">JJoriping/KKuTu</a>의 규칙·점수식·봇 로직·단어 DB를 정적 웹용으로 옮긴 비공식 프리서버입니다. (GPL-3.0)
        </p>
        <p>영어 사전은 <a href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">WordNet</a> 자료를 포함합니다. © Princeton University.</p>
      </footer>
    </main>
  );
}
