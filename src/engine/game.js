// 끄투 클래식 게임 진행기 (원본 kkutu.js + classic.js 의 흐름을 브라우저용으로 포팅)
import {
  MODES, getChar, getSubChar, isChainable, entryDenied, candidates, hasNext, mkMission, makeTitle,
  getPreScore, getPenalty, getTurnSpeed, shuffle,
  ROBOT_START_DELAY, ROBOT_TYPE_COEF, ROBOT_THINK_COEF, ROBOT_HIT_LIMIT, ROBOT_LENGTH_LIMIT,
} from './rules.js';

export class Game {
  /**
   * @param {{dict, mode, opts, rounds, time, players:{id,name,bot?,level?}[]}} cfg
   */
  constructor(cfg) {
    this.cfg = cfg;
    this.dict = cfg.dict;
    this.mode = cfg.mode;
    this.opts = cfg.opts || {};
    this.lang = MODES[this.mode].lang;
    this.timers = new Set();
    this.listeners = new Set();
    this.dic = {}; // 단어별 사용 횟수 (점수 감쇠용)
    this.title = [];
    this.turn = 0;
    this.seq = shuffle(cfg.players.map((p) => p.id));
    this.players = {};
    for (const p of cfg.players) this.players[p.id] = { ...p, score: 0, words: 0, best: '' };
    this.s = this.snapshot({ phase: 'idle', round: 0, chain: [], log: [], event: 0 });
    this.dead = false;
  }

  /* ---------- 구독 ---------- */
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.s;
  snapshot(patch) {
    const prev = this.s || {};
    return {
      ...prev,
      rounds: this.cfg.rounds,
      mode: this.mode,
      seq: this.seq,
      turn: this.turn,
      players: Object.fromEntries(Object.entries(this.players).map(([k, v]) => [k, { ...v }])),
      ...patch,
    };
  }
  emit(patch) {
    if (this.dead) return;
    this.s = this.snapshot(patch);
    this.listeners.forEach((f) => f());
  }
  later(fn, ms) {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms);
    this.timers.add(t);
    return t;
  }
  clear(t) { if (t) { clearTimeout(t); this.timers.delete(t); } }
  destroy() { this.dead = true; this.timers.forEach(clearTimeout); this.timers.clear(); this.listeners.clear(); }

  get wordLength() { return this.mode === 'KKT' ? 3 : 0; }
  get current() { return this.seq[this.turn]; }

  /* ---------- 진행 ---------- */
  start() {
    this.title = makeTitle(this.dict, this.mode, this.cfg.rounds, this.opts);
    this.round = 0;
    this.later(() => this.nextRound(), 400);
    this.emit({ phase: 'starting' });
  }

  nextRound() {
    this.round++;
    if (this.round > this.cfg.rounds) return this.finish();
    this.char = this.title[this.round - 1];
    this.subChar = getSubChar(this.mode, this.char);
    this.chain = [];
    this.roundTime = this.cfg.time * 1000;
    this.mission = this.opts.mission ? mkMission(this.lang) : null;
    this.emit({ phase: 'roundReady', round: this.round, char: this.char, subChar: this.subChar, chain: [], mission: this.mission, hint: null, error: null, turnAt: 0 });
    this.later(() => this.turnStart(), 2400);
  }

  turnStart() {
    this.roundTime = Math.min(this.roundTime, Math.max(10000, 150000 - this.chain.length * 1500));
    const speed = getTurnSpeed(this.roundTime);
    this.turnTime = 15000 - 1400 * speed;
    this.turnAt = Date.now();
    this.done = false;
    this.emit({
      phase: 'turn', turn: this.turn, turnAt: this.turnAt, turnTime: this.turnTime, speed,
      roundTimeLeft: this.roundTime, char: this.char, subChar: this.subChar, mission: this.mission, error: null, hint: null,
    });
    this.turnTimer = this.later(() => this.turnEnd(), Math.min(this.roundTime, this.turnTime + 100));
    const p = this.players[this.current];
    if (p.bot) this.readyRobot(p);
  }

  /** 시간 초과: 패널티 후 라운드 종료 */
  turnEnd() {
    if (this.done) return;
    this.done = true;
    const p = this.players[this.current];
    const delta = getPenalty(this.chain, p.score);
    p.score += delta;
    const used = new Set(this.chain);
    const list = candidates(this.dict, this.mode, this.char, this.subChar, this.opts, { exclude: used, wordLength: this.wordLength, limit: 3000 });
    const hint = list.length ? list[Math.floor(Math.random() * list.length)].w : null;
    this.emit({
      phase: 'roundEnd', hint,
      last: { id: this.event(), pid: p.id, ok: false, score: delta },
      log: [...this.s.log, { type: 'timeout', pid: p.id, round: this.round }],
    });
    this.later(() => this.nextRound(), 3000);
  }
  event() { this._ev = (this._ev || 0) + 1; return this._ev; }

  /** 단어 제출. 결과 {ok, code} 를 돌려준다 (UI 가 오류 안내에 사용). */
  submit(pid, text) {
    if (this.s.phase !== 'turn' || this.done) return { ok: false, code: 'phase' };
    if (pid !== this.current) return { ok: false, code: 'turn' };
    text = (text || '').trim();
    if (this.lang === 'en') text = text.toLowerCase();
    if (!text) return { ok: false, code: 'empty' };
    if (!isChainable(this.mode, text, this.char, this.subChar, this.wordLength)) return { ok: false, code: 'chain' };
    if (this.chain.includes(text)) return { ok: false, code: 409 };
    const e = this.dict.get(text);
    const denied = this.lang === 'ko' ? entryDenied(e, this.opts) : (e ? 0 : 404);
    if (denied) return { ok: false, code: denied };
    const nextChar = getChar(this.mode, text);
    const used = new Set(this.chain); used.add(text);
    if (this.chain.length < 1 || this.opts.manner) {
      if (!hasNext(this.dict, this.mode, nextChar, this.opts, { exclude: used, wordLength: this.wordLength })) {
        return { ok: false, code: this.chain.length < 1 ? 402 : 403 };
      }
    }
    // 승인
    this.done = true;
    this.clear(this.turnTimer);
    const t = Date.now() - this.turnAt;
    const { score, bonus } = this.getScore(text, t);
    this.dic[text] = (this.dic[text] || 0) + 1;
    this.chain.push(text);
    this.roundTime -= t;
    this.char = nextChar;
    this.subChar = getSubChar(this.mode, nextChar);
    const p = this.players[pid];
    p.score += score; p.words++;
    if (text.length > p.best.length) p.best = text;
    if (this.mission === true) this.mission = mkMission(this.lang);
    this.emit({
      phase: 'turnResult', char: this.char, subChar: this.subChar, chain: [...this.chain], mission: this.mission,
      last: { id: this.event(), pid, ok: true, score, bonus, word: text },
      log: [...this.s.log, { type: 'word', pid, word: text, score, round: this.round }],
      error: null,
    });
    this.later(() => { this.turn = (this.turn + 1) % this.seq.length; this.turnStart(); }, Math.max(700, this.turnTime / 6));
    return { ok: true };
  }

  getScore(text, delay) {
    const tr = 1 - delay / this.turnTime;
    let score = getPreScore(text, this.chain, tr);
    const n = this.dic[text] || 0;
    if (n) score *= 15 / (n + 15);
    let bonus = 0;
    if (this.mission && this.mission !== true) {
      const m = text.split(this.mission).length - 1;
      if (m) { bonus = Math.round(score * 0.5 * m); score += score * 0.5 * m; this.mission = true; }
    }
    return { score: Math.round(score), bonus };
  }

  finish() {
    const rank = Object.values(this.players).sort((a, b) => b.score - a.score);
    let pv = null, r = 0;
    rank.forEach((p, i) => { if (p.score !== pv) r = i; p.rank = r; pv = p.score; });
    this.emit({ phase: 'over', ranking: rank.map((p) => ({ ...p })) });
  }

  /* ---------- 봇 (원본 readyRobot) ---------- */
  readyRobot(robot, retry = 0) {
    const level = robot.level;
    let delay = ROBOT_START_DELAY[level];
    const done = (this._robotDone = this._robotDone && this._robotDone.id === robot.id + this.chain.length ? this._robotDone : { id: robot.id + this.chain.length, list: [] });
    const used = new Set(this.chain);
    let list = candidates(this.dict, this.mode, this.char, this.subChar, this.opts, { exclude: used, wordLength: this.wordLength });
    if (list.length > 123) list = shuffle(list).slice(0, 123);
    const mustCheck = this.chain.length < 1 || this.opts.manner;
    const ok = (e) => !mustCheck || hasNext(this.dict, this.mode, getChar(this.mode, e.w), this.opts, { exclude: new Set([...used, e.w]), wordLength: this.wordLength });
    const isRev = this.mode === 'KAP';
    const giveUp = () => { /* 못 찾으면 시간 초과로 패배 */ };
    if (!list.length) return giveUp();
    list.sort((a, b) => b.hit - a.hit);
    // 약한 봇은 "자주 쓰이는 단어"만 안다. 원본은 조건에 맞는 단어가 없으면 포기하지만,
    // 이 사전은 대부분 hit 가 0 이라 그대로면 봇이 아무것도 못 한다 → 없으면 전체에서 고른다.
    const known = list.filter((e) => e.hit >= ROBOT_HIT_LIMIT[level]);
    if (known.length) list = known;

    let pool = list;
    if (level >= 3 && !done.list.length) {
      if (Math.random() < 0.5) pool = list.slice().sort((a, b) => b.w.length - a.w.length);
      if (pool[0].w.length < 8 && this.turnTime >= 2300) {
        // 상대가 이어가기 어려운 글자로 끝나는 단어를 고른다
        const ended = new Map();
        for (const e of pool) {
          const k = isRev ? e.w[0] : e.w[e.w.length - 1];
          if (!ended.has(k)) ended.set(k, []);
          ended.get(k).push(e);
        }
        const wish = [...ended.keys()].map((k) => ({
          k, n: candidates(this.dict, this.mode, k, getSubChar(this.mode, k), this.opts, { limit: 10, wordLength: this.wordLength }).length,
        })).sort((a, b) => a.n - b.n);
        const pick = (mustCheck ? wish.find((x) => x.n > 0) : wish[0]);
        if (pick) pool = ended.get(pick.k);
      }
    }
    pool = pool.slice();
    let w;
    do {
      w = pool.shift();
      if (!w) break;
    } while (w.w.length > ROBOT_LENGTH_LIMIT[level] || done.list.includes(w.w) || !ok(w));
    if (!w) return giveUp();
    delay += 500 * ROBOT_THINK_COEF[level] * Math.random() / Math.log(1.1 + (Math.pow(2, w.hit) - 1));
    delay += w.w.length * ROBOT_TYPE_COEF[level];
    done.list.push(w.w);
    const turnId = this.chain.length + ':' + this.round;
    this.later(() => {
      if (this.s.phase !== 'turn' || this.current !== robot.id || turnId !== this.chain.length + ':' + this.round) return;
      const r = this.submit(robot.id, w.w);
      if (!r.ok && retry < 3 && this.s.phase === 'turn') this.readyRobot(robot, retry + 1);
    }, delay);
  }
}
