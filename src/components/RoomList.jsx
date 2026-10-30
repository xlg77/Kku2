import { useEffect, useState } from 'react';
import { MODES } from '../engine/rules.js';
import { Stepper } from './SettingsFields.jsx';

export default function RoomList({ lobby, nickname, onCreate, onJoin, onBack, error }) {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState(`${nickname}의 방`);
  const [max, setMax] = useState(4);
  const [creating, setCreating] = useState(false);
  useEffect(() => lobby.watch(setRooms), [lobby]);

  return (
    <main className="lobby">
      <header className="topbar"><button className="ghost" onClick={onBack}>← 처음으로</button><b>멀티플레이</b><span /></header>

      <form className="panel" onSubmit={(e) => { e.preventDefault(); if (!creating) { setCreating(true); onCreate(name.trim() || `${nickname}의 방`, max).finally(() => setCreating(false)); } }}>
        <h2 className="h2">방 만들기</h2>
        <label className="field">
          <span className="field-label">방 이름</span>
          <input className="text" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <Stepper label="최대 인원" value={max} min={2} max={8} onChange={setMax} unit="명" />
        <button className="go" type="submit" disabled={creating}>{creating ? '만드는 중…' : '방 만들기'}</button>
      </form>

      <section className="panel rooms">
        <h2 className="h2">열려 있는 방 <small>{rooms.length}개</small></h2>
        {error && <p className="error" role="alert">{error}</p>}
        {!rooms.length && <small>지금 열린 방이 없어요. 방을 만들어 친구를 초대해보세요! 친구는 이 목록에서 방을 찾아 들어오면 돼요.</small>}
        <ul className="roomlist">
          {rooms.map((r) => {
            const full = r.count >= r.max, playing = r.status === 'playing';
            return (
              <li key={r.code}>
                <div className="rinfo">
                  <b>{r.name}</b>
                  <small>{MODES[r.mode]?.name || r.mode} · {r.rounds}라운드 · {r.time}초 · 방장 {r.hostName}</small>
                </div>
                <span className="rcount">{r.count}/{r.max}</span>
                <button className="ghost" disabled={full || playing} onClick={() => onJoin(r)}>{playing ? '진행 중' : full ? '가득 참' : '입장'}</button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
