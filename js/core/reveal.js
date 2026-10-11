// Scroll reveals. Content is readable before JS runs; only elements below the
// first screen are moved into a soft "pending" state, then settle on entry.
// Position is checked every frame while scrolling (not only on intersection),
// so anything jumped past with End, a #link or a fast fling still settles.
import { reducedMotion, onFrame } from './env.js';
import { scramble } from './scramble.js';

// Headings decode while a scanline sweeps down them.
function bootHeading(el, duration) {
  el.classList.add('is-booting');
  setTimeout(() => el.classList.remove('is-booting'), 900);
  scramble(el, undefined, { duration });
}

export function initReveals() {
  if (reducedMotion()) return;
  const fold = innerHeight * 0.92;
  let reveals = [];
  let scrambles = [];

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top > fold) {
      el.dataset.reveal = 'pending';
      reveals.push(el);
    } else el.dataset.reveal = 'in';
  });
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    if (el.getBoundingClientRect().top > fold) scrambles.push(el);
  });

  let lastY = -1;
  let lastH = innerHeight;
  const stop = onFrame(() => {
    const y = window.scrollY;
    if (y === lastY && innerHeight === lastH) return;
    lastY = y;
    lastH = innerHeight;
    const line = innerHeight * 0.88;
    if (reveals.length) {
      reveals = reveals.filter((el) => {
        if (el.getBoundingClientRect().top > line) return true;
        const delay = Number(el.dataset.revealDelay || 0);
        setTimeout(() => {
          el.dataset.reveal = 'in';
        }, delay);
        return false;
      });
    }
    if (scrambles.length) {
      scrambles = scrambles.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.top > line) return true;
        // Only animate if it is actually on screen; skip ones jumped past.
        if (r.bottom > 0) bootHeading(el, 1000);
        return false;
      });
    }
    if (!reveals.length && !scrambles.length) stop();
  });
}

// Scramble the headings that are already on screen, after the boot screen.
export function introScramble() {
  if (reducedMotion()) return;
  const fold = innerHeight;
  document.querySelectorAll('[data-scramble]').forEach((el, i) => {
    if (el.getBoundingClientRect().top < fold) setTimeout(() => bootHeading(el, 1100), i * 120);
  });
}
