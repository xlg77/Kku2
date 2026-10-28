import { useEffect, useRef } from 'react';

/** 남은 시간을 rAF 로 부드럽게 그리는 바. 리렌더 없이 DOM 을 직접 갱신한다. */
export default function TimerBar({ since, total, active, label, className = '', danger = 0.25, onTick }) {
  const fill = useRef(null);
  const text = useRef(null);
  useEffect(() => {
    if (!active || !total) {
      if (fill.current) fill.current.style.width = active ? '100%' : '0%';
      if (text.current) text.current.textContent = '';
      return;
    }
    let raf;
    const loop = () => {
      const left = Math.max(0, total - (Date.now() - since));
      const ratio = left / total;
      if (fill.current) {
        fill.current.style.width = ratio * 100 + '%';
        fill.current.dataset.danger = ratio < danger ? '1' : '0';
      }
      if (text.current) text.current.textContent = (left / 1000).toFixed(1) + '초';
      if (onTick) onTick(left);
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [since, total, active, danger]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`bar ${className}`} role="timer" aria-label={label}>
      <div className="bar-fill" ref={fill} />
      <span className="bar-text" ref={text} />
    </div>
  );
}
