// Minimal WebGL helpers: full-screen fragment shaders on one triangle, a
// canvas kept sized to its box, and one-off renders into a texture.
//
// Resolution is capped twice: by device pixel ratio (dprCap) and by total
// pixel count (maxPixels), then scaled by the adaptive quality level, so a
// 4K laptop with a weak GPU never shades more pixels than the effect needs.
import { quality, onQualityChange } from '../core/env.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

// A linked program drawing the shared full-screen triangle.
function createProgram(gl, frag, buffer) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const loc = gl.getAttribLocation(prog, 'aPos');
  const uniforms = {};
  const u = (name) => (uniforms[name] ??= gl.getUniformLocation(prog, name));
  return {
    use() {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    },
    set1f: (n, v) => gl.uniform1f(u(n), v),
    set2f: (n, a, b) => gl.uniform2f(u(n), a, b),
    set3f: (n, a, b, c) => gl.uniform3f(u(n), a, b, c),
    set1i: (n, v) => gl.uniform1i(u(n), v),
    draw: () => gl.drawArrays(gl.TRIANGLES, 0, 3),
  };
}

export function createQuad(canvas, frag, { dprCap = 1.5, maxPixels = Infinity } = {}) {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    depth: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  // One triangle that covers the screen, shared by every program.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const main = createProgram(gl, frag, buffer);
  main.use();

  const size = { w: 1, h: 1 };
  const resize = () => {
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    let scale = Math.min(window.devicePixelRatio || 1, dprCap);
    scale = Math.min(scale, Math.sqrt(maxPixels / (cssW * cssH))) * quality.scale;
    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
    }
    size.w = w;
    size.h = h;
  };
  resize();
  new ResizeObserver(resize).observe(canvas);
  onQualityChange(resize);

  return {
    gl,
    size,
    set1f: main.set1f,
    set2f: main.set2f,
    set3f: main.set3f,
    set1i: main.set1i,
    draw() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, size.w, size.h);
      main.draw();
    },
    program: (src) => createProgram(gl, src, buffer),
    use: () => main.use(),
  };
}

// An empty RGBA texture plus a framebuffer that renders into it.
export function createTarget(gl, w, h, { repeatX = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? { tex, fbo, w, h } : null;
}
