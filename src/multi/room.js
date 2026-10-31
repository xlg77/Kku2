// 서버 권위 멀티플레이: 방·차례·판정·점수·봇은 Supabase DB 함수(kk_room_*)가 처리한다.
// DB RPC가 성공한 뒤 변경 알림만 Broadcast로 보내고, tick은 게임 시계/접속 상태용 heartbeat로 쓴다.
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

/** 공개 채널에는 방 코드/버전만 보낸다. 실제 방 상태는 멤버 검증 RPC로만 읽는다. */
async function sendRoomBroadcast(topic, payload) {
  const channel = supabase.channel(topic);
  try {
    await channel.send({ type: 'broadcast', event: 'room_changed', payload });
  } finally {
    await supabase.removeChannel(channel);
  }
}
function notifyRoomChanged(code, version = null, operation = 'UPDATE') {
  const payload = { code, version, operation };
  void Promise.all([
    sendRoomBroadcast('kku2:lobby', payload),
    sendRoomBroadcast(`kku2:room:${code}`, payload),
  ]).catch(() => {
    // Realtime이 일시적으로 끊겨도 heartbeat가 최신 상태를 다시 가져온다.
  });
}

async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, { p_token: getToken(), ...args });
  if (error) return { error: '서버 오류: ' + error.message };
  if (data && data.error) return { error: errMsg(data.error), code: data.error };
  return { data };
}

/** 방 목록은 Broadcast 알림으로 즉시 갱신하고, 연결 복구용으로 12초마다 확인한다. */
export class LobbyNet {
  constructor() {
    this.rooms = [];
    this.cbs = new Set();
    this.timer = null;
    this.channel = null;
    this.polling = false;
    this.pollAgain = false;
    this.dead = false;
  }
  start() {
    if (this.channel || this.dead) return;
    this.dead = false;
    this.channel = supabase
      .channel('kku2:lobby')
      .on('broadcast', { event: 'room_changed' }, () => this.poll())
      .subscribe();
    this.poll();
    this.timer = setInterval(() => this.poll(), 12000);
  }
  async poll() {
    if (this.dead) return;
    if (this.polling) { this.pollAgain = true; return; }
    this.polling = true;
    try {
      const { data, error } = await supabase.rpc('kk_list_rooms');
      if (!error && !this.dead && Array.isArray(data)) {
        this.rooms = data;
        this.cbs.forEach((f) => f(this.rooms));
      }
    } catch {
      // Realtime 및 다음 heartbeat에서 자동으로 다시 동기화한다.
    } finally {
      this.polling = false;
      if (this.pollAgain && !this.dead) {
        this.pollAgain = false;
        void this.poll();
      }
    }
  }
  watch(f) { this.cbs.add(f); f(this.rooms); return () => this.cbs.delete(f); }
  stop() {
    this.dead = true;
    clearInterval(this.timer);
    this.timer = null;
    this.cbs.clear();
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = null;
  }
}

export async function createRoom(name, max, settings) {
  const r = await call('kk_room_create', { p_name: name, p_max: max, p_settings: settings });
  if (r.error) return { error: r.error };
  notifyRoomChanged(r.data.room.code, r.data.room.version, 'INSERT');
  return { room: r.data.room };
}
export async function joinRoom(code) {
  const r = await call('kk_room_join', { p_code: code });
  if (r.error) return { error: r.error };
  notifyRoomChanged(r.data.room.code, r.data.room.version, 'UPDATE');
  return { room: r.data.room };
}

export class RoomSession {
  constructor({ room, me }) {
    this.me = me;
    this.code = room.code;
    this.store = new Store(null);
    this.l = new Set();
    this.s = { phase: 'waiting', name: '', max: MAX_PLAYERS, settings: room.settings, members: [], hostId: room.host_id, chat: [], closed: '' };
    this.version = -1;
    this.dead = false;
    this.busy = false;
    this.refreshQueued = false;
    this.offset = 0;
    this.timer = null;
    this.channel = null;
    this.apply(room, Date.now());
    this.channel = supabase
      .channel(`kku2:room:${this.code}`)
      .on('broadcast', { event: 'room_changed' }, () => this.tick(true))
      .subscribe();
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
    this.offset = room.now - (sentAt + recvAt) / 2;
    if (room.version === this.version) return;
    this.version = room.version;
    const chat = (room.chat || []).map((c) => ({ id: c.from === this.me.nickname ? this.me.id : 'x' + c.id, key: c.id, nickname: c.from, text: c.text }));
    this.set({
      phase: room.status, name: room.name, max: room.max, settings: room.settings,
      members: room.members.map((m) => ({ id: m.id, nickname: m.nickname })),
      hostId: room.host_id, chat,
    });
    const st = room.state;
    if (st && room.status !== 'waiting') {
      const snap = { ...st };
      if (snap.turnAt) snap.turnAt = snap.turnAt - this.offset;
      this.store.set(snap);
    } else if (this.store.getSnapshot()) {
      this.store.set(null);
    }
  }

  schedule() {
    if (this.dead) return;
    clearTimeout(this.timer);
    const playing = this.s.phase === 'playing';
    const resultWindow = this.store.getSnapshot()?.phase === 'turnResult';
    // 제출 직후 1.25초 예측 공개 구간은 빠르게 확인하고, 평소에는 heartbeat 빈도를 낮춘다.
    const delay = playing ? (resultWindow ? 250 : 2200) : 7000;
    this.timer = setTimeout(() => this.tick(false), delay);
  }
  async tick(fromBroadcast = false) {
    if (this.dead) return;
    if (this.busy) { if (fromBroadcast) this.refreshQueued = true; return; }
    clearTimeout(this.timer);
    this.timer = null;
    this.busy = true;
    const sent = Date.now();
    const previousVersion = this.version;
    try {
      const r = await call('kk_room_tick', { p_code: this.code });
      if (this.dead) return;
      if (r.error) {
        if (r.code === 'not_found' || r.code === 'not_member' || r.code === 'unauthorized') {
          if (r.code === 'not_found') notifyRoomChanged(this.code, null, 'DELETE');
          this.close(r.error);
          return;
        }
      } else {
        this.apply(r.data.room, sent);
        if (!fromBroadcast && r.data.room?.version !== previousVersion) {
          notifyRoomChanged(this.code, r.data.room.version, 'UPDATE');
        }
      }
    } finally {
      this.busy = false;
      if (this.refreshQueued && !this.dead) {
        this.refreshQueued = false;
        void this.tick(true);
      } else {
        this.schedule();
      }
    }
  }
  close(reason) {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = null;
    this.set({ closed: reason });
  }

  async act(fn, args) {
    const sent = Date.now();
    const previousVersion = this.version;
    const r = await call(fn, { p_code: this.code, ...args });
    if (r.error) return { ok: false, error: r.error };
    if (r.data.room) {
      this.version = -1;
      this.apply(r.data.room, sent);
      if (r.data.room.version !== previousVersion) {
        notifyRoomChanged(this.code, r.data.room.version, 'UPDATE');
      }
      this.schedule();
    } else if (r.data.ok === true) {
      // kk_room_chat은 ok만 반환하므로, 방 채널에 변경 알림을 보내 다른 참가자의 채팅을 갱신한다.
      notifyRoomChanged(this.code, null, 'UPDATE');
    }
    return { ok: r.data.ok !== false, code: r.data.code };
  }
  async updateSettings(patch) {
    if (!this.isHost || this.s.phase !== 'waiting') return;
    const settings = { ...this.s.settings, ...patch };
    settings.bots = Math.max(0, Math.min(MAX_PLAYERS - this.s.members.length, settings.bots));
    this.set({ settings });
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
    this.dead = true;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = null;
    supabase.rpc('kk_room_leave', { p_token: getToken(), p_code: this.code }).then(({ error, data }) => {
      if (!error && !data?.error) notifyRoomChanged(this.code, null, 'UPDATE');
    }).catch(() => {});
    this.l.clear();
  }
}
