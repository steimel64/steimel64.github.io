// Circuit traces that draw in on scroll: a bus line runs first, then each
// branch drops to its card in turn. Paths use pathLength="1" so drawing is a
// single dash offset per path.
import { onFrame, clamp, reducedMotion, whileVisible } from '../core/env.js';

export function initTraces(svg) {
  const bus = svg.querySelector('[data-bus]');
  const branches = [...svg.querySelectorAll('[data-branch]')];
  const targets = [...(svg.parentElement?.querySelectorAll('.principle') || [])];
  const wrap = svg.parentElement;
  if (!window.matchMedia('(min-width: 1400px)').matches) return;
  wrap.classList.add('has-traces');
  if (reducedMotion()) {
    svg.classList.add('is-drawn');
    targets.forEach((t) => t.classList.add('is-wired'));
    return;
  }
  let visible = false;
  whileVisible(
    svg,
    (v) => {
      visible = v;
    },
    '100px',
  );
  onFrame(() => {
    if (!visible) return;
    const r = svg.getBoundingClientRect();
    const p = clamp((innerHeight * 0.9 - r.top) / (innerHeight * 0.55), 0, 1);
    bus.style.strokeDashoffset = String(1 - clamp(p / 0.5, 0, 1));
    // Branches start in turn and the last one finishes as p reaches 1, however many there are.
    const step = Math.min(0.12, 0.4 / Math.max(1, branches.length - 1));
    branches.forEach((b, i) => {
      const start = 0.35 + i * step;
      const local = clamp((p - start) / 0.25, 0, 1);
      b.style.strokeDashoffset = String(1 - local);
      targets[i]?.classList.toggle('is-wired', local >= 1);
    });
  });
}
