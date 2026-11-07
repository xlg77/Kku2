import { gsap } from 'gsap';

// 화면에 새로 나타나는 모든 버튼을 "지금 있는 자리"에서 버블처럼 통통 튀게 띄운다.
// 값은 BubbleMenu 기본값(back.out(1.5), 0.5초, 0.12초 간격)과 같다.
const SELECTOR = 'button, label.go, label.ghost, .opt';
const EASE = 'back.out(1.5)';
const DURATION = 0.5;
const STEP = 0.12;
const MAX_SPREAD = 0.9; // 한 번에 버튼이 많아도 전체 등장 시간이 이 안에 끝나도록 간격을 줄인다

export function startBubbleIn() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = new WeakSet();

  const collect = (node, out) => {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) out.push(node);
    node.querySelectorAll(SELECTOR).forEach((el) => out.push(el));
  };

  const play = (found) => {
    const list = [];
    for (const el of found) {
      if (seen.has(el) || !el.isConnected) continue;
      seen.add(el);
      if (!el.closest('[data-bubble-skip]')) list.push(el);
    }
    if (reduce || !list.length) return;
    const step = Math.min(STEP, MAX_SPREAD / list.length);
    list.forEach((el, i) => {
      el.style.transition = 'none'; // CSS transition이 gsap 값을 뒤쫓으며 끊기는 것을 막는다
      gsap.fromTo(
        el,
        { scale: 0, transformOrigin: '50% 50%' },
        {
          scale: 1,
          duration: DURATION,
          ease: EASE,
          delay: i * step,
          clearProps: 'transform,transformOrigin',
          onComplete: () => el.style.removeProperty('transition'),
        }
      );
    });
  };

  const observer = new MutationObserver((records) => {
    const found = [];
    for (const record of records) record.addedNodes.forEach((node) => collect(node, found));
    if (found.length) play(found);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const initial = [];
  collect(document.body, initial);
  play(initial);

  return () => observer.disconnect();
}
