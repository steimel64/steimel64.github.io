// First-visit boot screen: a short countdown with the hanko seal, then wipes away.
// Shown once per browser session and never with reduced motion.
import { reducedMotion, session } from './env.js';

const TOTAL = 100;

export function boot() {
  if (reducedMotion() || session.get('steimel:booted')) return Promise.resolve(false);
  session.set('steimel:booted', '1');

  const el = document.createElement('div');
  el.className = 'boot';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="boot__frame">
      <span class="boot__slot"></span>
      <span class="tc muted">STEIMEL / TOKYO</span>
      <span class="boot__count">000</span>
      <div class="boot__bar"><i></i></div>
      <div class="boot__cap tc"><span>loading</span><span>TYO JST</span></div>
    </div>`;
  document.body.append(el);
  // Stamp the hanko seal from the header onto the boot screen.
  const seal = document.querySelector('.brand__mark')?.cloneNode(true);
  if (seal) {
    seal.setAttribute('class', 'boot__seal');
    el.querySelector('.boot__slot').replaceWith(seal);
  } else el.querySelector('.boot__slot').remove();
  const count = el.querySelector('.boot__count');
  const bar = el.querySelector('.boot__bar');

  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 1150;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      count.textContent = String(Math.round(eased * TOTAL)).padStart(3, '0');
      bar.style.setProperty('--p', eased);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      el.classList.add('is-done');
      setTimeout(() => resolve(true), 350);
      setTimeout(() => el.remove(), 900);
    };
    requestAnimationFrame(step);
  });
}
