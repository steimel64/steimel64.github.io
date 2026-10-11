// Contact page oscilloscope: a phosphor trace on a 10 × 8 graticule.
// Pointer position sets frequency and amplitude; every keystroke in the form
// injects a harmonic, so writing a message literally changes the signal.
import { onFrame, whileVisible, reducedMotion, lerp, pointer } from '../core/env.js';

export function initScope({ wrap, canvas, readout }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { kick() {} };

  let w = 0;
  let h = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050a0b';
    ctx.fillRect(0, 0, w, h);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  const state = { freq: 3, amp: 0.32, targetFreq: 3, targetAmp: 0.32, harmonics: [], phase: 0 };

  const grid = () => {
    ctx.strokeStyle = 'rgba(52, 242, 223, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) {
      const x = Math.round((w / 10) * i) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let j = 1; j < 8; j++) {
      const y = Math.round((h / 8) * j) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    // Minor ticks on the centre axes.
    ctx.strokeStyle = 'rgba(52, 242, 223, 0.28)';
    ctx.beginPath();
    for (let i = 0; i < 50; i++) {
      const x = (w / 50) * i;
      ctx.moveTo(x, h / 2 - 3);
      ctx.lineTo(x, h / 2 + 3);
    }
    for (let j = 0; j < 40; j++) {
      const y = (h / 40) * j;
      ctx.moveTo(w / 2 - 3, y);
      ctx.lineTo(w / 2 + 3, y);
    }
    ctx.stroke();
  };

  const sample = (x, t) => {
    let v = Math.sin(x * state.freq * Math.PI * 2 + state.phase) * state.amp;
    for (const hm of state.harmonics) v += Math.sin(x * hm.f * Math.PI * 2 + t * hm.s) * hm.a;
    v += Math.sin(x * 37 + t * 9) * 0.01;
    return v;
  };

  const draw = (t) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5, 10, 11, 0.22)';
    ctx.fillRect(0, 0, w, h);
    grid();
    ctx.globalCompositeOperation = 'lighter';
    for (const [lw, alpha] of [
      [6, 0.08],
      [2.5, 0.35],
      [1.2, 0.95],
    ]) {
      ctx.strokeStyle = `rgba(52, 242, 223, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      const steps = Math.max(120, Math.floor(w / 3));
      for (let i = 0; i <= steps; i++) {
        const x = i / steps;
        const y = h / 2 - sample(x, t) * h * 0.9;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(x * w, y);
      }
      ctx.stroke();
    }
  };

  const update = () => {
    if (!readout) return;
    const hz = (state.freq * 146.83).toFixed(1); // D3 base, tuned like a guitar string
    const vdiv = (state.amp * 6.25).toFixed(2);
    readout.innerHTML = `<span>CH1 ${vdiv} V/div</span><span>TIME 5 ms/div</span><span>FREQ ${hz} Hz</span><span>HARM ${state.harmonics.length}</span>`;
  };

  if (reducedMotion()) {
    draw(0);
    update();
    return { kick() {} };
  }

  let visible = true;
  whileVisible(wrap, (v) => {
    visible = v;
  });
  let lastReadout = 0;

  onFrame((now) => {
    if (!visible) return;
    const t = now / 1000;
    const box = canvas.getBoundingClientRect();
    if (pointer.active && pointer.y > box.top - 200 && pointer.y < box.bottom + 400) {
      state.targetFreq = 1 + ((pointer.x - box.left) / box.width) * 5;
      state.targetAmp = 0.12 + Math.min(1, Math.abs(pointer.y - (box.top + box.height / 2)) / (box.height * 2)) * 0.28;
    }
    state.freq = lerp(state.freq, state.targetFreq, 0.05);
    state.amp = lerp(state.amp, state.targetAmp, 0.05);
    state.phase += 0.06 + state.freq * 0.01;
    state.harmonics.forEach((hm) => {
      hm.a *= 0.985;
    });
    state.harmonics = state.harmonics.filter((hm) => hm.a > 0.004);
    draw(t);
    if (now - lastReadout > 120) {
      update();
      lastReadout = now;
    }
  });

  return {
    kick(char = 'a') {
      const code = char.charCodeAt(0) || 97;
      state.harmonics.push({ f: 2 + (code % 23), a: 0.06 + (code % 7) * 0.012, s: 4 + (code % 5) });
      if (state.harmonics.length > 14) state.harmonics.shift();
    },
  };
}
