// Frame corridor: stills from The Courier hang at different depths in 3D
// space; scrolling flies the camera forward through them. Frames fade in from
// the dark and fade out as they pass the lens. Off with reduced motion, where
// the same frames sit in a plain grid.
import { onFrame, clamp, reducedMotion, whileVisible, trackBox, changed } from '../core/env.js';

export function initCorridor(section) {
  if (reducedMotion()) return;
  const frames = [...section.querySelectorAll('.corridor__frame')];
  const title = section.querySelector('.corridor__title');
  const meta = section.querySelector('[data-corridor-tc]');
  section.classList.add('is-live');

  const SPACING = 900;
  const depth = frames.map((f, i) => ({
    f,
    z0: -i * SPACING - 400,
    x: Number(f.dataset.x || 0),
    y: Number(f.dataset.y || 0),
    tc: f.dataset.tc || '',
  }));
  const travel = frames.length * SPACING + 400;
  let visible = false;
  whileVisible(
    section,
    (v) => {
      visible = v;
    },
    '100px',
  );
  let lastTc = '';
  const box = trackBox(section);
  const seen = {};

  onFrame(() => {
    if (!visible) return;
    if (!changed(seen)) return; // nothing moved: the frames are already in place
    const r = box;
    const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
    const cam = p * travel;
    const narrow = innerWidth < 760;
    let nearest = null;
    // Keep frames dim while the title is up, so nothing busy sits behind text.
    const titleO = clamp(1 - p * 7, 0, 1);
    for (const d of depth) {
      const z = d.z0 + cam;
      const fadeIn = clamp((z + 3600) / 1800, 0, 1);
      const fadeOut = clamp(1 - (z - 120) / 380, 0, 1);
      const x = d.x * (narrow ? 0.35 : 1);
      d.f.style.transform = `translate(-50%, -50%) translate3d(${x}vw, ${d.y}vh, ${z}px)`;
      d.f.style.opacity = String(Math.min(fadeIn, fadeOut) * (1 - titleO * 0.85));
      d.f.style.visibility = fadeOut <= 0 ? 'hidden' : 'visible';
      if (z < 200 && (!nearest || z > nearest.z)) nearest = { z, tc: d.tc };
    }
    if (title) title.style.opacity = String(titleO);
    const tc = nearest ? nearest.tc : '';
    if (meta && tc !== lastTc) {
      meta.textContent = tc;
      lastTc = tc;
    }
  });
}
