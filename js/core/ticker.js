// Marquee that drifts at a steady speed. No skew or scroll-driven speed changes,
// so the text never wobbles.
import { onFrame, reducedMotion, whileVisible } from './env.js';

export function initTickers(root = document) {
  root.querySelectorAll('[data-ticker]').forEach((ticker) => {
    const track = ticker.querySelector('.ticker__track');
    const group = track?.querySelector('.ticker__group');
    if (!group) return;
    // The markup ships two copies of the group for a seamless loop; add one if missing.
    if (track.querySelectorAll('.ticker__group').length < 2) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.append(clone);
    }
    if (reducedMotion()) return;

    const base = Number(ticker.dataset.ticker) || 0.6;
    let x = 0;
    let visible = true;
    let w = group.offsetWidth;
    new ResizeObserver(() => {
      w = group.offsetWidth;
    }).observe(group);
    whileVisible(ticker, (v) => {
      visible = v;
    });
    onFrame(() => {
      if (!visible || !w) return;
      x -= base;
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  });
}
