// 서버 없는 멀티플레이: Supabase Realtime(Broadcast + Presence)만 사용한다.
//  - 방 목록: 'kkutu-lobby' 채널의 Presence 에 방장이 방 정보를 올려둔다 (방장이 나가면 자동으로 사라짐)
//  - 게임: 'kkutu-room-<코드>' 채널. 방장의 브라우저가 Game 엔진을 돌리고, 참가자는 단어를 보내고 상태를 받는다.
import { Game } from '../engine/game.js';
import { MODES, cleanOpts } from '../engine/rules.js';
import { BOT_NAMES } from '../engine/names.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const MAX_PLAYERS = 8;

export class Store {
  constructor(init = null) { this.s = init; this.l = new Set(); }
  subscribe = (f) => { this.l.add(f); return () => this.l.delete(f); };
  getSnapshot = () => this.s;
  set(s) { this.s = s; this.l.forEach((f) => f()); }
}

/** 방 목록 (Presence) */
export class LobbyNet {
  constructor(sb, myId) { this.sb = sb; this.myId = myId; this.rooms = []; this.cbs = new Set(); this.info = null; this.ready = false; }
  start() {
    this.ch = this.sb.channel('kkutu-lobby', { config: { presence: { key: this.myId } } });
    this.ch.on('presence', { event: 'sync' }, () => this.sync());
    this.ch.subscribe((st) => {
      if (st === 'SUBSCRIBED') { this.ready = true; if (this.info) this.ch.track(this.info); }
    });
  }
  sync() {
    const st = this.ch.presenceState();
    const byCode = new Map();
    for (const k of Object.keys(st)) for (const m of st[k]) if (m.role === 'room' && m.code) byCode.set(m.code, { ...m });
    this.rooms = [...byCode.values()];
    this.cbs.forEach((f) => f(this.rooms));
  }
  watch(f) { this.cbs.add(f); f(this.rooms); return () => this.cbs.delete(f); }
  advertise(info) { this.info = { role: 'room', ...info }; if (this.ready) this.ch.track(this.info); }
  unadvertise() { this.info = null; if (this.ready) this.ch.untrack(); }
  stop() { try { this.sb.removeChannel(this.ch); } catch { /* ignore */ } }
}

/** 방 하나 (방장/참가자 공용) */
export class RoomSession {
  constructor({ sb, lobby, code, me, hostId, isHost, name, max, settings, loadDictFn }) {
    this.sb = sb; this.lobby = lobby; this.code = code; this.me = me; this.isHost = isHost; this.loadDictFn = loadDictFn;
    this.s = { phase: 'waiting', name: name || '', max: max || MAX_PLAYERS, settings, members: [], hostId, chat: [], closed: '' };
    this.store = new Store(null);
    this.l = new Set();
    this.order = [];
    this.pending = new Map();
    this.nonce = 0;
    this.sawHost = isHost;
    this.game = null;
  }
  subscribe = (f) => { this.l.add(f); return () => this.l.delete(f); };
  getState = () => this.s;
  set(patch) { this.s = { ...this.s, ...patch }; this.l.forEach((f) => f()); }

  join() {
    return new Promise((resolve, reject) => {
      this.ch = this.sb.channel(`kkutu-room-${this.code}`, { config: { broadcast: { self: false }, presence: { key: this.me.id } } });
      this.ch.on('presence', { event: 'sync' }, () => this.onPresence());
      this.ch.on('broadcast', { event: 'chat' }, ({ payload }) => this.onChat(payload));
      this.ch.on('broadcast', { event: 'room' }, ({ payload }) => this.onRoom(payload));
      this.ch.on('broadcast', { event: 'state' }, ({ payload }) => this.onState(payload));
      this.ch.on('broadcast', { event: 'ack' }, ({ payload }) => this.onAck(payload));
      this.ch.on('broadcast', { event: 'submit' }, ({ payload }) => this.onSubmit(payload));
      this.ch.on('broadcast', { event: 'closed' }, () => this.onClosed('방장이 방을 닫았어요'));
      this.ch.subscribe((st) => {
        if (st === 'SUBSCRIBED') { this.ch.track({ id: this.me.id, nickname: this.me.nickname }); this.advertise(); resolve(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') reject(new Error('방에 연결하지 못했어요'));
      });
    });
  }
  send(event, payload) { return this.ch.send({ type: 'broadcast', event, payload }); }

  /* ---------- 멤버 ---------- */
  onPresence() {
    const st = this.ch.presenceState();
    const cur = new Map();
    for (const k of Object.keys(st)) { const m = st[k][0]; if (m && m.id) cur.set(m.id, { id: m.id, nickname: m.nickname }); }
    if (this.isHost) {
      const gone = this.order.filter((id) => !cur.has(id));
      this.order = this.order.filter((id) => cur.has(id));
      for (const id of cur.keys()) if (!this.order.includes(id)) this.order.push(id);
      if (this.order.includes(this.me.id)) { this.order = [this.me.id, ...this.order.filter((i) => i !== this.me.id)]; }
      const members = this.order.map((id) => cur.get(id));
      this.set({ members });
      if (this.game) for (const id of gone) this.game.replaceWithBot(id);
      this.broadcastRoom(); this.advertise();
    } else {
      if (cur.has(this.s.hostId)) this.sawHost = true;
      else if (this.sawHost) this.onClosed('방장이 나갔어요');
    }
  }
  broadcastRoom() {
    const { phase, name, max, settings, members, hostId } = this.s;
    this.send('room', { phase, name, max, settings, members, hostId });
  }
  onRoom(p) {
    if (this.isHost) return;
    const back = this.s.phase !== 'waiting' && p.phase === 'waiting';
    this.set({ phase: p.phase, name: p.name, max: p.max, settings: p.settings, members: p.members, hostId: p.hostId });
    if (back) this.store.set(null);
  }
  advertise() {
    if (!this.isHost || !this.lobby) return;
    const { name, max, settings, members, phase } = this.s;
    this.lobby.advertise({ code: this.code, name, hostId: this.me.id, hostName: this.me.nickname, mode: settings.mode, rounds: settings.rounds, time: settings.time, count: members.length, max, status: phase === 'waiting' ? 'waiting' : 'playing' });
  }

  /* ---------- 채팅 ---------- */
  onChat(c) { this.set({ chat: [...this.s.chat, c].slice(-60) }); }
  sendChat(text) {
    text = (text || '').trim().slice(0, 200);
    if (!text) return;
    const c = { id: this.me.id, nickname: this.me.nickname, text, ts: Date.now() };
    this.onChat(c); this.send('chat', c);
  }

  /* ---------- 방장: 설정 / 게임 진행 ---------- */
  updateSettings(patch) {
    if (!this.isHost || this.s.phase !== 'waiting') return;
    const settings = { ...this.s.settings, ...patch };
    const m = this.s.members.length;
    settings.bots = Math.max(0, Math.min(MAX_PLAYERS - m, settings.bots));
    this.set({ settings });
    this.broadcastRoom(); this.advertise();
  }
  canStart() {
    const { members, settings } = this.s;
    return members.length + Math.min(settings.bots, MAX_PLAYERS - members.length) >= 2;
  }
  async startGame() {
    if (!this.isHost || this.s.phase !== 'waiting' || !this.canStart()) return;
    const { members, settings } = this.s;
    this.set({ phase: 'playing' }); this.broadcastRoom(); this.advertise();
    const dict = await this.loadDictFn(MODES[settings.mode].lang);
    const nbots = Math.min(settings.bots, MAX_PLAYERS - members.length);
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, nbots);
    const players = [
      ...members.map((m) => ({ id: m.id, name: m.nickname, bot: false })),
      ...names.map((n, i) => ({ id: 'bot' + i, name: n, bot: true, level: settings.level })),
    ];
    const game = new Game({ dict, mode: settings.mode, opts: cleanOpts(settings.mode, settings.opts), rounds: settings.rounds, time: settings.time, players });
    this.game = game;
    game.subscribe(() => {
      const { log, ...snap } = game.getSnapshot(); // eslint-disable-line no-unused-vars
      this.store.set(snap);
      this.send('state', { snap, sentAt: Date.now() });
      if (snap.phase === 'over' && this.s.phase !== 'over') { this.set({ phase: 'over' }); this.broadcastRoom(); this.advertise(); }
    });
    game.start();
  }
  resetToWaiting() {
    if (!this.isHost) return;
    if (this.game) { this.game.destroy(); this.game = null; }
    this.store.set(null);
    this.set({ phase: 'waiting' });
    this.broadcastRoom(); this.advertise();
  }

  /* ---------- 단어 제출 ---------- */
  submit = (text) => {
    if (this.isHost) return Promise.resolve(this.game ? this.game.submit(this.me.id, text) : { ok: false, code: 'phase' });
    const nonce = ++this.nonce;
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.pending.delete(nonce); resolve({ ok: false, code: 'timeout' }); }, 4000);
      this.pending.set(nonce, (r) => { clearTimeout(t); resolve(r); });
      this.send('submit', { nonce, pid: this.me.id, text });
    });
  };
  onSubmit(p) {
    if (!this.isHost || !this.game || !p || typeof p.text !== 'string') return;
    if (!this.s.members.some((m) => m.id === p.pid)) return;
    const r = this.game.submit(p.pid, p.text.slice(0, 40));
    this.send('ack', { nonce: p.nonce, pid: p.pid, ok: r.ok, code: r.code });
  }
  onAck(p) {
    if (this.isHost || !p || p.pid !== this.me.id) return;
    const f = this.pending.get(p.nonce);
    if (f) { this.pending.delete(p.nonce); f({ ok: p.ok, code: p.code }); }
  }
  onState({ snap, sentAt }) {
    if (this.isHost) return;
    const s = { ...snap };
    if (s.turnAt) s.turnAt = Date.now() - (sentAt - s.turnAt); // 방장 시계 → 내 시계
    this.store.set(s);
    if (s.phase === 'over' && this.s.phase !== 'over') this.set({ phase: 'over' });
    else if (s.phase !== 'over' && this.s.phase === 'waiting') this.set({ phase: 'playing' });
  }
  onClosed(reason) { if (!this.s.closed) this.set({ closed: reason }); }

  /* ---------- 나가기 ---------- */
  leave() {
    try {
      if (this.isHost) { this.send('closed', {}); if (this.lobby) this.lobby.unadvertise(); }
      if (this.game) { this.game.destroy(); this.game = null; }
      this.ch.untrack();
      this.sb.removeChannel(this.ch);
    } catch { /* ignore */ }
    this.l.clear();
  }
}
