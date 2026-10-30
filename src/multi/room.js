// 서버 권위 멀티플레이: 방·차례·판정·점수는 전부 Supabase DB 함수(kk_room_*)가 처리한다.
// 클라이언트는 입력을 보내고(kk_room_submit) 주기적으로 상태를 받아(kk_room_tick) 그리기만 한다.
import { supabase } from '../supabase.js';
import { getToken } from '../auth.js';

export const MAX_PLAYERS = 8;

export class Store {
  constructor(init = null) { this.s = init; this.l = new Set(); }
  subscribe = (f) => { this.l.add(f); return () => this.l.delete(f); };
  getSnapshot = () => this.s;
  set(s) { this.s = s; this.l.forEach((f) => f()); }
}

const ERRS = {
  not_found: '방이 사라졌어요', full: '방이 가득 찼어요', in_game: '이미 게임이 진행 중이에요',
  forbidden: '방장만 할 수 있어요', need_players: '2명 이상이어야 시작할 수 있어요',
  unauthorized: '로그인이 만료됐어요. 다시 로그인해주세요', not_member: '방에서 나가졌어요', busy: '잠시 후 다시 해주세요',
};
const errMsg = (e) => ERRS[e] || ('오류: ' + e);

async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, { p_token: getToken(), ...args });
  if (error) return { error: '서버 오류: ' + error.message };
  if (data && data.error) return { error: errMsg(data.error), code: data.error };
  return { data };
}

/** 방 목록 (3초마다 갱신) */
export class LobbyNet {
  constructor() { this.rooms = []; this.cbs = new Set(); this.timer = null; }
  start() { this.poll(); this.timer = setInterval(() => this.poll(), 3000); }
  async poll() {
    const { data } = await supabase.rpc('kk_list_rooms');
    if (Array.isArray(data)) { this.rooms = data; this.cbs.forEach((f) => f(this.rooms)); }
  }
  watch(f) { this.cbs.add(f); f(this.rooms); return () => this.cbs.delete(f); }
  stop() { clearInterval(this.timer); this.cbs.clear(); }
}

export async function createRoom(name, max, settings) {
  const r = await call('kk_room_create', { p_name: name, p_max: max, p_settings: settings });
  return r.error ? { error: r.error } : { room: r.data.room };
}
export async function joinRoom(code) {
  const r = await call('kk_room_join', { p_code: code });
  return r.error ? { error: r.error } : { room: r.data.room };
}

export class RoomSession {
  constructor({ room, me }) {
    this.me = me; this.code = room.code;
    this.store = new Store(null);
    this.l = new Set();
    this.s = { phase: 'waiting', name: '', max: MAX_PLAYERS, settings: room.settings, members: [], hostId: room.host_id, chat: [], closed: '' };
    this.version = -1; this.dead = false; this.busy = false; this.offset = 0;
    this.apply(room, Date.now());
    this.schedule();
  }
  get isHost() { return this.s.hostId === this.me.id; }
  subscribe = (f) => { this.l.add(f); return () => this.l.delete(f); };
  getState = () => this.s;
  set(patch) { this.s = { ...this.s, ...patch }; this.l.forEach((f) => f()); }

  /** 서버가 준 방 상태를 반영. sentAt = 요청을 보낸 시각(내 시계) */
  apply(room, sentAt) {
    if (!room || this.dead) return;
    const recvAt = Date.now();
    this.offset = room.now - (sentAt + recvAt) / 2; // 서버 시계 - 내 시계
    if (room.version === this.version) return;
    this.version = room.version;
    const chat = (room.chat || []).map((c) => ({ id: c.from === this.me.nickname ? this.me.id : 'x' + c.id, key: c.id, nickname: c.from, text: c.text }));
    this.set({ phase: room.status, name: room.name, max: room.max, settings: room.settings, members: room.members.map((m) => ({ id: m.id, nickname: m.nickname })), hostId: room.host_id, chat });
    const st = room.state;
    if (st && room.status !== 'waiting') {
      const snap = { ...st };
      if (snap.turnAt) snap.turnAt = snap.turnAt - this.offset;
      this.store.set(snap);
    } else if (this.store.getSnapshot()) this.store.set(null);
  }

  schedule() {
    if (this.dead) return;
    const playing = this.s.phase === 'playing';
    this.timer = setTimeout(() => this.tick(), playing ? 600 : 1500);
  }
  async tick() {
    if (this.dead) return;
    const sent = Date.now();
    const r = await call('kk_room_tick', { p_code: this.code });
    if (this.dead) return;
    if (r.error) {
      if (r.code === 'not_found' || r.code === 'not_member' || r.code === 'unauthorized') { this.close(r.error); return; }
    } else this.apply(r.data.room, sent);
    this.schedule();
  }
  close(reason) { this.dead = true; clearTimeout(this.timer); this.set({ closed: reason }); this.dead = true; }

  async act(fn, args) {
    const sent = Date.now();
    const r = await call(fn, { p_code: this.code, ...args });
    if (r.error) return { ok: false, error: r.error };
    if (r.data.room) { this.version = -1; this.apply(r.data.room, sent); }
    return { ok: r.data.ok !== false, code: r.data.code };
  }
  async updateSettings(patch) {
    if (!this.isHost || this.s.phase !== 'waiting') return;
    const settings = { ...this.s.settings, ...patch };
    settings.bots = Math.max(0, Math.min(MAX_PLAYERS - this.s.members.length, settings.bots));
    this.set({ settings }); // 즉시 반영, 서버 응답으로 확정
    await this.act('kk_room_settings', { p_settings: settings });
  }
  canStart() {
    const { members, settings, max } = this.s;
    return members.length + Math.min(settings.bots, max - members.length) >= 2;
  }
  startGame() { return this.act('kk_room_start', {}); }
  resetToWaiting() { return this.act('kk_room_reset', {}); }
  sendChat(text) { return this.act('kk_room_chat', { p_text: text }); }
  submit = async (text) => {
    const r = await this.act('kk_room_submit', { p_text: text });
    if (r.error) return { ok: false, code: 'timeout' };
    return r;
  };
  leave() {
    if (this.dead) { this.l.clear(); return; }
    this.dead = true; clearTimeout(this.timer);
    supabase.rpc('kk_room_leave', { p_token: getToken(), p_code: this.code }).then(() => {}, () => {});
    this.l.clear();
  }
}
