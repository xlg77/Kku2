import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../auth.js';

export default function Leaderboard({ meId, version }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    fetchLeaderboard(10).then((r) => alive && setRows(r)).catch((e) => alive && setErr(e.message || '불러오지 못했어요'));
    return () => { alive = false; };
  }, [version]);
  return (
    <section className="panel lb">
      <h2>🏆 랭킹 <small>누적 점수 TOP 10</small></h2>
      {err && <p className="error">{err}</p>}
      {!rows && !err && <small>불러오는 중…</small>}
      {rows && !rows.length && <small>아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</small>}
      {rows && rows.length > 0 && (
        <ol className="rank">
          {rows.map((r, i) => (
            <li key={r.id} className={r.id === meId ? 'me' : ''}>
              <span className="medal">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
              <span className="rname"><b>{r.nickname}</b><small>{r.games}전 {r.wins}승 · 최고 {r.best_score}점</small></span>
              <span className="rscore">{Number(r.total_score).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
