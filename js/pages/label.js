// AI record label page (first act: LUNA.EXE): procedural moon, a terminal
// boot that glitches the title and pulses the moon, and lyric videos that load
// the YouTube player only when someone presses play.
import { initMoon } from '../gl/moon.js';
import { reducedMotion, wait } from '../core/env.js';

let moon = { pulse() {} };

export function init() {
  const section = document.querySelector('.luna-hero');
  const canvas = section?.querySelector('canvas');
  if (section && canvas) moon = initMoon({ section, canvas });
  lyricVideos();
}

// Thumbnail links become the YouTube player on click. YouTube's privacy-
// enhanced domain sets no cookies until the video plays.
function lyricVideos() {
  document.querySelectorAll('[data-yt]').forEach((link) => {
    const id = link.dataset.yt;
    // Once the (lazy) thumbnail is near the screen, upgrade it to the HD one
    // when the video has it; YouTube serves a 120px placeholder otherwise.
    const thumb = link.querySelector('img');
    thumb.addEventListener('error', () => thumb.remove(), { once: true }); // keep the gradient, not a broken image
    const upgrade = () => {
      const hd = new Image();
      hd.onload = () => {
        if (hd.naturalWidth > 120) thumb.src = hd.src;
      };
      hd.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    };
    if (thumb.complete && thumb.naturalWidth) upgrade();
    else thumb.addEventListener('load', upgrade, { once: true });

    link.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      frame.title = link.dataset.title;
      frame.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      link.replaceWith(frame);
      frame.focus();
    });
  });
}

export async function intro() {
  const term = document.querySelector('[data-terminal]');
  const title = document.querySelector('.luna-title');
  if (!term) return;
  const lines = JSON.parse(term.dataset.terminal);
  if (reducedMotion()) {
    term.innerHTML = lines
      .map((l) => escape(l.text) + (l.ok ? ` <span class="ok">${escape(l.ok)}</span>` : ''))
      .join('\n');
    return;
  }
  term.textContent = '';
  for (const line of lines) {
    const row = document.createElement('span');
    term.append(row);
    for (let i = 1; i <= line.text.length; i++) {
      row.textContent = line.text.slice(0, i);
      await wait(14);
    }
    if (line.ok) {
      await wait(160);
      const ok = document.createElement('span');
      ok.className = 'ok';
      ok.textContent = ` ${line.ok}`;
      row.append(ok);
    }
    term.append('\n');
    await wait(90);
  }
  const caret = document.createElement('span');
  caret.className = 'caret';
  term.append(caret);
  title?.classList.add('is-glitching');
  moon.pulse(1.4);
  title?.addEventListener('animationend', () => title.classList.remove('is-glitching'), { once: true });
}

function escape(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}
