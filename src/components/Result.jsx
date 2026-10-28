import { useEffect, useRef, useState } from 'react';
import { recordGame } from '../auth.js';

export default function Result({ s, cfg, onExit, onAgain, onRecorded }) {
  const [saved, setSaved] = useState(cfg.loggedIn ? 'saving' : 'guest');
  const once = useRef(false);
  useEffect(() => {
    if (!cfg.loggedIn || once.current) return;
    once.current = true; // StrictMode 에서도 한 번만 기록
    const me = s.ranking.find((p) => p.id === 'me');
    recordGame({ mode: cfg.mode, score: me.score, rank: me.rank, players: s.ranking.length }).then((err) => {
      setSaved(err ? 'error' : 'done');
      if (!err && onRecorded) onRecorded();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rank = s.ranking;
  const me = rank.find((p) => p.id === 'me');
  const medal = ['🥇', '🥈', '🥉'];
  const total = rank.length;
  return (
    <main className="result">
      <h1>{me.rank === 0 ? '🎉 우승!' : `${me.rank + 1}등`}</h1>
      <p className="sub">{total}명 중 {me.rank + 1}등 · 내 점수 {me.score}점 · 이은 단어 {me.words}개</p>
      <p className={'save-note ' + saved}>
        {saved === 'saving' && '전적 저장 중…'}
        {saved === 'done' && '✅ 전적이 저장됐어요'}
        {saved === 'error' && '⚠️ 전적을 저장하지 못했어요'}
        {saved === 'guest' && '로그인하면 전적이 저장돼요'}
      </p>
      <ol className="rank">
        {rank.map((p) => (
          <li key={p.id} className={p.id === 'me' ? 'me' : ''}>
            <span className="medal">{medal[p.rank] || p.rank + 1}</span>
            <span className="rname"><b>{p.name}</b>{p.best && <small>최장 단어 “{p.best}”</small>}</span>
            <span className="rscore">{p.score}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button className="go" onClick={onAgain}>한 판 더</button>
        <button className="ghost solid" onClick={onExit}>설정으로</button>
      </div>
    </main>
  );
}
