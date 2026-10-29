import { useState } from 'react';
import Lobby from './components/Lobby.jsx';
import GameView from './components/GameView.jsx';
import { loadDict } from './engine/dict.js';
import { MODES } from './engine/rules.js';
import { useAuth, fetchCustomWords } from './auth.js';
import AuthScreen from './components/AuthScreen.jsx';

export default function App() {
  const [screen, setScreen] = useState({ name: 'lobby' });
  const [loading, setLoading] = useState(null); // {pct} | null
  const [error, setError] = useState('');
  const auth = useAuth();
  const [lbVersion, setLbVersion] = useState(0);

  async function start(cfg) {
    if (!auth.user || !auth.profile) return;
    setError('');
    setLoading({ pct: 0 });
    try {
      const dict = await loadDict(MODES[cfg.mode].lang, (pct) => setLoading({ pct }), () => fetchCustomWords(MODES[cfg.mode].lang));
      setScreen({ name: 'game', cfg: { ...cfg, dict, loggedIn: true }, key: Date.now() });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(null);
    }
  }

  if (!auth.ready) return <main className="lobby"><p className="sub" style={{ textAlign: 'center', marginTop: 80 }}>불러오는 중…</p></main>;
  if (!auth.user) return <AuthScreen auth={auth} />;

  if (screen.name === 'game') {
    return <GameView key={screen.key} cfg={screen.cfg} onExit={() => { setLbVersion((v) => v + 1); auth.refresh(); setScreen({ name: 'lobby' }); }} onRecorded={() => auth.refresh()} onAgain={() => setScreen({ ...screen, key: Date.now() })} />;
  }
  return <Lobby onStart={start} loading={loading} error={error} auth={auth} lbVersion={lbVersion} />;
}
