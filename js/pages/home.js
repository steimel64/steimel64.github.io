// Home: the film-shader hero, the scroll-lit statement, the three practices
// (the Engineering panel runs the trust-run graphic; the studio clip plays only
// on screen) and the Background timeline, whose line draws in as it scrolls past.
import { initHeroFilm } from '../gl/hero-film.js';
import { onFrame, reducedMotion, whileVisible, clamp } from '../core/env.js';
import { autoplayClips } from '../core/media.js';
import { initTrustRun } from '../fx/trust-run.js';

export function init() {
  hero();
  statement();
  autoplayClips();
  flow();
  log();
}

function hero() {
  const section = document.querySelector('.hero');
  if (!section) return;
  const video = section.querySelector('video');
  const canvas = section.querySelector('canvas');
  if (reducedMotion()) {
    // Keep the still; stop the autoplaying loop from downloading and playing.
    canvas?.remove();
    video.removeAttribute('autoplay');
    video.pause();
    video.preload = 'none';
    return;
  }
  section.querySelector('.hero__still')?.remove();
  initHeroFilm({ section, canvas, video });
}

// Words light up as the statement scrolls through the middle of the screen.
// Only their colour changes; nothing moves.
function statement() {
  const el = document.querySelector('[data-lit]');
  if (!el) return;
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            return;
          }
          const s = document.createElement('span');
          s.className = 'w' + (node.classList?.contains('hot') ? ' w--hot' : '');
          s.textContent = part;
          frag.append(s);
          words.push(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    });
  };
  walk(el);
  if (reducedMotion()) {
    words.forEach((w) => w.classList.add('is-lit'));
    return;
  }

  let visible = false;
  whileVisible(
    el,
    (v) => {
      visible = v;
    },
    '200px',
  );
  let last = -1;
  onFrame(() => {
    if (!visible) return;
    const r = el.getBoundingClientRect();
    const p = clamp((innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.35), 0, 1);
    const n = Math.round(p * words.length);
    if (n === last) return;
    words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
    last = n;
  });
}

// Background timeline: the line fills and each marker lights as it passes the
// lower third of the screen. Nothing moves except the line growing.
function log() {
  const el = document.querySelector('[data-log]');
  if (!el) return;
  const line = el.querySelector('.log__line');
  const entries = [...el.querySelectorAll('.log__entry')];
  if (reducedMotion()) {
    line.style.setProperty('--p', '1');
    entries.forEach((e) => e.classList.add('is-active'));
    return;
  }
  let visible = false;
  whileVisible(
    el,
    (v) => {
      visible = v;
    },
    '100px',
  );
  onFrame(() => {
    if (!visible) return;
    const r = el.getBoundingClientRect();
    const mark = innerHeight * 0.7;
    line.style.setProperty('--p', clamp((mark - r.top) / r.height, 0, 1).toFixed(3));
    entries.forEach((e) => e.classList.toggle('is-active', e.getBoundingClientRect().top < mark));
  });
}

// Engineering door: the trust run (curve, gates and agent swarm) lives in its
// own module; the stage names and descriptions come from the list in the page.
function flow() {
  const wrap = document.querySelector('[data-flow]');
  if (!wrap) return;
  initTrustRun({
    wrap,
    canvas: wrap.querySelector('.flow__canvas'),
    stages: [...wrap.querySelectorAll('.flow__list li')].map((li) => ({
      name: li.dataset.name,
      sub: li.dataset.sub,
      artifact: li.dataset.artifact,
    })),
    hud: {
      n: wrap.querySelector('[data-flow-n]'),
      name: wrap.querySelector('[data-flow-name]'),
      sub: wrap.querySelector('[data-flow-sub]'),
      trust: wrap.querySelector('[data-flow-trust]'),
      agents: wrap.querySelector('[data-flow-agents]'),
      owner: wrap.querySelector('[data-flow-owner]'),
      artifact: wrap.querySelector('[data-flow-artifact]'),
    },
  });
}
