import { useState } from 'react';

export default function Account({ auth }) {
  const { profile: p, error, signOut, rename } = auth;
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState('');
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
