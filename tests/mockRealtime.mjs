// supabase-js Realtime(채널/Broadcast/Presence) 의 메모리 내 모조 구현 — 멀티플레이 로직 테스트용
export class MockHub {
  constructor() { this.topics = new Map(); }
  client() {
    const hub = this;
    const channels = new Set();
    return {
      channel(topic, opts = {}) {
        const key = opts.config?.presence?.key || 'anon-' + Math.random();
        const selfBroadcast = !!opts.config?.broadcast?.self;
        const t = hub.topics.get(topic) || { chans: new Set(), presence: new Map() };
        hub.topics.set(topic, t);
        const ch = {
          topic, key, handlers: [], t,
          on(type, filter, cb) { ch.handlers.push({ type, event: filter.event, cb }); return ch; },
          subscribe(cb) { t.chans.add(ch); channels.add(ch); setTimeout(() => cb && cb('SUBSCRIBED'), 0); return ch; },
          track(meta) { t.presence.set(key, meta); hub.sync(t); return Promise.resolve('ok'); },
          untrack() { t.presence.delete(key); hub.sync(t); return Promise.resolve('ok'); },
          presenceState() { const o = {}; for (const [k, m] of t.presence) o[k] = [{ ...m, presence_ref: k }]; return o; },
          send({ event, payload }) {
            for (const c of t.chans) {
              if (c === ch && !selfBroadcast) continue;
              setTimeout(() => c.handlers.filter((h) => h.type === 'broadcast' && h.event === event).forEach((h) => h.cb({ event, payload: JSON.parse(JSON.stringify(payload)) })), 0);
            }
            return Promise.resolve('ok');
          },
        };
        return ch;
      },
      removeChannel(ch) { ch.t.chans.delete(ch); ch.t.presence.delete(ch.key); hub.sync(ch.t); return Promise.resolve('ok'); },
    };
  }
  sync(t) { for (const c of t.chans) setTimeout(() => c.handlers.filter((h) => h.type === 'presence').forEach((h) => h.cb()), 0); }
}
