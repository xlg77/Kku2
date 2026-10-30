import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MockHub } from './mockRealtime.mjs';
import { Dict } from '../src/engine/dict.js';
import { candidates, getSubChar } from '../src/engine/rules.js';
import { LobbyNet, RoomSession } from '../src/multi/room.js';

const ko = new Dict('ko', fs.readFileSync('public/data/ko.txt', 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return; await wait(20); } throw new Error('timeout: ' + fn); }

test('멀티플레이: 방 목록·입장·진행·응답·방장 이탈', async () => {
  const hub = new MockHub();
  const mk = (id, nickname) => ({ sb: hub.client(), me: { id, nickname } });
  const A = mk('A', '방장'), B = mk('B', '손님1'), C = mk('C', '손님2');
  const settings = { mode: 'KSH', rounds: 1, time: 60, bots: 0, level: 2, opts: { manner: true, mission: false } };

  // 방장: 방 만들기 + 로비에 광고
  const lobbyA = new LobbyNet(A.sb, 'A'); lobbyA.start();
  const host = new RoomSession({ sb: A.sb, lobby: lobbyA, code: 'ABCD', me: A.me, hostId: 'A', isHost: true, name: '테스트방', max: 4, settings, loadDictFn: async () => ko });
  await host.join();

  // 손님이 방 목록에서 방을 본다
  const lobbyB = new LobbyNet(B.sb, 'B'); lobbyB.start();
  let rooms = []; lobbyB.watch((r) => { rooms = r; });
  await until(() => rooms.length === 1);
  assert.equal(rooms[0].code, 'ABCD'); assert.equal(rooms[0].name, '테스트방'); assert.equal(rooms[0].count, 1);

  const gB = new RoomSession({ sb: B.sb, code: 'ABCD', me: B.me, hostId: 'A', isHost: false, settings });
  const gC = new RoomSession({ sb: C.sb, code: 'ABCD', me: C.me, hostId: 'A', isHost: false, settings });
  await gB.join(); await gC.join();
  await until(() => gB.getState().members.length === 3 && gC.getState().members.length === 3);
  await until(() => rooms[0].count === 3);

  // 채팅
  gB.sendChat('안녕');
  await until(() => host.getState().chat.length === 1 && gC.getState().chat.length === 1);

  // 방장이 설정 변경 → 손님에게 전파
  host.updateSettings({ rounds: 2 });
  await until(() => gB.getState().settings.rounds === 2);
  host.updateSettings({ rounds: 1 });
  await until(() => gB.getState().settings.rounds === 1);

  // 게임 시작
  await host.startGame();
  await until(() => gB.store.getSnapshot() && gB.store.getSnapshot().phase === 'turn', 12000);
  assert.equal(gB.getState().phase, 'playing');

  // 각자 자기 차례에 유효한 단어를 낸다 (4번 성공할 때까지)
  const sessions = { A: host, B: gB, C: gC };
  const played = []; const errs = [];
  for (let i = 0; i < 4; i++) {
    await until(() => { const s = host.store.getSnapshot(); return s.phase === 'turn' && s.seq[s.turn] !== undefined && played.length === i; }, 12000);
    const s = host.store.getSnapshot();
    const who = s.seq[s.turn]; const sess = sessions[who];
    const used = new Set(s.chain);
    // 먼저 일부러 틀린 단어(체인 불일치) → 오류 코드가 돌아와야 한다
    if (i === 1) { const bad = await sess.submit('ㅋㅋㅋ'); errs.push(bad.code); assert.equal(bad.ok, false); }
    const w = candidates(ko, 'KSH', s.char, getSubChar('KSH', s.char), { manner: true }, { exclude: used, limit: 50 }).find((e) => e.w.length >= 2 && e.w.length <= 4);
    const r = await sess.submit(w.w);
    assert.equal(r.ok, true, `${who} ${w.w} ${r.code}`);
    played.push([who, w.w]);
    await until(() => host.store.getSnapshot().chain.length === i + 1);
  }
  assert.ok(new Set(played.map((p) => p[0])).size >= 2, 'at least two humans played: ' + JSON.stringify(played));
  assert.ok(errs.includes('chain'));
  // 손님 화면의 chain 이 방장과 같다
  await until(() => gC.store.getSnapshot().chain.length >= 4);
  assert.deepEqual(gC.store.getSnapshot().chain.slice(0, 4), host.store.getSnapshot().chain.slice(0, 4));
  // 방장 시계 보정: 남은 턴 시간이 0~turnTime 사이
  const gs = gB.store.getSnapshot(); assert.ok(Date.now() - gs.turnAt < gs.turnTime + 5000);

  // 손님이 나가면 그 자리를 봇이 이어받는다
  gC.leave();
  await until(() => host.store.getSnapshot().players.C.bot === true);

  // 방장이 나가면 손님은 '닫힘'
  host.leave();
  await until(() => gB.getState().closed, 4000);
  host.game && host.game.destroy();
  gB.leave();
});
