// Scroll reveals. Content is readable before JS runs; only elements below the
// first screen are moved into a soft "pending" state, then settle on entry.
// Positions are measured once (and again when the layout changes); each frame
// compares them with the scroll offset, so anything jumped past with End, a
// #link or a fast fling still settles, without layout reads while scrolling.
import { reducedMotion, onFrame, trackBox, untrackBox, changed } from './env.js';
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
  // Measure everything first and write afterwards, so the page is laid out once.
  const revealBoxes = [...document.querySelectorAll('[data-reveal]')].map(trackBox);
  const scrambleBoxes = [...document.querySelectorAll('[data-scramble]')].map(trackBox);
  const below = (box) => box.docTop - window.scrollY > fold;

  let reveals = revealBoxes.filter((box) => {
    box.el.dataset.reveal = below(box) ? 'pending' : 'in';
    if (below(box)) return true;
    untrackBox(box);
    return false;
  });
  let scrambles = scrambleBoxes.filter((box) => {
    if (below(box)) return true;
    untrackBox(box);
    return false;
  });

  const seen = {};
  const stop = onFrame(() => {
    if (!changed(seen)) return;
    const line = innerHeight * 0.88;
    reveals = reveals.filter((box) => {
      if (box.top > line) return true;
      untrackBox(box);
      const delay = Number(box.el.dataset.revealDelay || 0);
      setTimeout(() => {
        box.el.dataset.reveal = 'in';
      }, delay);
      return false;
    });
    scrambles = scrambles.filter((box) => {
      if (box.top > line) return true;
      untrackBox(box);
      // Only animate if it is actually on screen; skip ones jumped past.
      if (box.bottom > 0) bootHeading(box.el, 1000);
      return false;
    });
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
