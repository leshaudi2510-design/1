// Colour maths for the uniqueness gate: hex / OKLCH -> OKLab, distances, hue rotation.

export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return rgb.map((c) => Math.min(1, Math.max(0, toGamma(c))));
}
export const hexToOklab = (hex) => { const rgb = hexToRgb(hex); return rgb ? rgbToOklab(rgb) : null; };
export const oklchToOklab = ({ l, c, h }) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
export function oklabToOklch([L, a, b]) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}
export const rgbToHex = (rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export const labDistance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Symmetric mean nearest-neighbour OKLab distance between two palettes (arrays of [L,a,b]). */
export function paletteDistance(A, B) {
  if (!A.length || !B.length) return null;
  const nn = (X, Y) => X.reduce((sum, x) => sum + Math.min(...Y.map((y) => labDistance(x, y))), 0) / X.length;
  return (nn(A, B) + nn(B, A)) / 2;
}

export function hueDiff(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/** Rotate a hex colour's OKLCH hue by deg degrees (used by the reskin fixture). */
export function rotateHex(hex, deg) {
  const lab = hexToOklab(hex);
  if (!lab) return hex;
  const lch = oklabToOklch(lab);
  if (lch.c < 0.02) return hex.toUpperCase(); // neutrals stay neutral
  lch.h = (lch.h + deg) % 360;
  const out = rgbToHex(oklabToRgb(oklchToOklab(lch)));
  // keep the original notation length/case style
  return /^#[0-9a-f]+$/.test(hex) ? out.toLowerCase() : out;
}

/** Solid colour tokens from a stylesheet: custom properties whose value is one hex colour. */
export function cssColourTokens(css) {
  const out = new Map();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*[;}]/g)) {
    const hex = m[2].length === 4 || m[2].length === 7 ? m[2] : m[2].slice(0, 7);
    if (!out.has(m[1])) out.set(m[1], hex.toUpperCase());
  }
  return out;
}
