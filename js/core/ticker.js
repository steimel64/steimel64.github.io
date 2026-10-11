// Marquee that drifts at a steady speed. The motion itself is a CSS animation
// on the compositor, so it stays smooth even while the main thread is busy;
// this script only sizes its duration to the text and pauses it off screen.
import { reducedMotion, whileVisible } from './env.js';

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

    // data-ticker is the speed in pixels per 60 Hz frame.
    const speed = (Number(ticker.dataset.ticker) || 0.6) * 60;
    const size = () => {
      const width = group.offsetWidth;
      if (width) track.style.setProperty('--ticker-duration', `${(width / speed).toFixed(2)}s`);
    };
    size();
    new ResizeObserver(size).observe(group);
    whileVisible(ticker, (visible) => ticker.classList.toggle('is-paused', !visible));
  });
}
