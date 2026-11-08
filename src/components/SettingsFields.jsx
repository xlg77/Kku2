import { MODES, OPT_LABELS, BOT_LEVELS } from '../engine/rules.js';

export const TIMES = [30, 60, 90, 120, 150];

export function Stepper({ label, value, min, max, onChange, unit, disabled }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`${label} 줄이기`} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min}>−</button>
        <output>{value}<small>{unit}</small></output>
        <button type="button" aria-label={`${label} 늘리기`} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max}>+</button>
      </div>
    </div>
  );
}

/** 모드·라운드·봇·시간·규칙 입력 (혼자 하기 / 멀티 방 설정 공용) */
export default function SettingsFields({ s, set, minBots = 1, maxBots = 7, disabled = false }) {
  const selectedCustom = customModes.find((m) => m.id === s.mode);\n  const mode = MODES[selectedCustom?.base_mode || s.mode] || MODES.KSH;
  return (
    <>
      <div className="field">
        <span className="field-label">게임 모드</span>
        <div className="modes" role="radiogroup" aria-label="게임 모드">
          {[...Object.entries(MODES).map(([k, m]) => ({ id: k, ...m })), ...customModes.map((m) => ({ id: m.id, name: m.name, desc: m.description || '사용자 제작 단어장', lang: m.lang, opts: MODES[m.base_mode]?.opts || [] }))].map((m) => (

            <button type="button" key={m.id} role="radio" aria-checked={s.mode === m.id} disabled={disabled} className={'mode' + (s.mode === m.id ? ' on' : '')} onClick={() => set({ mode: m.id })}>
              <b>{m.name}</b>
              <small>{m.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <Stepper label="라운드 수" value={s.rounds} min={1} max={10} onChange={(v) => set({ rounds: v })} unit="라운드" disabled={disabled} />
        <Stepper label="봇 수" value={s.bots} min={minBots} max={maxBots} onChange={(v) => set({ bots: v })} unit="명" disabled={disabled} />
      </div>

      <div className="field">
        <span className="field-label">라운드 시간</span>
        <div className="seg" role="radiogroup" aria-label="라운드 시간">
          {TIMES.map((t) => (
            <button type="button" key={t} role="radio" aria-checked={s.time === t} disabled={disabled} className={s.time === t ? 'on' : ''} onClick={() => set({ time: t })}>{t}초</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">봇 실력</span>
        <div className="seg" role="radiogroup" aria-label="봇 실력">
          {BOT_LEVELS.map((n, i) => (
            <button type="button" key={n} role="radio" aria-checked={s.level === i} disabled={disabled} className={s.level === i ? 'on' : ''} onClick={() => set({ level: i })}>{n}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">규칙</span>
        <div className="opts">
          {mode.opts.map((k) => (
            <label key={k} className={'opt' + (s.opts[k] ? ' on' : '')}>
              <input type="checkbox" disabled={disabled} checked={!!s.opts[k]} onChange={(e) => set({ opts: { ...s.opts, [k]: e.target.checked } })} />
              <span><b>{OPT_LABELS[k][0]}</b><small>{OPT_LABELS[k][1]}</small></span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
