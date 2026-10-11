// Ambient neon rain in the side gutters, so reading columns stay clear. It
// speeds up and lengthens with scroll speed and runs in two modes set per page
// with <main data-ambient>:
//   loud  art pages: magenta / cyan / vermilion streaks plus slow bokeh
//   calm  engineering pages: sparse cyan "data rain", nothing else
//
// Only the two gutter strips are drawn (two narrow canvases), and the fade
// toward the centre is applied per streak, so no full-screen layer or CSS mask
// has to be composited every frame.
import { onFrame, scroll, reducedMotion, lerp } from './env.js';

const PALETTE = {
  loud: ['255, 43, 209', '52, 242, 223', '255, 64, 48'],
  calm: ['52, 242, 223'],
};
const GUTTER = 0.16; // share of the viewport width on each side
// Opacity by distance from the screen edge (share of viewport width).
const fade = (d) => (d < 0.07 ? 1 - (d / 0.07) * 0.55 : Math.max(0, 0.45 * (1 - (d - 0.07) / (GUTTER - 0.07))));

// Soft round sprites for the bokeh, drawn once per colour.
function sprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb}, 1)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function initAmbient() {
  if (reducedMotion()) return;
  const mode = document.querySelector('[data-page]')?.dataset.ambient === 'loud' ? 'loud' : 'calm';
  const sides = ['left', 'right'].map((side) => {
    const canvas = document.createElement('canvas');
    canvas.className = `ambient ambient--${side}`;
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    return { side, canvas, ctx: canvas.getContext('2d') };
  });
  if (sides.some((s) => !s.ctx)) return;

  let vw = 0;
  let gw = 0;
  let h = 0;
  const resize = () => {
    vw = innerWidth;
    gw = Math.ceil(vw * GUTTER);
    h = innerHeight;
    sides.forEach((s) => {
      s.canvas.width = gw;
      s.canvas.height = h;
    });
  };
  resize();
  window.addEventListener('resize', resize);

  const colors = PALETTE[mode];
  const loud = mode === 'loud';
  const mobile = vw < 760;
  // Same density as rain across the whole width, counting only what shows.
  const count = Math.round((loud ? 36 : 14) * (mobile ? 0.4 : 1));
  const spawn = (d, initial) => {
    const edge = Math.random() * GUTTER; // distance from the outer edge
    Object.assign(d, {
      edge,
      y: initial ? Math.random() * h : -Math.random() * h * 0.4,
      len: 18 + Math.random() * (loud ? 90 : 50),
      speed: (loud ? 2.2 : 1.4) + Math.random() * (loud ? 4 : 2),
      c: colors[Math.floor(Math.random() * colors.length)],
      a: ((loud ? 0.18 : 0.12) + Math.random() * (loud ? 0.4 : 0.22)) * fade(edge),
      lw: Math.random() < 0.12 ? 2 : 1,
    });
    return d;
  };
  const drops = Array.from({ length: count }, (_, i) => spawn({ side: i % 2 }, true));
  const sprites = Object.fromEntries(colors.map((c) => [c, sprite(c)]));
  const bokeh =
    loud && !mobile
      ? Array.from({ length: 4 }, (_, i) => {
          const edge = Math.random() * GUTTER * 0.8;
          return {
            side: i % 2,
            edge,
            y: Math.random() * h,
            r: 20 + Math.random() * 60,
            vy: -0.05 - Math.random() * 0.15,
            c: colors[Math.floor(Math.random() * colors.length)],
            a: (0.03 + Math.random() * 0.05) * fade(edge),
          };
        })
      : [];
  // Canvas x for a distance from the screen edge on a given side.
  const xFor = (side, edge) => (side === 0 ? edge * vw : gw - edge * vw);

  let boost = 1;
  let last = performance.now();
  onFrame((now) => {
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    if (document.visibilityState !== 'visible') return;
    // Scrolling either way speeds the rain up and stretches the streaks.
    boost = lerp(boost, 1 + Math.min(5, Math.abs(scroll.velocity) * 0.12), 0.1);
    for (const s of sides) {
      s.ctx.clearRect(0, 0, gw, h);
      s.ctx.globalCompositeOperation = 'lighter';
    }

    for (const b of bokeh) {
      b.y += b.vy * dt * boost;
      if (b.y < -b.r) b.y = h + b.r;
      const { ctx } = sides[b.side];
      ctx.globalAlpha = b.a;
      ctx.drawImage(sprites[b.c], xFor(b.side, b.edge) - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    for (const d of drops) {
      d.y += d.speed * boost * dt;
      const len = d.len * (0.7 + boost * 0.3);
      if (d.y - len > h) spawn(d, false);
      const { ctx } = sides[d.side];
      const x = xFor(d.side, d.edge);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${d.c}, ${d.a})`;
      ctx.lineWidth = d.lw;
      ctx.beginPath();
      ctx.moveTo(x, d.y - len);
      ctx.lineTo(x, d.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${d.c}, ${Math.min(1, d.a * 2)})`;
      ctx.fillRect(x - d.lw / 2, d.y - 1, d.lw + 0.5, 2);
    }
  });
}
