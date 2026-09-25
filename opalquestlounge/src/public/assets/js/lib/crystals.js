// Crystal drawings for the Seven Systems reels.
//
// Each mineral is a real convex polyhedron in its crystal system's habit.
// We find its faces with a small convex hull, turn it to a fixed viewing
// angle and draw it the way 19th-century mineralogy plates did: visible
// edges in solid ink, hidden edges dashed, faces washed with the mineral's
// colour. By day the ink is jet on paper; on the velvet tray it's chalk.

const V = (x, y, z) => [x, y, z];
const ring = (n, r, y, phase = 0, sx = 1, sz = 1) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return V(Math.cos(a) * r * sx, y, Math.sin(a) * r * sz);
  });

const SHAPES = {
  // Garnet, cubic: the rhombic dodecahedron.
  G: [
    ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => V(x, y, z)))),
    V(2, 0, 0), V(-2, 0, 0), V(0, 2, 0), V(0, -2, 0), V(0, 0, 2), V(0, 0, -2),
  ],
  // Beryl, hexagonal: a six-sided prism with flat ends.
  B: [...ring(6, 1.05, 1.45), ...ring(6, 1.05, -1.45)],
  // Quartz, trigonal: six-sided prism capped by pyramids.
  Q: [...ring(6, 0.85, 0.75, Math.PI / 6), ...ring(6, 0.85, -0.95, Math.PI / 6), V(0, 1.85, 0), V(0, -1.9, 0)],
  // Zircon, tetragonal: square prism with pointed ends.
  Z: [...ring(4, 1.05, 0.7, Math.PI / 4), ...ring(4, 1.05, -0.7, Math.PI / 4), V(0, 1.65, 0), V(0, -1.65, 0)],
  // Topaz, orthorhombic: a rhombic prism, pyramid on top, flat cleavage base.
  T: [...ring(4, 1, 0.55, 0, 1.15, 0.62), ...ring(4, 1, -1.35, 0, 1.15, 0.62), V(0, 1.55, 0), V(0.45, 1.1, 0), V(-0.45, 1.1, 0)],
  // Orthoclase, monoclinic: a flattened six-sided prism with one axis leaning.
  F: [...ring(6, 1, -1.15, 0, 0.95, 0.55).map(([x, y, z]) => V(x - 0.4, y, z)), ...ring(6, 1, 1.15, 0, 0.95, 0.55).map(([x, y, z]) => V(x + 0.4, y, z))],
  // Axinite, triclinic: every axis leans, giving a thin axe-like blade.
  X: (() => {
    const a = V(1.9, 0.55, 0.25);
    const b = V(0.75, 1.35, 0.45);
    const c = V(0.1, 0.12, 0.34);
    const pts = [];
    for (const i of [-0.5, 0.5]) for (const j of [-0.5, 0.5]) for (const k of [-0.5, 0.5]) {
      pts.push(V(a[0] * i + b[0] * j + c[0] * k, a[1] * i + b[1] * j + c[1] * k, a[2] * i + b[2] * j + c[2] * k));
    }
    return pts;
  })(),
};

// Mineral colours as a light wash (day) and a glow (night).
export const TINTS = {
  G: { day: 'oklch(52% 0.15 20)', night: 'oklch(62% 0.17 20)' },
  B: { day: 'oklch(64% 0.1 170)', night: 'oklch(72% 0.11 175)' },
  Q: { day: 'oklch(80% 0.02 250)', night: 'oklch(82% 0.03 250)' },
  Z: { day: 'oklch(62% 0.1 60)', night: 'oklch(70% 0.11 65)' },
  T: { day: 'oklch(74% 0.12 75)', night: 'oklch(80% 0.12 80)' },
  F: { day: 'oklch(78% 0.05 40)', night: 'oklch(80% 0.06 40)' },
  X: { day: 'oklch(52% 0.07 330)', night: 'oklch(66% 0.08 330)' },
};

// ---------- geometry ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Faces of the convex hull of a small point set, each as ordered vertex indices plus a normal. */
function hull(points) {
  const faces = [];
  const eps = 1e-6;
  const n = points.length;
  const centre = points.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nr = cross(sub(points[j], points[i]), sub(points[k], points[i]));
    if (Math.hypot(...nr) < eps) continue;
    nr = norm(nr);
    let d = dot(nr, points[i]);
    if (dot(nr, centre) > d) { nr = nr.map((x) => -x); d = -d; }
    if (!points.every((p) => dot(nr, p) <= d + 1e-5)) continue;
    if (faces.some((f) => dot(f.n, nr) > 1 - 1e-6 && Math.abs(f.d - d) < 1e-5)) continue;
    const on = points.map((p, idx) => [p, idx]).filter(([p]) => Math.abs(dot(nr, p) - d) < 1e-5).map(([, idx]) => idx);
    // order the face's vertices around its centre
    const fc = on.reduce((s, idx) => [s[0] + points[idx][0] / on.length, s[1] + points[idx][1] / on.length, s[2] + points[idx][2] / on.length], [0, 0, 0]);
    const u = norm(sub(points[on[0]], fc));
    const v = cross(nr, u);
    on.sort((a, b) => {
      const pa = sub(points[a], fc);
      const pb = sub(points[b], fc);
      return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
    });
    faces.push({ n: nr, d, idx: on });
  }
  return faces;
}

function rotate(p, ry, rx) {
  const [x, y, z] = p;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

const MODELS = {};
function model(key) {
  if (MODELS[key]) return MODELS[key];
  const ry = -0.52;
  const rx = 0.3;
  const pts = SHAPES[key].map((p) => rotate(p, ry, rx));
  const faces = hull(pts);
  // Fit into a unit box.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const s = 1 / Math.max(w, h);
  MODELS[key] = { pts: pts.map((p) => [(p[0] - cx) * s, -(p[1] - cy) * s, p[2]]), faces };
  return MODELS[key];
}

/**
 * Draw a crystal into ctx, centred at (x, y), fitting a box of `size` px.
 * theme: { ink, paper, dark }
 */
export function drawCrystal(ctx, key, x, y, size, theme) {
  const m = model(key);
  const light = norm([-0.5, 0.65, 0.6]);
  const P = (i) => [x + m.pts[i][0] * size, y + m.pts[i][1] * size];
  const tint = TINTS[key][theme.dark ? 'night' : 'day'];
  const visible = m.faces.map((f) => f.n[2] > 1e-4);
  const lw = Math.max(1, size / 60);

  // Faces: a wash of colour, lighter where the light falls.
  ctx.save();
  ctx.lineJoin = 'round';
  m.faces.forEach((f, fi) => {
    if (!visible[fi]) return;
    const shade = Math.max(0, dot(f.n, light));
    ctx.beginPath();
    f.idx.forEach((i, k) => (k ? ctx.lineTo(...P(i)) : ctx.moveTo(...P(i))));
    ctx.closePath();
    ctx.fillStyle = tint;
    ctx.globalAlpha = theme.dark ? 0.22 + shade * 0.55 : 0.18 + shade * 0.5;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Edges: solid if either face is visible, dashed if both are hidden.
  const edges = new Map();
  m.faces.forEach((f, fi) => {
    f.idx.forEach((a, k) => {
      const b = f.idx[(k + 1) % f.idx.length];
      const id = a < b ? `${a}-${b}` : `${b}-${a}`;
      const e = edges.get(id) || { a, b, seen: false };
      e.seen = e.seen || visible[fi];
      edges.set(id, e);
    });
  });
  ctx.strokeStyle = theme.ink;
  for (const e of edges.values()) {
    ctx.beginPath();
    ctx.moveTo(...P(e.a));
    ctx.lineTo(...P(e.b));
    if (e.seen) {
      ctx.setLineDash([]);
      ctx.lineWidth = lw * 1.25;
      ctx.globalAlpha = 1;
    } else {
      ctx.setLineDash([lw * 3, lw * 2.5]);
      ctx.lineWidth = lw * 0.8;
      ctx.globalAlpha = 0.45;
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Opal: a cabochon from the opal renderer, with a fine ink outline. */
export function drawCabochon(ctx, img, x, y, size, theme) {
  const w = size * 1.02;
  const h = size * 0.78;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.save();
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = Math.max(1, size / 60) * 1.25;
  ctx.beginPath();
  ctx.ellipse(x, y, (w / 2) * 0.94, (h / 2) * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
