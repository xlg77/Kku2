import { useState } from 'react';

export default function Account({ auth }) {
  const { user, profile, ready, error, signInGoogle, signOut, rename } = auth;
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState('');
  if (!ready) return <div className="account"><small>계정 확인 중…</small></div>;

  if (!user) {
    return (
      <div className="account">
        <button className="gbtn" onClick={signInGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          Google로 로그인
        </button>
        <small>로그인하면 전적이 저장되고 랭킹에 올라가요</small>
      </div>
    );
  }
  const p = profile;
  return (
    <div className="account in">
      <div className="me-line">
        <b>{p ? p.nickname : '불러오는 중…'}</b>
        <button className="link" onClick={() => { setNick(p?.nickname || ''); setEditing((v) => !v); }}>닉네임 변경</button>
        <button className="link" onClick={signOut}>로그아웃</button>
      </div>
      {editing && (
        <form className="rename" onSubmit={(e) => { e.preventDefault(); rename(nick); setEditing(false); }}>
          <input className="text" value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} aria-label="새 닉네임" />
          <button className="ghost" type="submit">저장</button>
        </form>
      )}
      {p && <small>{p.games}전 {p.wins}승 · 누적 {Number(p.total_score).toLocaleString()}점 · 최고 {p.best_score}점</small>}
      {error && <small className="err">{error}</small>}
    </div>
  );
}
