import { useState } from 'react';
import Lobby from './components/Lobby.jsx';
import GameView from './components/GameView.jsx';
import { loadDict } from './engine/dict.js';
import { MODES } from './engine/rules.js';
import { useAuth } from './auth.js';

export default function App() {
  const [screen, setScreen] = useState({ name: 'lobby' });
  const [loading, setLoading] = useState(null); // {pct} | null
  const [error, setError] = useState('');
  const auth = useAuth();
  const [lbVersion, setLbVersion] = useState(0);

  async function start(cfg) {
    setError('');
    setLoading({ pct: 0 });
    try {
      const dict = await loadDict(MODES[cfg.mode].lang, (pct) => setLoading({ pct }));
      setScreen({ name: 'game', cfg: { ...cfg, dict, loggedIn: !!auth.user }, key: Date.now() });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(null);
    }
  }

  if (screen.name === 'game') {
    return <GameView key={screen.key} cfg={screen.cfg} onExit={() => { setLbVersion((v) => v + 1); auth.refresh(); setScreen({ name: 'lobby' }); }} onRecorded={() => auth.refresh()} onAgain={() => setScreen({ ...screen, key: Date.now() })} />;
  }
  return <Lobby onStart={start} loading={loading} error={error} auth={auth} lbVersion={lbVersion} />;
}
