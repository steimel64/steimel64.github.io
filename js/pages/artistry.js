// AI Film Studio: custom film player with chapter scrubber, the 3D frame
// corridor and the scroll-drawn process.
import { onFrame, clamp, reducedMotion, whileVisible, timecode, trackBox, changed } from '../core/env.js';
import { autoplayClips } from '../core/media.js';
import { initCorridor } from '../fx/corridor.js';

const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
  sound:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="currentColor" fill="none" stroke-width="1.3"/></svg>',
  muted:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.3"/></svg>',
  full: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>',
};

export function init() {
  player();
  pipeline();
  autoplayClips();
  const corridor = document.querySelector('[data-corridor]');
  if (corridor) initCorridor(corridor);
}

/* Player ---------------------------------------------------------------- */
function player() {
  const root = document.querySelector('[data-player]');
  if (!root) return;
  const video = root.querySelector('video');
  const big = root.querySelector('.player__big');
  const btnPlay = root.querySelector('[data-act="play"]');
  const btnMute = root.querySelector('[data-act="mute"]');
  const btnFull = root.querySelector('[data-act="full"]');
  const range = root.querySelector('.scrub input');
  const segWrap = root.querySelector('.scrub__chapters');
  const time = root.querySelector('.player__time');
  const chapters = [...document.querySelectorAll('[data-chapter]')].map((el) => ({
    el,
    start: Number(el.dataset.start),
    end: Number(el.dataset.end),
    color: el.style.getPropertyValue('--c'),
  }));
  const duration = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number(range.max));

  btnPlay.innerHTML = ICON.play;
  btnMute.innerHTML = ICON.sound;
  btnFull.innerHTML = ICON.full;

  // Chapter segments drawn behind the range input.
  const segs = chapters.map((c) => {
    const i = document.createElement('i');
    i.style.flex = String(c.end - c.start);
    if (c.color) i.style.setProperty('--c', c.color);
    segWrap.append(i);
    return i;
  });

  const render = () => {
    const t = video.currentTime;
    if (!range.matches(':active')) range.value = String(t);
    range.setAttribute('aria-valuetext', `${Math.floor(t / 60)} minutes ${Math.floor(t % 60)} seconds`);
    time.textContent = timecode(t);
    chapters.forEach((c, i) => {
      const fill = clamp((t - c.start) / (c.end - c.start), 0, 1);
      segs[i].style.setProperty('--fill', fill.toFixed(4));
      c.el.classList.toggle('is-current', t >= c.start && t < c.end && root.classList.contains('has-started'));
    });
  };

  const setPlaying = (playing) => {
    root.classList.toggle('is-playing', playing);
    root.classList.toggle('is-paused', !playing);
    btnPlay.innerHTML = playing ? ICON.pause : ICON.play;
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  const toggle = () => (video.paused ? video.play() : (video.pause(), Promise.resolve())).catch(() => {});

  video.addEventListener('play', () => {
    root.classList.add('has-started');
    setPlaying(true);
  });
  video.addEventListener('pause', () => setPlaying(false));
  video.addEventListener('ended', () => setPlaying(false));
  video.addEventListener('loadedmetadata', () => {
    range.max = String(duration());
    render();
  });
  video.addEventListener('timeupdate', render);
  video.addEventListener('volumechange', () => {
    btnMute.innerHTML = video.muted ? ICON.muted : ICON.sound;
    btnMute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
  });
  video.addEventListener('click', toggle);
  big.addEventListener('click', () => {
    video.muted = false;
    video.play().catch(() => {});
  });
  btnPlay.addEventListener('click', toggle);
  btnMute.addEventListener('click', () => {
    video.muted = !video.muted;
  });
  btnFull.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else (root.requestFullscreen?.() || Promise.reject()).catch(() => video.webkitEnterFullscreen?.());
  });
  range.addEventListener('input', () => {
    video.currentTime = Number(range.value);
    render();
  });

  root.addEventListener('keydown', (e) => {
    if (e.target === range && e.key.startsWith('Arrow')) return;
    if (e.key === ' ' || e.key === 'k') {
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') {
      video.currentTime = Math.min(duration(), video.currentTime + 5);
    } else if (e.key === 'ArrowLeft') {
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.key === 'm') {
      video.muted = !video.muted;
    }
  });

  // Smooth timecode while playing.
  onFrame(() => {
    if (!video.paused) render();
  });

  // Chapter cards seek and play; their preview clip plays on hover.
  chapters.forEach((c) => {
    const clip = c.el.querySelector('video');
    c.el.addEventListener('click', () => {
      video.currentTime = c.start + 0.05;
      video.muted = false;
      video.play().catch(() => {});
      root.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    });
    if (clip && !reducedMotion()) {
      c.el.addEventListener('pointerenter', () => clip.play().catch(() => {}));
      c.el.addEventListener('pointerleave', () => clip.pause());
      c.el.addEventListener('focus', () => clip.play().catch(() => {}));
      c.el.addEventListener('blur', () => clip.pause());
    }
  });
  render();
}

/* Pipeline drawn by scroll --------------------------------------------- */
function pipeline() {
  const el = document.querySelector('[data-pipeline]');
  if (!el) return;
  const line = el.querySelector('.pipeline__line');
  const steps = [...el.querySelectorAll('.step')];
  if (reducedMotion()) {
    line.style.setProperty('--p', '1');
    steps.forEach((s) => s.classList.add('is-active'));
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
  const box = trackBox(el);
  const seen = {};
  onFrame(() => {
    if (!visible) return;
    if (!changed(seen)) return;
    const r = box;
    const p = clamp((innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.2), 0, 1);
    line.style.setProperty('--p', p.toFixed(3));
    steps.forEach((s, i) => s.classList.toggle('is-active', p >= (i / steps.length) * 0.98 + 0.02));
  });
}
