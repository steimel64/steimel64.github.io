// Shared environment helpers: motion preferences, pointer state, one rAF loop.

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => reduceQuery.matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const map = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);

// sessionStorage can throw in private windows or sandboxed frames.
export const session = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

// Pointer state shared by every effect (smoothed velocity included).
export const pointer = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0, speed: 0, active: false };
let lastMove = performance.now();
window.addEventListener(
  'pointermove',
  (e) => {
    const now = performance.now();
    const dt = Math.max(8, now - lastMove);
    pointer.vx = (e.clientX - pointer.x) / dt;
    pointer.vy = (e.clientY - pointer.y) / dt;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    lastMove = now;
  },
  { passive: true },
);

// Adaptive quality. If frames stay slow, the WebGL effects render at a lower
// internal resolution (a little softer, nothing removed); with sustained
// headroom they step back up. Fast machines never leave level 0, and a
// steady 30 Hz (a display or battery-saver cap, not overload) is left alone.
const QUALITY_LEVELS = [1, 0.8, 0.65];
// scale: internal resolution of WebGL effects. stride: draw them every Nth frame
// (only at the lowest level, where the GPU clearly can't keep up).
export const quality = { scale: 1, stride: 1 };
const qualityListeners = new Set();
export const onQualityChange = (fn) => {
  qualityListeners.add(fn);
  return () => qualityListeners.delete(fn);
};
let qLevel = 0;
let frameAvg = 16.7;
let jitter = 0;
let slowFor = 0;
let fastFor = 0;
function governQuality(dt) {
  if (document.visibilityState !== 'visible') return; // hidden tabs say nothing
  dt = Math.min(dt, 250); // one long stall (a tab switch, a hitch) moves the average only a little
  jitter = lerp(jitter, Math.abs(dt - frameAvg), 0.05);
  frameAvg = lerp(frameAvg, dt, 0.05);
  slowFor = frameAvg > 24 && jitter > 3 ? slowFor + dt : 0;
  fastFor = frameAvg < 15 ? fastFor + dt : 0;
  let next = qLevel;
  if (slowFor > 1500 && qLevel < QUALITY_LEVELS.length - 1) next = qLevel + 1;
  else if (fastFor > 8000 && qLevel > 0) next = qLevel - 1;
  if (next === qLevel) return;
  qLevel = next;
  slowFor = 0;
  fastFor = 0;
  quality.scale = QUALITY_LEVELS[qLevel];
  quality.stride = qLevel === QUALITY_LEVELS.length - 1 ? 2 : 1;
  qualityListeners.forEach((fn) => fn(quality.scale));
}

// One requestAnimationFrame loop for the whole site.
const subscribers = new Set();
let running = false;
let lastFrame = 0;
function frame(t) {
  if (lastFrame) governQuality(t - lastFrame);
  lastFrame = t;
  pointer.speed = lerp(pointer.speed, Math.hypot(pointer.vx, pointer.vy), 0.08);
  pointer.vx *= 0.9;
  pointer.vy *= 0.9;
  for (const fn of subscribers) fn(t);
  if (subscribers.size) requestAnimationFrame(frame);
  else {
    running = false;
    lastFrame = 0;
  }
}
export function onFrame(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
  return () => subscribers.delete(fn);
}

// Scroll state with smoothed velocity, used by tickers and the HUD.
export const scroll = { y: window.scrollY, velocity: 0, progress: 0 };
let lastY = window.scrollY;
let maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); // refreshed with the layout below
onFrame(() => {
  const y = window.scrollY;
  const max = maxScroll;
  scroll.velocity = lerp(scroll.velocity, y - lastY, 0.15);
  scroll.y = y;
  scroll.progress = clamp(y / max, 0, 1);
  lastY = y;
});

// Element geometry without layout reads in the animation loop. Each tracked
// element is measured once relative to the document, then again only when the
// page changes size (fonts, images, content opening up) or the window resizes;
// every frame derives its on-screen position from the scroll offset alone.
// layout.epoch increases on every re-measure so effects can skip frames where
// neither the scroll position nor the layout changed.
export const layout = { epoch: 0 };
const boxes = new Set();
function measure(box) {
  const r = box.el.getBoundingClientRect();
  box.docTop = r.top + window.scrollY;
  box.left = r.left;
  box.width = r.width;
  box.height = r.height;
}
let remeasureQueued = false;
function remeasure() {
  if (remeasureQueued) return;
  remeasureQueued = true;
  requestAnimationFrame(() => {
    remeasureQueued = false;
    boxes.forEach(measure);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    layout.epoch += 1;
  });
}
new ResizeObserver(remeasure).observe(document.documentElement);
window.addEventListener('resize', remeasure);
document.fonts?.ready.then(remeasure);

export function trackBox(el) {
  const box = {
    el,
    docTop: 0,
    left: 0,
    width: 0,
    height: 0,
    get top() {
      return this.docTop - scroll.y;
    },
    get bottom() {
      return this.docTop - scroll.y + this.height;
    },
  };
  measure(box);
  boxes.add(box);
  return box;
}

export const untrackBox = (box) => boxes.delete(box);

// True when the scroll position or layout moved since the last call for this key.
export function changed(state) {
  const moved = state.y !== scroll.y || state.epoch !== layout.epoch || state.h !== innerHeight;
  state.y = scroll.y;
  state.epoch = layout.epoch;
  state.h = innerHeight;
  return moved;
}

// Run a callback while an element is on screen and the tab is visible.
export function whileVisible(el, onChange, rootMargin = '120px') {
  let inView = false;
  const update = () => onChange(inView && document.visibilityState === 'visible');
  const io = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      update();
    },
    { rootMargin },
  );
  io.observe(el);
  document.addEventListener('visibilitychange', update);
  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', update);
  };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Film timecode at 23.976 fps (HH:MM:SS:FF), the frame rate The Courier was cut at.
export const FPS = 24000 / 1001;
export function timecode(seconds) {
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ff = Math.floor((s % 1) * FPS);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}
