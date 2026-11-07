import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const DEFAULT_COLORS = ['#398bd1', '#58c7a4', '#ef806d', '#f2b632'];

/**
 * 커서(터치)를 따라다니는 입자 무리.
 * - count: 입자 수 (화면 폭 600px 미만에서는 55%로 줄여 모바일 부담을 낮춤)
 * - size: 입자 반지름(px)
 * - spread: 무리가 퍼지는 반경(px)
 * - swirl: 소용돌이 회전 속도
 * - clickEffect: 'burst'(클릭·터치 시 사방으로 터짐) | 'none'
 * - fixed: true면 캔버스를 뷰포트 전체에 고정(스크롤되는 페이지용), false면 부모 영역 안에만 그림
 * 캔버스는 pointer-events:none 이라 안쪽 콘텐츠의 클릭·스크롤을 막지 않는다.
 */
export default function SwarmCursor({
  count = 800,
  size = 2.6,
  spread = 90,
  swirl = 0.6,
  clickEffect = 'burst',
  colors = DEFAULT_COLORS,
  fixed = false,
  className,
  style,
  children,
}) {
  const canvasRef = useRef(null);
  const colorKey = colors.join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const palette = colorKey.split('|');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let time = 0;
    let burst = 0;
    const ptr = { x: 0, y: 0, active: false };
    const cur = { x: 0, y: 0 };
    let buckets = palette.map(() => []);

    const build = () => {
      const n = Math.max(0, Math.round(count * (w < 600 ? 0.55 : 1)));
      buckets = palette.map(() => []);
      for (let i = 0; i < n; i += 1) {
        buckets[i % palette.length].push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0,
          vy: 0,
          a: Math.random() * TAU,
          rn: Math.sqrt(Math.random()),
          k: 0.6 + Math.random() * 0.8,
          s: size * (0.6 + Math.random() * 0.8),
          ph: Math.random() * TAU,
        });
      }
    };

    const step = (dt) => {
      time += dt;
      const sp = spread * (w < 600 ? 0.75 : 1);
      const tx = ptr.active ? ptr.x : w * 0.5 + Math.sin(time * 0.55) * w * 0.28;
      const ty = ptr.active ? ptr.y : h * 0.3 + Math.cos(time * 0.4) * h * 0.14;
      const f = 1 - Math.exp(-dt * 12);
      cur.x += (tx - cur.x) * f;
      cur.y += (ty - cur.y) * f;
      burst *= Math.exp(-dt * 3.2);
      const rs = 1 + burst * 2;
      const damp = Math.exp(-dt * 5.5);
      for (const list of buckets) {
        for (const p of list) {
          const ang = p.a + time * swirl * 4 * (1 - 0.6 * p.rn) + Math.sin(time * 1.3 + p.ph) * 0.25;
          const r = p.rn * sp * rs;
          const stiff = 46 * p.k;
          p.vx += (cur.x + Math.cos(ang) * r - p.x) * stiff * dt;
          p.vy += (cur.y + Math.sin(ang) * r - p.y) * stiff * dt;
          p.vx *= damp;
          p.vy *= damp;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 0.8;
      buckets.forEach((list, c) => {
        ctx.fillStyle = palette[c];
        ctx.beginPath();
        for (const p of list) {
          ctx.moveTo(p.x + p.s, p.y);
          ctx.arc(p.x, p.y, p.s, 0, TAU);
        }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    const settle = () => {
      // 움직임 줄이기 설정: 애니메이션 없이 정돈된 정지 화면 한 장만 그린다.
      for (let i = 0; i < 90; i += 1) step(1 / 30);
      draw();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width));
      const nh = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(nw * dpr);
      canvas.height = Math.round(nh * dpr);
      const rebuild = w === 0 || (nw < 600) !== (w < 600);
      w = nw;
      h = nh;
      if (rebuild) build();
      if (!ptr.active && (cur.x === 0 && cur.y === 0)) { cur.x = w * 0.5; cur.y = h * 0.3; }
      if (reduced) settle();
      else draw();
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30);
      last = now;
      step(dt);
      draw();
    };
    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const locate = (e) => {
      const rect = canvas.getBoundingClientRect();
      ptr.x = e.clientX - rect.left;
      ptr.y = e.clientY - rect.top;
      ptr.active = true;
    };
    const onMove = (e) => locate(e);
    const onDown = (e) => {
      locate(e);
      if (clickEffect !== 'burst' || reduced) return;
      burst = 1;
      for (const list of buckets) {
        for (const p of list) {
          const dx = p.x - ptr.x;
          const dy = p.y - ptr.y;
          const d = Math.hypot(dx, dy) || 1;
          const force = 260 + Math.random() * 520;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    return () => {
      stop();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
    };
  }, [count, size, spread, swirl, clickEffect, colorKey]);

  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: fixed ? 'fixed' : 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
