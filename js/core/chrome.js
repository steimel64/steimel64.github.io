// Site chrome: header behaviour, mobile menu, HUD clock and scroll timecode,
// progress line. Page transitions live in transit.js.
import { onFrame, scroll, timecode } from './env.js';

export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let lastY = window.scrollY;
  onFrame(() => {
    const y = scroll.y;
    if (document.documentElement.classList.contains('menu-open')) return;
    if (Math.abs(y - lastY) < 6) return;
    header.classList.toggle('is-hidden', y > lastY && y > 240);
    lastY = y;
  });
}

export function initMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  const root = document.documentElement;
  const label = toggle.querySelector('.menu-toggle__label');
  const set = (open) => {
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? 'Close' : 'Menu';
    if (open) nav.querySelector('a')?.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', () => set(!root.classList.contains('menu-open')));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) {
      set(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => {
    if (e.matches) set(false);
  });
}

export function initHud() {
  const clock = document.querySelector('[data-hud-clock]');
  const tc = document.querySelector('[data-hud-tc]');
  const section = document.querySelector('[data-hud-section]');
  const progress = document.querySelector('.progress');

  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const update = () => {
      clock.textContent = `TYO ${fmt.format(new Date())} JST`;
    };
    update();
    setInterval(update, 1000);
  }

  // Scrolling a page scrubs a virtual reel the length of The Courier (101.56 s).
  const REEL = 101.56;
  let lastTc = '';
  onFrame(() => {
    if (progress) progress.style.setProperty('--progress', scroll.progress.toFixed(4));
    if (tc) {
      const text = `TC ${timecode(scroll.progress * REEL)}`;
      if (text !== lastTc) {
        tc.textContent = text;
        lastTc = text;
      }
    }
  });

  if (section) {
    const marks = document.querySelectorAll('[data-hud]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) section.textContent = entry.target.dataset.hud;
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    marks.forEach((m) => io.observe(m));
  }
}
