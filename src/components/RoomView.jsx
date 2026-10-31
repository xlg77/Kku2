import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MODES, BOT_LEVELS } from '../engine/rules.js';
import SettingsFields from './SettingsFields.jsx';
import GameView from './GameView.jsx';
import { unlockAudio } from '../sfx.js';

export default function RoomView({ session, meId, onLeave }) {
  const st = useSyncExternalStore(session.subscribe, session.getState);
  const [text, setText] = useState('');
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const unlock = () => { void unlockAudio().catch(() => {}); };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  const chatRef = useRef(null);
  const isHost = session.isHost;
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [st.chat.length]);

  if (st.closed) {
    return (
      <main className="lobby"><section className="panel"><h2 className="h2">방이 닫혔어요</h2><p>{st.closed}</p><button className="go" onClick={onLeave}>목록으로</button></section></main>
    );
  }

  if (st.phase !== 'waiting') {
    return (
      <GameView store={session.store} meId={meId} submit={session.submit} record={false} allowPrediction
        onExit={onLeave} onAgain={isHost ? () => session.resetToWaiting() : undefined} againLabel="대기실로"
      />
    );
  }

  const s = st.settings;
  const mode = MODES[s.mode];
  const total = st.members.length + Math.min(s.bots, st.max - st.members.length);
  const start = async () => { void unlockAudio().catch((error) => console.warn('[Kku2] 방 게임 시작 시 오디오 활성화 실패:', error)); setStarting(true); try { await session.startGame(); } finally { setStarting(false); } };

  return (
    <main className="lobby">
      <header className="topbar">
        <button className="ghost" onClick={() => { if (confirm('방을 나갈까요?')) onLeave(); }}>← 나가기</button>
        <b>{st.name}</b><span className="code">방 {session.code}</span>
      </header>

      <section className="panel">
        <h2 className="h2">참가자 <small>{st.members.length}/{st.max}명{s.bots > 0 ? ` + 봇 ${Math.min(s.bots, st.max - st.members.length)}명` : ''}</small></h2>
        <ul className="members">
          {st.members.map((m) => (
            <li key={m.id} className={m.id === meId ? 'me' : ''}>
              <span className="avatar" style={{ '--h': hue(m.id) }}>{m.nickname.slice(0, 1)}</span>
              <b>{m.nickname}</b>
              {m.id === st.hostId && <span className="badge">방장</span>}
              {m.id === meId && <small>나</small>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <section className="panel">
          <h2 className="h2">게임 설정</h2>
          <SettingsFields s={s} set={(p) => session.updateSettings(p)} minBots={0} maxBots={st.max - st.members.length} />
          <button className="go" onClick={start} disabled={starting || !session.canStart()}>
            {starting ? '시작하는 중…' : session.canStart() ? `게임 시작 (${total}명)` : '2명 이상이어야 시작할 수 있어요 (봇을 추가해도 돼요)'}
          </button>
        </section>
      ) : (
        <section className="panel">
          <h2 className="h2">게임 설정 <small>방장이 정해요</small></h2>
          <p className="summary"><b>{mode.name}</b> · {s.rounds}라운드 · {s.time}초 · 봇 {s.bots}명{s.bots > 0 ? `(${BOT_LEVELS[s.level]})` : ''}</p>
          <small>방장이 시작하면 게임이 열려요…</small>
        </section>
      )}

      <section className="panel chat">
        <h2 className="h2">채팅</h2>
        <div className="chatlog" ref={chatRef}>
          {!st.chat.length && <small>아직 대화가 없어요</small>}
          {st.chat.map((c) => <p key={c.key} className={c.id === meId ? 'mine' : ''}><b>{c.nickname}</b> {c.text}</p>)}
        </div>
        <form className="rename" onSubmit={(e) => { e.preventDefault(); session.sendChat(text); setText(''); }}>
          <input className="text" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="메시지" aria-label="채팅 입력" />
          <button className="ghost" type="submit">전송</button>
        </form>
      </section>
    </main>
  );
}
const hue = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
