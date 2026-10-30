import { useEffect, useRef, useState } from 'react';
import { recordGame } from '../auth.js';

export default function Result({ s, meId, record, onExit, onAgain, againLabel = '한 판 더', onRecorded }) {
  const [saved, setSaved] = useState(record ? 'saving' : 'multi');
  const once = useRef(false);
  const rank = s.ranking;
  const me = rank.find((p) => p.id === meId);

  useEffect(() => {
    if (!record || once.current || !me) return;
    once.current = true; // StrictMode 에서도 한 번만 기록
    recordGame({ mode: s.mode, score: me.score, rank: me.rank, players: rank.length }).then((err) => {
      setSaved(err ? 'error' : 'done');
      if (!err && onRecorded) onRecorded();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const medal = ['🥇', '🥈', '🥉'];
  return (
    <main className="result">
      <h1>{!me ? '게임 종료' : me.rank === 0 ? '🎉 우승!' : `${me.rank + 1}등`}</h1>
      {me && <p className="sub">{rank.length}명 중 {me.rank + 1}등 · 내 점수 {me.score}점 · 이은 단어 {me.words}개</p>}
      <p className={'save-note ' + saved}>
        {saved === 'saving' && '전적 저장 중…'}
        {saved === 'done' && '✅ 전적이 저장됐어요'}
        {saved === 'error' && '⚠️ 전적을 저장하지 못했어요'}
        {saved === 'multi' && '멀티플레이 판은 랭킹에 반영되지 않아요'}
      </p>
      <ol className="rank">
        {rank.map((p) => (
          <li key={p.id} className={p.id === meId ? 'me' : ''}>
            <span className="medal">{medal[p.rank] || p.rank + 1}</span>
            <span className="rname"><b>{p.name}</b>{p.best && <small>최장 단어 “{p.best}”</small>}</span>
            <span className="rscore">{p.score}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        {onAgain ? <button className="go" onClick={onAgain}>{againLabel}</button> : <p className="note">방장이 대기실로 돌아가면 이어서 할 수 있어요.</p>}
        <button className="ghost solid" onClick={onExit}>{record ? '설정으로' : '방 나가기'}</button>
      </div>
    </main>
  );
}
