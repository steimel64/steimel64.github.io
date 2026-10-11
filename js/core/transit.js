// Page transitions. Leaving: scanline strips sweep across in a shuffled
// order, the hanko seal stamps and the destination decodes. Arriving: the page
// starts covered (set before first paint by the inline head script) and the
// strips sweep away. A CSS fail-safe uncovers the page if scripts never run.
import { reducedMotion, session } from './env.js';
import { scramble } from './scramble.js';

const STRIPS = 14;
const PAGES = {
  '': 'Home',
  'index.html': 'Home',
  'engineering.html': 'Engineering',
  'artistry.html': 'AI Film Studio',
  'label.html': 'Label',
  'contact.html': 'Contact',
};

function build() {
  let el = document.querySelector('.transit');
  if (!el) {
    el = document.createElement('div');
    el.className = 'transit';
    el.setAttribute('aria-hidden', 'true');
    document.body.prepend(el);
  }
  if (el.dataset.built) return el;
  const order = [...Array(STRIPS).keys()].sort(() => Math.random() - 0.5);
  el.innerHTML =
    Array.from({ length: STRIPS }, (_, i) => `<i style="--i:${i};--o:${order[i]}"></i>`).join('') +
    '<div class="transit__center"><span class="transit__slot"></span><span class="transit__label tc"></span></div>';
  const seal = document.querySelector('.brand__mark')?.cloneNode(true);
  const slot = el.querySelector('.transit__slot');
  if (seal) {
    seal.setAttribute('class', 'transit__mark');
    slot.replaceWith(seal);
  } else slot.remove();
  el.dataset.built = '1';
  return el;
}

export function initTransit() {
  const root = document.documentElement;
  if (reducedMotion()) {
    root.classList.remove('is-arriving');
    return;
  }
  const el = build();

  // Arrival: strips are already covering; sweep them out to the right.
  if (root.classList.contains('is-arriving')) {
    el.classList.add('is-covered');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        root.classList.remove('is-arriving');
        el.classList.remove('is-covered');
        el.classList.add('is-out');
        setTimeout(() => el.classList.remove('is-out'), 950);
      }),
    );
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    const here = (path) => path.replace(/index\.html$/, '');
    if (here(url.pathname) === here(location.pathname)) {
      // Same page: no transition and no reload, just return to the top or the anchor.
      if (!url.hash) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
      return;
    }
    e.preventDefault();
    const file = url.pathname.split('/').pop();
    const label = el.querySelector('.transit__label');
    label.textContent = '';
    el.classList.remove('is-out', 'is-covered');
    el.classList.add('is-in');
    scramble(label, `→ ${PAGES[file] ?? file}`, { duration: 380 });
    session.set('steimel:transit', '1');
    setTimeout(() => {
      location.href = url.href;
    }, 560);
  });

  // Coming back through the back/forward cache: drop any leftover cover.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) el.classList.remove('is-in', 'is-covered', 'is-out');
  });
}
