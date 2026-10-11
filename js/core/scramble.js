// Decode-style text scramble. Screen readers get the final text immediately;
// the animated copy is aria-hidden.
import { reducedMotion } from './env.js';

const GLYPHS = 'アイウエオカキクケコサシスセソ01<>/\\[]{}=+*#%&';

function prepare(el) {
  if (el._scramble) return el._scramble;
  const text = el.dataset.text || el.textContent.trim();
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  vis.textContent = text;
  el.append(sr, vis);
  el._scramble = { sr, vis, text, raf: 0 };
  return el._scramble;
}

export function scramble(el, nextText, { duration = 900, glyphClass = 'scramble__glyph' } = {}) {
  const state = prepare(el);
  const from = state.vis.textContent;
  const to = nextText ?? state.text;
  state.sr.textContent = to;
  if (reducedMotion()) {
    state.vis.textContent = to;
    return Promise.resolve();
  }

  cancelAnimationFrame(state.raf);
  // Time-based (not frame-based) so slow devices finish on schedule.
  const len = Math.max(from.length, to.length);
  const queue = [];
  for (let i = 0; i < len; i++) {
    const start = Math.random() * 0.45;
    const end = start + 0.3 + Math.random() * 0.25;
    queue.push({ from: from[i] || '', to: to[i] || '', start, end, glyph: '' });
  }

  // One span per character, created once and updated in place each frame
  // (only the cells whose character changes are touched).
  const cells = queue.map((q) => {
    const cell = document.createElement('span');
    cell.textContent = q.from;
    return cell;
  });
  state.vis.replaceChildren(...cells);
  const isGlyph = cells.map(() => false);

  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / duration;
      if (t >= 1) {
        state.vis.textContent = to;
        resolve();
        return;
      }
      queue.forEach((q, i) => {
        let ch = q.from;
        let glyph = false;
        if (t >= q.end) ch = q.to;
        else if (t >= q.start) {
          if (!q.glyph || Math.random() < 0.3)
            q.glyph = q.to === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ch = q.glyph;
          glyph = true;
        }
        const cell = cells[i];
        if (cell.textContent !== ch) cell.textContent = ch;
        if (isGlyph[i] !== glyph) {
          cell.className = glyph ? glyphClass : '';
          isGlyph[i] = glyph;
        }
      });
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  });
}

// Scramble on hover for nav links and small labels.
export function scrambleOnHover(root = document) {
  if (reducedMotion()) return;
  root.querySelectorAll('[data-scramble-hover]').forEach((el) => {
    const target = el.querySelector('.label') || el;
    let busy = false;
    el.addEventListener('pointerenter', async () => {
      if (busy) return;
      busy = true;
      await scramble(target, undefined, { duration: 450 });
      busy = false;
    });
  });
}
