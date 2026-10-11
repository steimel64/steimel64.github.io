// LUNA.EXE moon: a procedural sphere (fbm terrain + 3D Voronoi craters) lit by
// the pointer, with a vermilion rim on the night side and a pulse uniform that
// the terminal intro fires.
//
// The surface only depends on where a point sits on the sphere, so it is baked
// once into an equirectangular albedo map (a few strips per frame, so the bake
// never stalls the page). Each frame then shades the disc with one texture
// read instead of ~70 noise evaluations per pixel: same picture, a fraction of
// the GPU time. If the bake cannot run, the surface is computed live.
import { createQuad, createTarget } from './gl.js';
import { onFrame, pointer, lerp, whileVisible, trackBox, quality } from '../core/env.js';

const ALBEDO_MIN = -0.4; // albedo range stored in the 8-bit map
const ALBEDO_RANGE = 1.8;
const BAKE_STRIPS = 16; // small slices keep each frame of the bake short

const SURFACE = `
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

float craters(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); float res = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(h3(i + g), h3(i + g + 13.1), h3(i + g + 27.7));
    float d = length(g + o - f);
    float size = 0.22 + 0.38 * h3(i + g + 5.3);
    float t = d / size;
    float keep = step(0.4, h3(i + g + 9.1));
    float bowl = -0.55 * (1.0 - t * t) * step(t, 1.0);
    float rim = 0.4 * smoothstep(0.75, 1.0, t) * smoothstep(1.25, 1.0, t);
    res += (bowl + rim) * keep;
  }
  return res;
}

// Surface brightness at a point on the unit sphere, in the moon's own frame.
float albedoAt(vec3 q) {
  float terrain = fbm(q * 2.4);
  float maria = smoothstep(0.42, 0.62, fbm(q * 1.15 + 4.0));
  float c = craters(q * 4.2) + 0.5 * craters(q * 9.0 + 3.0);
  return 0.5 + terrain * 0.32 - maria * 0.22 + c * 0.3;
}`;

// Bake: one texel per longitude/latitude.
const BAKE = `
precision highp float;
varying vec2 vUv;
${SURFACE}
void main() {
  float lon = (vUv.x - 0.5) * 6.2831853;
  float lat = (vUv.y - 0.5) * 3.1415927;
  vec3 q = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  gl_FragColor = vec4(vec3(clamp((albedoAt(q) - ${ALBEDO_MIN.toFixed(2)}) / ${ALBEDO_RANGE.toFixed(2)}, 0.0, 1.0)), 1.0);
}`;

const screen = (baked) => `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec2 uMouse;
uniform float uTime;
uniform float uPulse;
uniform float uIntro;
${baked ? 'uniform sampler2D uAlbedo;' : SURFACE}

float h2(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

float surface(vec3 q) {
${
  baked
    ? `  vec2 uv = vec2(atan(q.x, q.z) / 6.2831853 + 0.5, asin(clamp(q.y, -1.0, 1.0)) / 3.1415927 + 0.5);
  return texture2D(uAlbedo, uv).r * ${ALBEDO_RANGE.toFixed(2)} + ${ALBEDO_MIN.toFixed(2)};`
    : '  return albedoAt(q);'
}
}

void main() {
  vec2 frag = vUv * uRes;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);
  vec3 col = vec3(0.027, 0.024, 0.05);

  // Stars
  vec2 cell = floor(frag / 3.0);
  float s = h2(cell);
  float star = smoothstep(0.9965, 1.0, s);
  col += vec3(0.85, 0.82, 0.98) * star * (0.55 + 0.45 * sin(uTime * (1.0 + s * 3.0) + s * 40.0)) * 1.4;

  vec3 L = normalize(vec3((uMouse.x - 0.5) * 2.2 - 0.6, (uMouse.y - 0.5) * 1.6 + 0.35, 0.55));
  vec3 red = vec3(1.0, 0.25, 0.19);
  vec3 magenta = vec3(1.0, 0.17, 0.82);

  if (r < 1.0) {
    float z = sqrt(1.0 - r * r);
    vec3 n = vec3(p, z);
    float albedo = surface(rotX(0.25) * rotY(uTime * 0.045) * n);

    float diff = smoothstep(-0.12, 0.55, dot(n, L));
    vec3 lit = vec3(0.86, 0.84, 0.92) * albedo * diff;
    float night = 1.0 - diff;
    float fres = pow(1.0 - z, 2.6);
    vec3 rim = red * fres * (0.9 + uPulse * 1.6) * (0.35 + night);
    vec3 ambient = vec3(0.08, 0.03, 0.06) * albedo * night;
    col = lit + rim + ambient;

    // Scanlines and a slow scan bar across the disc.
    col *= 0.92 + 0.08 * sin(frag.y * 1.3);
    float bar = smoothstep(0.06, 0.0, abs(fract(uTime * 0.07) * 2.6 - 1.3 - p.y));
    col += magenta * bar * 0.12;
    // Edge antialias.
    col = mix(col, vec3(0.03), smoothstep(1.0 - 2.0 / uRadius, 1.0, r));
  } else {
    float glow = exp(-(r - 1.0) * 5.5);
    col += red * glow * (0.28 + uPulse * 0.5) + magenta * exp(-(r - 1.0) * 14.0) * 0.08;
  }

  // Intro: the disc grows out of static.
  col *= smoothstep(0.0, 1.0, uIntro);
  col += (h2(frag + fract(uTime) * 91.0) - 0.5) * 0.05;
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.9;
  gl_FragColor = vec4(col, 1.0);
}`;

// Bake the albedo map a strip at a time; resolves to the texture, or null.
function bakeAlbedo(quad) {
  const { gl } = quad;
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const w = Math.min(2048, maxSize);
  const target = createTarget(gl, w, w / 2, { repeatX: true });
  if (!target) return Promise.resolve(null);
  let program;
  try {
    program = quad.program(BAKE);
  } catch (err) {
    console.warn(err);
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let strip = 0;
    const step = () => {
      program.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.enable(gl.SCISSOR_TEST);
      const rows = target.h / BAKE_STRIPS;
      gl.scissor(0, strip * rows, target.w, rows);
      program.draw();
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      strip += 1;
      if (strip < BAKE_STRIPS) requestAnimationFrame(step);
      else {
        gl.deleteFramebuffer(target.fbo);
        quad.use();
        resolve(target.tex);
      }
    };
    requestAnimationFrame(step);
  });
}

export function initMoon({ section, canvas }) {
  let quad;
  try {
    quad = createQuad(canvas, screen(true), { dprCap: 1.25, maxPixels: 2_400_000 });
  } catch (err) {
    console.warn(err);
    quad = null;
  }
  if (!quad) {
    canvas.hidden = true;
    return { pulse() {} };
  }

  let ready = false;
  let t0 = 0;
  bakeAlbedo(quad).then((tex) => {
    if (tex) {
      quad.gl.activeTexture(quad.gl.TEXTURE0);
      quad.gl.bindTexture(quad.gl.TEXTURE_2D, tex);
      quad.set1i('uAlbedo', 0);
    } else {
      // No render-to-texture: shade the surface live with the same maths.
      const live = quad.program(screen(false));
      const draw = live.draw;
      Object.assign(quad, {
        set1f: live.set1f,
        set2f: live.set2f,
        draw: () => {
          live.use();
          quad.gl.viewport(0, 0, quad.size.w, quad.size.h);
          draw();
        },
      });
    }
    ready = true;
    t0 = performance.now();
  });

  let visible = true;
  whileVisible(
    section,
    (v) => {
      visible = v;
    },
    '0px',
  );
  const mouse = { x: 0.3, y: 0.7 };
  const box = trackBox(canvas);
  let tick = 0;
  let pulse = 0;

  onFrame((now) => {
    if (!visible || !ready) return;
    if (++tick % quality.stride) return; // the slowest machines draw every other frame
    const rect = box; // cached geometry, no layout read
    if (pointer.active) {
      mouse.x = lerp(mouse.x, (pointer.x - rect.left) / rect.width, 0.05);
      mouse.y = lerp(mouse.y, 1 - (pointer.y - rect.top) / rect.height, 0.05);
    }
    pulse *= 0.95;
    const { w, h } = quad.size;
    const wide = w / h > 1.05;
    const radius = wide ? Math.min(w, h) * 0.34 : w * 0.36;
    const cx = wide ? w * 0.68 : w * 0.5;
    const cy = wide ? h * 0.56 : h * 0.72;
    const intro = Math.min(1, (now - t0) / 1800);
    const scrollK = Math.min(1, Math.max(0, -rect.top / rect.height));

    quad.set2f('uRes', w, h);
    quad.set2f('uCenter', cx, cy + scrollK * h * 0.18);
    quad.set1f('uRadius', radius * (0.82 + 0.18 * (1 - Math.pow(1 - intro, 3))));
    quad.set2f('uMouse', mouse.x, mouse.y);
    quad.set1f('uTime', (now - t0) / 1000);
    quad.set1f('uPulse', pulse);
    quad.set1f('uIntro', intro);
    quad.draw();
  });

  return {
    pulse: (k = 1) => {
      pulse = Math.max(pulse, k);
    },
  };
}
