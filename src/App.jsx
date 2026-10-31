import { useEffect, useRef, useState } from 'react';
import Lobby, { loadSettings } from './components/Lobby.jsx';
import SinglePlay from './components/SinglePlay.jsx';
import RoomList from './components/RoomList.jsx';
import RoomView from './components/RoomView.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import { loadDict } from './engine/dict.js';
import { MODES } from './engine/rules.js';
import { useAuth } from './auth.js';
import { supabase } from './supabase.js';
import { LobbyNet, RoomSession, createRoom as createRoomRpc, joinRoom as joinRoomRpc } from './multi/room.js';

const dictFor = (lang, onProgress) => loadDict(lang, onProgress, supabase);

export default function App() {
  const [screen, setScreen] = useState({ name: 'lobby' });
  const [loading, setLoading] = useState(null); // {pct} | null
  const [error, setError] = useState('');
  const auth = useAuth();
  const [lbVersion, setLbVersion] = useState(0);
  const lobbyRef = useRef(null);
  const sessionRef = useRef(null);

  const getLobby = () => {
    if (!lobbyRef.current) { lobbyRef.current = new LobbyNet(); lobbyRef.current.start(); }
    return lobbyRef.current;
  };
  const closeNet = () => {
    if (sessionRef.current) { sessionRef.current.leave(); sessionRef.current = null; }
    if (lobbyRef.current) { lobbyRef.current.stop(); lobbyRef.current = null; }
  };
  useEffect(() => closeNet, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!auth.user) { closeNet(); setScreen({ name: 'lobby' }); } }, [auth.user]);

  async function start(cfg) {
    if (!auth.user || !auth.profile) return;
    setError('');
    setLoading({ pct: 0 });
    try {
      const dict = await dictFor(MODES[cfg.mode].lang, (pct) => setLoading({ pct }));
      setScreen({ name: 'game', cfg: { ...cfg, dict }, key: Date.now() });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(null);
    }
  }

  const home = () => { closeNet(); setLbVersion((v) => v + 1); auth.refresh(); setScreen({ name: 'lobby' }); };
  const toRooms = () => { setError(''); getLobby(); setScreen({ name: 'rooms' }); };

  async function enter(p) {
    setError('');
    const r = await p;
    if (r.error) { setError(r.error); return; }
    const me = { id: auth.user.id, nickname: auth.profile.nickname };
    const session = new RoomSession({ room: r.room, me });
    sessionRef.current = session;
    setScreen({ name: 'room', session });
  }
  const createRoom = (name, max) => {
    const s = loadSettings();
    return enter(createRoomRpc(name, max, { mode: s.mode, rounds: s.rounds, time: s.time, bots: Math.min(s.bots, 1), level: s.level, opts: s.opts }));
  };
  const joinRoom = (r) => enter(joinRoomRpc(r.code));
  const leaveRoom = () => {
    if (sessionRef.current) { sessionRef.current.leave(); sessionRef.current = null; }
    setScreen({ name: 'rooms' });
  };

  if (!auth.ready) return <main className="lobby"><p className="sub" style={{ textAlign: 'center', marginTop: 80 }}>불러오는 중…</p></main>;
  if (!auth.user) return <AuthScreen auth={auth} />;

  if (screen.name === 'game') {
    return <SinglePlay key={screen.key} cfg={screen.cfg} onExit={home} onAgain={() => setScreen({ ...screen, key: Date.now() })} onRecorded={() => auth.refresh()} />;
  }
  if (screen.name === 'rooms') {
    return <RoomList lobby={getLobby()} nickname={auth.profile.nickname} onCreate={createRoom} onJoin={joinRoom} onBack={home} error={error} />;
  }
  if (screen.name === 'room') {
    return <RoomView session={screen.session} meId={auth.user.id} onLeave={leaveRoom} />;
  }
  return <Lobby onStart={start} onMulti={toRooms} loading={loading} error={error} auth={auth} lbVersion={lbVersion} />;
}
