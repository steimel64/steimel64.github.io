// Trust run: the Engineering door's live graphic. A trust curve climbs from
// prototype to production through eight human gates. A swarm of agents works
// each stage (a few early on, a full swarm at build), led by the hanko seal,
// which stands for William. Each gate that passes lights up and the swarm
// streams along the curve to the next. Crossing the dashed threshold takes the
// system to production; at hand-off the seal stamps the last gate as sign-off
// and the swarm turns amber and moves into the client team's zone, where it
// keeps monitoring. Then the run fades and restarts.
// Canvas 2D, paused off screen; reduced motion gets the final frame, still.
import { onFrame, whileVisible, reducedMotion } from '../core/env.js';

const TRUST = [0.06, 0.13, 0.22, 0.36, 0.52, 0.7, 0.86, 1]; // trust after each gate: slow to earn, then compounding to 100% at hand-off
const SWARM = [4, 6, 10, 26, 64, 44, 20, 10]; // agents working each stage
const THRESHOLD = 0.8;
const WORK = 1.6; // seconds spent working each stage
const MOVE = 0.65; // seconds streaming to the next gate
const HOLD = 4.8; // seconds after hand-off before the run restarts
const FADE = 0.7; // last part of the hold, fading out
const STEP = 1 / 120; // physics step for the swarm

const COL = {
  grid: 'rgba(161, 155, 189, 0.10)',
  guide: 'rgba(161, 155, 189, 0.16)',
  label: 'rgba(161, 155, 189, 0.75)',
  dim: '#6f6990',
  trust: '#34f2df',
  agent: [255, 43, 209], // orchestrated by William
  team: [255, 178, 62], // owned by the client's team after hand-off
  seal: '#ff4030',
  gate: '#ff2bd1',
  threshold: '#ffb23e',
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t))).join(', ');

// A soft radial glow, drawn once and reused every frame.
function glowSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(1, `${color}00`); // same colour, fully transparent (hex with alpha)
  g.globalAlpha = 0.55;
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function initTrustRun({ wrap, canvas, stages, hud }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const N = stages.length;
  const total = N * WORK + (N - 1) * MOVE + HOLD;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let compact = false;
  let nodes = [];
  let plot = { left: 0, right: 0, top: 0, bottom: 0 };
  const yFor = (t) => plot.bottom - (plot.bottom - plot.top) * t;

  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    compact = w < 520;
    const inset = compact ? 16 : 30;
    const teamZone = compact ? 34 : 78; // room after the last gate for the client's team
    plot = { left: inset, right: w - inset - teamZone, top: compact ? 24 : 28, bottom: h - 26, edge: w - 8 }; // top leaves room for the seal above 100%
    nodes = TRUST.map((t, i) => ({ x: plot.left + (plot.right - plot.left) * (i / (N - 1)), y: yFor(t) }));
    paintBackdrop();
  };

  // Everything that never moves (grid, gate guides, the planned route) is
  // painted once per layout into an offscreen canvas and copied each frame.
  const backdrop = document.createElement('canvas');
  function paintBackdrop() {
    backdrop.width = canvas.width;
    backdrop.height = canvas.height;
    const g = backdrop.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const last = nodes[N - 1];
    g.lineWidth = 1;
    g.strokeStyle = COL.grid;
    g.beginPath();
    for (const t of [0.25, 0.5, 0.75]) {
      const y = Math.round(yFor(t)) + 0.5;
      g.moveTo(plot.left, y);
      g.lineTo(plot.edge, y);
    }
    g.moveTo(plot.left, plot.bottom + 0.5);
    g.lineTo(plot.edge, plot.bottom + 0.5);
    g.stroke();
    // Guides from each gate down to its label
    g.strokeStyle = COL.guide;
    g.beginPath();
    nodes.forEach((n) => {
      g.moveTo(Math.round(n.x) + 0.5, n.y + 6);
      g.lineTo(Math.round(n.x) + 0.5, plot.bottom);
    });
    g.stroke();
    // Planned route, faint and dashed
    g.setLineDash([2, 4]);
    g.strokeStyle = 'rgba(161, 155, 189, 0.28)';
    g.beginPath();
    g.moveTo(plot.left - 8, plot.bottom);
    nodes.forEach((n) => g.lineTo(n.x, n.y));
    g.lineTo(plot.edge, last.y);
    g.stroke();
  }

  // Agents orbit the swarm's head on loose ellipses and follow it with a spring.
  const MAX = Math.max(...SWARM);
  const agents = Array.from({ length: MAX }, () => ({
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    a: Math.random() * Math.PI * 2,
    r: 0.35 + Math.random() * 0.65,
    s: (0.7 + Math.random() * 1.5) * (Math.random() < 0.5 ? -1 : 1),
    life: 0,
  }));

  const state = (t) => {
    if (t >= total - HOLD) return { k: N - 1, phase: 'live', p: (t - (total - HOLD)) / HOLD };
    const k = Math.min(N - 1, Math.floor(t / (WORK + MOVE)));
    const local = t - k * (WORK + MOVE);
    if (local < WORK) return { k, phase: 'work', p: local / WORK };
    return { k, phase: 'move', p: (local - WORK) / MOVE };
  };

  const handP = (s) => (s.phase === 'live' ? ease(clamp01((s.p - 0.14) / 0.3)) : 0);
  const headAt = (s) => {
    if (s.phase === 'live') {
      const a = nodes[N - 1];
      const e = handP(s);
      return { x: lerp(a.x, (a.x + plot.edge) / 2 + 6, e), y: a.y + lerp(0, 4, e) };
    }
    if (s.phase === 'move') {
      const a = nodes[s.k];
      const b = nodes[s.k + 1];
      const e = ease(s.p);
      return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
    }
    return nodes[s.k];
  };

  // HUD text changes only when its value changes.
  const shown = { n: '', trust: '', agents: '', owner: '' };
  const setHud = (k, trust, count, live) => {
    const n = live ? 'live' : String(k + 1).padStart(2, '0');
    if (n !== shown.n) {
      shown.n = n;
      if (hud.n) hud.n.textContent = live ? 'Live' : n;
      if (hud.name) hud.name.textContent = live ? 'Handed off' : stages[k].name;
      if (hud.sub) hud.sub.textContent = live ? 'Your team owns it, with agents watching production' : stages[k].sub;
      if (hud.artifact) hud.artifact.textContent = live ? 'your team' : stages[k].artifact;
      wrap.classList.toggle('is-live', live);
    }
    const owner = live ? 'your team' : 'William';
    if (owner !== shown.owner) {
      shown.owner = owner;
      if (hud.owner) hud.owner.textContent = owner;
    }
    const tr = `${Math.round(trust * 100)}%`;
    if (tr !== shown.trust) {
      shown.trust = tr;
      if (hud.trust) hud.trust.textContent = tr;
    }
    const ag = String(count);
    if (ag !== shown.agents) {
      shown.agents = ag;
      if (hud.agents) hud.agents.textContent = ag;
    }
  };

  const font = (px) => `${px}px "Martian Mono", ui-monospace, monospace`;

  // The hanko seal (the clean version, sized for small marks), drawn as an image.
  const sealImg = new Image();
  sealImg.src = 'favicon.svg';

  // Glows are pre-drawn sprites and wide translucent strokes rather than
  // shadowBlur, which is slow on software-rendered canvases.
  const sealGlow = glowSprite(COL.seal);

  function drawSeal(x, y, r, scale, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(sealGlow, -r * 2.2, -r * 2.2, r * 4.4, r * 4.4);
    if (sealImg.complete && sealImg.naturalWidth) {
      const d = r * 2 * (64 / 60); // the seal's rim spans 60 of the image's 64 units
      ctx.drawImage(sealImg, -d / 2, -d / 2, d, d);
    } else {
      ctx.fillStyle = COL.seal;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // A neon line: a wide faint pass under the core stroke.
  function glowStroke(color) {
    ctx.strokeStyle = color;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.18;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalAlpha = a * 0.35;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = a;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw(s, head, trust, alpha, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const live = s.phase === 'live';
    const hp = handP(s);
    const last = nodes[N - 1];

    // The client team's zone after the last gate
    ctx.fillStyle = `rgba(${COL.team.join(', ')}, ${0.035 + 0.05 * hp})`;
    ctx.fillRect(last.x + 10, plot.top - 6, plot.edge - last.x - 10, plot.bottom - plot.top + 6);
    ctx.fillStyle = `rgba(${COL.team.join(', ')}, ${0.45 + 0.5 * hp})`;
    ctx.font = font(compact ? 8.5 : 9.5);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillText(compact ? 'team' : 'your team', plot.edge - 2, plot.bottom + 7);
    ctx.textAlign = 'left';

    // Grid, guides and planned route (static), then the production threshold
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    ctx.restore();
    ctx.lineWidth = 1;

    const crossed = trust >= THRESHOLD;
    const ty = Math.round(yFor(THRESHOLD)) + 0.5;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = COL.threshold;
    ctx.globalAlpha = crossed ? 0.95 : 0.4;
    ctx.beginPath();
    ctx.moveTo(plot.left, ty);
    ctx.lineTo(plot.edge, ty);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COL.threshold;
    ctx.globalAlpha = crossed ? 1 : 0.6;
    ctx.font = font(compact ? 8.5 : 9.5);
    ctx.textBaseline = 'bottom';
    const tl = compact ? 'production' : 'production threshold';
    ctx.fillText(tl, plot.left, ty - 3);
    ctx.globalAlpha = 1;

    // Trust curve so far
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(plot.left - 8, plot.bottom);
    for (let i = 0; i <= s.k; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
    if (s.phase === 'move') ctx.lineTo(head.x, head.y);
    glowStroke(COL.trust);
    if (hp > 0) {
      // After hand-off the line carries on, in the team's colour, to the edge.
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(lerp(last.x, plot.edge, hp), last.y);
      glowStroke(`rgb(${COL.team.join(', ')})`);
    }
    ctx.restore();

    // Gates
    const passedCount = s.phase === 'work' ? s.k : s.phase === 'move' ? s.k + 1 : N;
    nodes.forEach((n, i) => {
      const done = i < passedCount;
      const active = s.phase === 'work' && i === s.k;
      const size = active ? 6.5 : 5;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(Math.PI / 4);
      if (active) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 180);
        ctx.strokeStyle = COL.gate;
        ctx.globalAlpha = 0.25 + pulse * 0.35;
        ctx.strokeRect(-size - 4, -size - 4, (size + 4) * 2, (size + 4) * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = done ? COL.trust : '#0d0b16';
      ctx.strokeStyle = done ? COL.trust : active ? COL.gate : COL.dim;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = done ? alpha : 1;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
    });

    // Stage labels
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = font(compact ? 9 : 9.5);
    nodes.forEach((n, i) => {
      const done = i < passedCount;
      const active = s.phase === 'work' && i === s.k;
      ctx.fillStyle = active ? COL.gate : done ? COL.trust : COL.label;
      const text = compact ? String(i + 1).padStart(2, '0') : stages[i].name.toUpperCase();
      ctx.fillText(text, n.x, plot.bottom + 7);
    });
    ctx.textAlign = 'left';

    // Agents: short streaks, additive
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // One colour per frame; each agent's fade goes through globalAlpha, which
    // is far cheaper than parsing a new rgba() string per agent.
    const rgb = `rgb(${mix(COL.agent, COL.team, hp)})`;
    ctx.strokeStyle = rgb;
    ctx.fillStyle = rgb;
    ctx.lineWidth = 1.4;
    for (const a of agents) {
      if (a.life <= 0.01) continue;
      const o = a.life * alpha;
      ctx.globalAlpha = 0.55 * o;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
      ctx.globalAlpha = 0.95 * o;
      ctx.fillRect(a.x - 1.2, a.y - 1.2, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // The seal leads the swarm, a little above it; at hand-off it stamps the
    // last gate (a quick press, like a hanko on a sign-off) and stays there.
    const r = compact ? 6 : 7.5;
    const lift = compact ? 15 : 19;
    if (live) {
      const sp = clamp01(s.p / 0.12);
      const e = ease(sp);
      const press = sp < 1 ? 1 + 0.7 * Math.sin(sp * Math.PI) : 1;
      drawSeal(last.x, last.y - lift * (1 - e), r, press, alpha);
    } else {
      drawSeal(head.x, head.y - lift, r, 1, alpha);
    }
  }

  layout();
  new ResizeObserver(() => {
    layout();
    if (reducedMotion()) still();
  }).observe(canvas);

  function scatter(head, spread) {
    agents.forEach((a) => {
      a.x = a.px = head.x + (Math.random() - 0.5) * spread;
      a.y = a.py = head.y + (Math.random() - 0.5) * spread;
      a.vx = a.vy = 0;
    });
  }

  function still() {
    const s = { k: N - 1, phase: 'live', p: 0.6 };
    const head = headAt(s);
    const R = Math.min(34, (plot.right - plot.left) * 0.06);
    agents.forEach((a, i) => {
      a.life = i < SWARM[N - 1] ? 1 : 0;
      const ang = (i / SWARM[N - 1]) * Math.PI * 2;
      a.x = a.px = head.x + Math.cos(ang) * R * a.r * 1.1;
      a.y = a.py = head.y + 4 + Math.sin(ang) * R * a.r * 0.6;
    });
    draw(s, head, TRUST[N - 1], 1, 0);
    setHud(N - 1, TRUST[N - 1], SWARM[N - 1], true);
  }

  if (reducedMotion()) {
    still();
    return;
  }

  let visible = false;
  whileVisible(wrap, (v) => {
    visible = v;
  });
  let t = 0;
  let last = performance.now();
  let trustShown = 0;
  scatter(nodes[0], 20);

  onFrame((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !w) return;
    t += dt;
    if (t >= total) {
      t = 0;
      trustShown = 0;
      scatter(nodes[0], 20);
      agents.forEach((a) => {
        a.life = 0;
      });
    }

    const s = state(t);
    const head = headAt(s);
    const passedCount = s.phase === 'work' ? s.k : s.k + 1;
    const target = s.phase === 'live' ? TRUST[N - 1] : passedCount ? TRUST[passedCount - 1] : 0.02;
    trustShown += (target - trustShown) * Math.min(1, dt * 6);
    if (Math.abs(target - trustShown) < 0.004) trustShown = target;
    const alpha =
      s.phase === 'live' && s.p > 1 - FADE / HOLD ? Math.max(0, 1 - (s.p - (1 - FADE / HOLD)) / (FADE / HOLD)) : 1;

    // Swarm size for this moment (blends while moving between stages)
    const count = s.phase === 'move' ? Math.round(lerp(SWARM[s.k], SWARM[s.k + 1], s.p)) : SWARM[s.k];
    // Bigger swarms spread wider; moving swarms tighten up to stream along the curve.
    const zone = (plot.edge - nodes[N - 1].x) * 0.42;
    const R =
      s.phase === 'live'
        ? lerp(Math.min(46, (plot.right - plot.left) * 0.075) * 0.7, Math.min(zone, 30), handP(s))
        : Math.min(46, (plot.right - plot.left) * 0.075) *
          (0.55 + 0.45 * Math.sqrt(count / MAX)) *
          (s.phase === 'work' ? 1.25 : 0.6);
    const spin = s.phase === 'work' ? 2.4 : s.phase === 'live' ? 1.6 : 1.2;
    agents.forEach((a, i) => {
      const on = i < count;
      a.life = Math.max(0, Math.min(1, a.life + (on ? dt * 3 : -dt * 2.5)));
      if (a.life <= 0) {
        a.x = a.px = head.x;
        a.y = a.py = head.y;
        a.vx = a.vy = 0;
        return;
      }
      a.a += a.s * spin * dt;
      // Orbit around the gate so the curve and gate stay readable. The spring
      // runs in small fixed steps so a slow frame can't make it overshoot.
      const tx = head.x + Math.cos(a.a) * R * a.r * 1.35;
      const ty = head.y + 4 + Math.sin(a.a) * R * a.r * 0.7;
      a.px = a.x;
      a.py = a.y;
      for (let left = dt; left > 0; left -= STEP) {
        const d = Math.min(STEP, left);
        a.vx += ((tx - a.x) * 38 - a.vx * 7.5) * d + (Math.random() - 0.5) * 30 * d;
        a.vy += ((ty - a.y) * 38 - a.vy * 7.5) * d + (Math.random() - 0.5) * 30 * d;
        a.x += a.vx * d;
        a.y += a.vy * d;
      }
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) {
        a.x = a.px = head.x;
        a.y = a.py = head.y;
        a.vx = a.vy = 0;
      }
    });

    draw(s, head, trustShown, alpha, now);
    setHud(s.k, trustShown, count, s.phase === 'live');
  });
}
