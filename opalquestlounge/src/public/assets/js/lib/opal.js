// The opal: the one full-spectrum thing on the site.
//
// Precious opal is stacked silica spheres that diffract light. Each patch
// of the stone shows one pure colour, and which colour depends on the angle
// you see it from. We draw that as a harlequin mosaic: Voronoi cells, each
// with its own diffraction direction, lit by where your pointer is, how the
// phone is tilted and how far you've scrolled. White opal by day, black
// opal on the velvet tray.
//
// One WebGL context renders every opal on the page into 2D canvases. With no
// WebGL, a small CPU version draws a still stone. It only renders when
// something changes, and it stays still if you prefer reduced motion.

import { settings } from './settings.js';
import { reducedMotion } from './ui.js';

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uTilt;
uniform float uFlash;
uniform float uDark;
uniform float uSeed;
uniform float uScale;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p + uSeed) * 43758.5453);
}
float hash1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed * 1.7) * 43758.5453); }
vec3 spectral(float h) { return clamp(0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67))), 0.0, 1.0); }

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * 2.0 * vec2(aspect, 1.0);
  vec2 e = p / vec2(aspect * 0.94, 0.94);
  float r2 = dot(e, e);
  float px = 2.0 / (uRes.y * 0.94);
  float alpha = clamp((1.0 - r2) / (3.0 * px), 0.0, 1.0);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float z = sqrt(max(0.0, 1.0 - r2));
  vec3 n = normalize(vec3(e * 0.85, z));

  // Harlequin cells, refracted a little by the dome.
  vec2 g = p * uScale + n.xy * 0.7;
  vec2 ip = floor(g);
  vec2 fp = fract(g);
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 b = vec2(float(i), float(j));
      vec2 r = b + hash2(ip + b) - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = ip + b; }
      else if (d < d2) { d2 = d; }
    }
  }
  float seam = sqrt(d2) - sqrt(d1);
  float h = hash1(id);
  float h2 = hash1(id + 7.31);
  vec2 dir = normalize(hash2(id * 1.37) - 0.5);

  // Angle of view for this patch: where it sits on the dome plus the tilt.
  float a = dot(dir, uTilt * 1.6 + n.xy * 0.9) + h2 * 3.0;
  // Hues run blue, cyan, green, gold, fire red: never violet or magenta.
  float hue = 0.3 + 0.72 * fract(h * 0.55 + a * (0.35 + h2 * 0.4) + 0.18);
  float on = pow(max(0.0, sin(3.14159 * fract(a * 0.9 + h))), 2.4);
  on *= smoothstep(0.015, 0.09, seam);
  // Opal favours greens and blues; reds are rarer and brighter.
  vec3 col = spectral(hue);
  col = mix(col, col * vec3(0.8, 1.05, 1.1), 0.35);

  vec3 bodyLight = vec3(0.86, 0.875, 0.89);
  vec3 bodyDark = vec3(0.05, 0.065, 0.095);
  vec3 body = mix(bodyLight, bodyDark, uDark);
  float strength = mix(0.7, 0.88, uDark) * (0.8 + uFlash * 1.1);
  vec3 c = mix(body, col, clamp(on * strength, 0.0, 1.0));
  c = mix(c, body, (1.0 - uDark) * 0.28);      // milky veil over white opal
  c += col * on * uFlash * 0.35;

  // Dome shading, a soft window reflection and a thin rim.
  vec3 L = normalize(vec3(-0.45 + uTilt.x * 0.6, 0.55 + uTilt.y * 0.6, 0.85));
  float spec = pow(max(0.0, dot(reflect(-L, n), vec3(0.0, 0.0, 1.0))), 48.0);
  c *= 0.74 + 0.26 * z;
  c += spec * mix(0.45, 0.6, uDark);
  c = mix(c, c * 0.55, smoothstep(0.82, 1.0, r2) * 0.6);

  gl_FragColor = vec4(c * alpha, alpha);
}`;

class GLRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['uRes', 'uTilt', 'uFlash', 'uDark', 'uSeed', 'uScale'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  }
  draw(w, h, s) {
    const { gl, u } = this;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform2f(u.uTilt, s.tilt[0], s.tilt[1]);
    gl.uniform1f(u.uFlash, s.flash);
    gl.uniform1f(u.uDark, s.dark);
    gl.uniform1f(u.uSeed, s.seed);
    gl.uniform1f(u.uScale, s.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}

// CPU fallback: the same idea, coarser, drawn once.
class CPURenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }
  draw(w, h, s) {
    const sw = Math.max(24, Math.round(w / 4));
    const sh = Math.max(18, Math.round(h / 4));
    const small = new OffscreenCanvasLike(sw, sh);
    const img = small.ctx.createImageData(sw, sh);
    const aspect = sw / sh;
    const fract = (x) => x - Math.floor(x);
    const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7 + s.seed) * 43758.5453);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const px = ((x + 0.5) / sw - 0.5) * 2 * aspect;
        const py = ((1 - (y + 0.5) / sh) - 0.5) * 2;
        const ex = px / (aspect * 0.94);
        const ey = py / 0.94;
        const r2 = ex * ex + ey * ey;
        const i = (y * sw + x) * 4;
        if (r2 > 1) { img.data[i + 3] = 0; continue; }
        const gx = px * s.scale;
        const gy = py * s.scale;
        let best = 9, bid = [0, 0];
        for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const cx = Math.floor(gx) + k, cy = Math.floor(gy) + j;
          const ox = cx + hash(cx, cy), oy = cy + hash(cy + 3.1, cx);
          const d = (ox - gx) ** 2 + (oy - gy) ** 2;
          if (d < best) { best = d; bid = [cx, cy]; }
        }
        const hh = hash(bid[0], bid[1]);
        const on = Math.max(0, Math.sin(Math.PI * fract(hh * 3 + s.tilt[0] + s.tilt[1]))) ** 2;
        const hue = 0.3 + 0.72 * fract(hh * 0.8 + 0.2);
        const col = [0, 0.33, 0.67].map((o) => 0.5 + 0.5 * Math.cos(6.28318 * (hue + o)));
        const body = s.dark ? [0.055, 0.07, 0.1] : [0.86, 0.875, 0.89];
        const k = on * (s.dark ? 1 : 0.6);
        const z = Math.sqrt(1 - r2);
        for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(255 * Math.min(1, (body[c] * (1 - k) + col[c] * k) * (0.74 + 0.26 * z)));
        img.data[i + 3] = 255;
      }
    }
    small.ctx.putImageData(img, 0, 0);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(small.canvas, 0, 0, w, h);
    return this.canvas;
  }
}
class OffscreenCanvasLike {
  constructor(w, h) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
  }
}

let renderer = null;
function getRenderer() {
  if (renderer) return renderer;
  try {
    renderer = new GLRenderer();
    renderer.live = true;
  } catch {
    renderer = new CPURenderer();
    renderer.live = false;
  }
  return renderer;
}

// ---------- targets on the page ----------
const targets = new Set();
const input = { pointer: [0, 0], orient: [0, 0], scroll: 0 };
let flash = 0;
let flashStart = 0;
let frame = 0;
const SEEDS = { specimen: 3.7, mark: 11.2, crest: 7.9, symbol: 5.3 };
const SCALES = { specimen: 3.8, mark: 2.4, crest: 2.8, symbol: 2.8 };

function tilt() {
  return [
    Math.max(-1.4, Math.min(1.4, input.pointer[0] * 0.8 + input.orient[0])),
    Math.max(-1.4, Math.min(1.4, input.pointer[1] * 0.8 + input.orient[1] + input.scroll)),
  ];
}

function drawTarget(t) {
  const r = getRenderer();
  const w = t.canvas.width;
  const h = t.canvas.height;
  const src = r.draw(w, h, {
    tilt: tilt(),
    flash,
    dark: settings.isDark() ? 1 : 0,
    seed: SEEDS[t.kind] ?? 1,
    scale: SCALES[t.kind] ?? 3,
  });
  t.ctx.clearRect(0, 0, w, h);
  t.ctx.drawImage(src, 0, 0);
  t.canvas.classList.add('is-lit');
}

function render() {
  frame = 0;
  const now = performance.now();
  if (flashStart) {
    const t = (now - flashStart) / 1000;
    flash = reducedMotion() ? (t < 0.8 ? 1 : 0) : Math.max(0, Math.exp(-t * 2.2) * (0.75 + 0.25 * Math.cos(t * 14)));
    if (t > 1.6) {
      flash = 0;
      flashStart = 0;
    }
  }
  for (const t of targets) if (t.visible) drawTarget(t);
  if (flashStart) schedule();
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(render);
}

function size(t) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = t.canvas.getBoundingClientRect();
  const w = Math.max(8, Math.round(rect.width * dpr));
  const h = Math.max(8, Math.round(rect.height * dpr));
  if (t.canvas.width !== w || t.canvas.height !== h) {
    t.canvas.width = w;
    t.canvas.height = h;
  }
}

let started = false;
export function startOpals() {
  if (started) return;
  started = true;
  const canvases = document.querySelectorAll('canvas[data-opal]');
  if (!canvases.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const t = [...targets].find((x) => x.canvas === e.target);
      if (t) t.visible = e.isIntersecting;
    }
    schedule();
  });
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const t = [...targets].find((x) => x.canvas === e.target);
      if (t) size(t);
    }
    schedule();
  });
  canvases.forEach((canvas) => {
    const t = { canvas, ctx: canvas.getContext('2d'), kind: canvas.dataset.opal, visible: true };
    targets.add(t);
    size(t);
    io.observe(canvas);
    ro.observe(canvas);
  });
  schedule();

  settings.on(({ key }) => key === 'theme' && schedule());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);

  if (!getRenderer().live) return;
  const still = () => reducedMotion();
  window.addEventListener(
    'pointermove',
    (e) => {
      if (still() || e.pointerType === 'touch') return;
      input.pointer = [(e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2];
      schedule();
    },
    { passive: true },
  );
  window.addEventListener(
    'scroll',
    () => {
      if (still()) return;
      input.scroll = scrollY * 0.0014;
      schedule();
    },
    { passive: true },
  );
  window.addEventListener('deviceorientation', (e) => {
    if (still() || e.gamma == null) return;
    input.orient = [e.gamma / 45, (e.beta - 45) / 60];
    schedule();
  });
}

/** Make every opal on the page flash: used when a game pays back more than the stake. */
export function flashOpals() {
  if (!targets.size) startOpals();
  flashStart = performance.now();
  schedule();
}

/** A still opal cabochon, for use as a slot symbol. */
export function opalImage(w, h, { dark, seed = SEEDS.symbol, tiltX = 0.2, tiltY = 0.1 } = {}) {
  const r = getRenderer();
  const src = r.draw(w, h, { tilt: [tiltX, tiltY], flash: 0.15, dark: dark ? 1 : 0, seed, scale: SCALES.symbol });
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(src, 0, 0);
  return out;
}
