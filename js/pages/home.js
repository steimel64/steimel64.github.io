// Home: the film-shader hero and its cycling roles, the scroll-lit statement, the three practices
// (the Engineering panel runs the trust-run graphic; the studio clip plays only
// on screen) and the Background timeline, whose line draws in as it scrolls past.
import { initHeroFilm } from '../gl/hero-film.js';
import { onFrame, reducedMotion, whileVisible, clamp, trackBox, changed, wait } from '../core/env.js';
import { autoplayClips } from '../core/media.js';
import { scramble } from '../core/scramble.js';
import { initTrustRun } from '../fx/trust-run.js';

export function init() {
  hero();
  roles();
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

// The artist half of the hero line cycles through roles. Each one holds, pulses
// into its katakana reading, then scrambles into the next role. The cycle waits
// while the hero is off screen or the tab is hidden.
// About 2.6 s per role, the original cadence.
const ROLE_HOLD = 1200;
const KANA_HOLD = 600;
const SCRAMBLE_IN = 380;
const SCRAMBLE_OUT = 420;
function roles() {
  const el = document.querySelector('[data-roles]');
  if (!el || reducedMotion()) return;
  let list;
  try {
    list = JSON.parse(el.dataset.roles);
  } catch {
    return;
  }
  if (list.length < 2) return;

  let visible = true;
  let resume = null;
  whileVisible(
    el,
    (v) => {
      visible = v;
      if (v && resume) resume();
    },
    '0px',
  );
  const hold = async (ms) => {
    await wait(ms);
    while (!visible) await new Promise((r) => (resume = r));
    resume = null;
  };

  (async () => {
    for (let i = 0; ; i = (i + 1) % list.length) {
      await hold(ROLE_HOLD);
      el.classList.add('is-kana');
      await scramble(el, list[i][1], { duration: SCRAMBLE_IN });
      await hold(KANA_HOLD);
      el.classList.remove('is-kana');
      await scramble(el, list[(i + 1) % list.length][0], { duration: SCRAMBLE_OUT });
    }
  })();
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
  const r = trackBox(el);
  const seen = {};
  onFrame(() => {
    if (!visible || !changed(seen)) return;
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
  const r = trackBox(el);
  const marks = entries.map((e) => ({ e, box: trackBox(e) }));
  const seen = {};
  onFrame(() => {
    if (!visible || !changed(seen)) return;
    const mark = innerHeight * 0.7;
    line.style.setProperty('--p', clamp((mark - r.top) / r.height, 0, 1).toFixed(3));
    marks.forEach(({ e, box }) => e.classList.toggle('is-active', box.top < mark));
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
