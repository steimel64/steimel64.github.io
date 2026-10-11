// Home hero: The Courier loop played through a live WebGL pass.
// Pointer bends the image like a lens, fast moves split the RGB channels,
// and the frame tears in short glitch bursts. Falls back to the plain video.
import { createQuad } from './gl.js';
import { onFrame, pointer, lerp, whileVisible, trackBox, quality } from '../core/env.js';

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uVid;
uniform vec2 uMouse;
uniform float uTime;
uniform float uVel;
uniform float uGlitch;
uniform float uIntro;
uniform float uScroll;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 cover(vec2 uv) {
  float rs = uRes.x / uRes.y;
  float rv = uVid.x / uVid.y;
  vec2 s = rs > rv ? vec2(1.0, rv / rs) : vec2(rs / rv, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main() {
  vec2 uv = vUv;

  // Intro: big pixel blocks resolving into the image.
  float block = mix(96.0, 1.0, smoothstep(0.0, 1.0, uIntro));
  if (block > 1.5) {
    vec2 cell = block / uRes;
    uv = (floor(uv / cell) + 0.5) * cell;
  }

  // Scroll pushes the frame back a little.
  uv = (uv - 0.5) * (1.0 - uScroll * 0.08) + 0.5;
  uv.y += uScroll * 0.06;

  // Horizontal tear bands during glitch bursts.
  float band = floor(uv.y * 28.0 + floor(uTime * 9.0));
  float tear = step(1.0 - uGlitch * 0.45, hash(vec2(band, floor(uTime * 14.0))));
  uv.x += tear * (hash(vec2(band, uTime)) - 0.5) * 0.04 * uGlitch;

  // Lens around the pointer.
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 d = (uv - uMouse) * aspect;
  float r = length(d);
  float lens = smoothstep(0.42, 0.0, r);
  vec2 dir = d / max(r, 1e-4);
  uv -= (d / aspect) * lens * 0.07;
  uv += (dir / aspect) * sin(r * 46.0 - uTime * 5.0) * 0.0015 * lens;

  vec2 tuv = cover(uv);
  // Channels only split when something happens: pointer speed, the lens or a glitch.
  float split = 0.0004 + uVel * 0.005 + lens * 0.0015 + uGlitch * 0.006;
  vec2 off = (dir / aspect) * split + vec2(split * 0.6, 0.0);
  // Five texture reads per pixel. The centre read serves both the green channel
  // and the sharpening; two bilinear reads on the half-texel diagonals average
  // the neighbourhood that four point reads used to.
  vec3 c0 = texture2D(uTex, tuv).rgb;
  float cr = texture2D(uTex, tuv + off).r;
  float cb = texture2D(uTex, tuv - off).b;
  vec3 col = vec3(cr, c0.g, cb);

  // Unsharp mask to pull edge detail out of the soft source.
  vec2 px = 1.0 / uVid;
  vec3 blur = (texture2D(uTex, tuv + px * 0.5).rgb + texture2D(uTex, tuv - px * 0.5).rgb) * 0.5;
  col += (c0 - blur) * 0.85;

  // Grade toward the film's night palette: deeper blacks, violet shadows.
  col = mix(col, col * col * 1.35, 0.35);
  col += vec3(0.05, 0.0, 0.09) * (1.0 - col.g);
  col = mix(col, col * vec3(1.06, 0.96, 1.08), 0.5);

  // Scanlines, vignette, grain.
  col *= 0.9 + 0.1 * sin(vUv.y * uRes.y * 1.15);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 1.15;
  col += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.07;

  // Static before the intro resolves.
  col = mix(vec3(hash(vUv * uRes + uTime) * 0.25), col, smoothstep(0.0, 0.55, uIntro));

  // Darken the lower third so the title reads.
  col *= mix(0.28, 1.0, smoothstep(0.0, 0.62, vUv.y));

  gl_FragColor = vec4(col, 1.0);
}`;

export function initHeroFilm({ section, canvas, video }) {
  let quad;
  try {
    quad = createQuad(canvas, FRAG, { dprCap: 1.5, maxPixels: 2_100_000 });
  } catch (err) {
    console.warn(err);
    quad = null;
  }
  if (!quad) {
    video.play().catch(() => {});
    return null;
  }
  section.classList.add('hero--gl');

  const { gl } = quad;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 8, 18, 255]));
  quad.set1i('uTex', 0);

  // Video frames go through texImage2D on purpose: measured in Chrome, it takes
  // the fast GPU copy path, while texSubImage2D from a video is several times slower.
  const upload = (source) => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  let hasFrame = false;
  let fresh = false;
  let introStart = 0;
  let size = { w: 960, h: 540 };

  // Start from the poster still so the shader has an image even before (or
  // without) video playback; live frames replace it once the loop is playing.
  const still = new Image();
  still.decoding = 'async';
  still.onload = () => {
    if (hasFrame) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    upload(still);
    size = { w: still.naturalWidth, h: still.naturalHeight };
    hasFrame = true;
    introStart = performance.now();
  };
  if (video.poster) still.src = video.poster;
  const markFrame = () => {
    fresh = true;
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(markFrame);
  };
  if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(markFrame);

  let visible = true;
  whileVisible(
    section,
    (v) => {
      visible = v;
      if (v) video.play().catch(() => {});
      else video.pause();
    },
    '0px',
  );

  const mouse = { x: 0.5, y: 0.55 };
  let vel = 0;
  let glitch = 0.6;
  let nextGlitch = performance.now() + 2600;
  const t0 = performance.now();
  const box = trackBox(canvas);
  let tick = 0;

  onFrame((now) => {
    if (!visible) return;
    if (++tick % quality.stride) return; // the slowest machines draw every other frame
    const rect = box; // cached geometry, no layout read
    if (pointer.active) {
      mouse.x = lerp(mouse.x, (pointer.x - rect.left) / rect.width, 0.08);
      mouse.y = lerp(mouse.y, 1 - (pointer.y - rect.top) / rect.height, 0.08);
    }
    vel = lerp(vel, Math.min(pointer.speed * 0.35, 1), 0.12);
    // Short, occasional bursts so the footage reads cleanly most of the time.
    if (now > nextGlitch) {
      glitch = 0.3 + Math.random() * 0.25;
      nextGlitch = now + 8000 + Math.random() * 6000;
    }
    glitch *= 0.93;

    if (video.readyState >= 2 && !video.paused && (fresh || !('requestVideoFrameCallback' in video))) {
      upload(video);
      size = { w: video.videoWidth, h: video.videoHeight };
      fresh = false;
      if (!hasFrame) {
        hasFrame = true;
        introStart = now;
      }
    }
    const intro = hasFrame ? Math.min(1, (now - introStart) / 1400) : 0;
    const scrollK = Math.min(1, Math.max(0, -rect.top / rect.height));

    quad.set2f('uRes', quad.size.w, quad.size.h);
    quad.set2f('uVid', size.w, size.h);
    quad.set2f('uMouse', mouse.x, mouse.y);
    quad.set1f('uTime', (now - t0) / 1000);
    quad.set1f('uVel', vel);
    quad.set1f('uGlitch', glitch);
    quad.set1f('uIntro', intro);
    quad.set1f('uScroll', scrollK);
    quad.draw();
  });

  video.play().catch(() => {});
  return {};
}
