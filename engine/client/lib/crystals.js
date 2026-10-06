// Crystal drawings for the Seven Systems reels.
//
// Each mineral is a real convex polyhedron in its crystal system's habit.
// We find its faces with a small convex hull, turn it to a fixed viewing
// angle and print it in the site's pop style: flat bright fills in three
// tones (lit, mid, shade), bold ink edges, a heavier ink silhouette and a
// hard offset shadow. Opal, which has no crystal lattice, is drawn like the
// site's opal mark. The artwork is the same in both themes.

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

const INK = '#18122B';

// Three flat tones per mineral: lit, mid and shaded faces.
export const TINTS = {
  G: ['#FF9A8F', '#FF4A3D', '#C8102E'], // garnet red
  B: ['#7FE8C4', '#13C08B', '#0B8A63'], // beryl green
  Q: ['#FFFFFF', '#C9F4FF', '#7FD3EE'], // quartz ice
  Z: ['#FFC680', '#FF9A1F', '#D2661B'], // zircon orange
  T: ['#FFF3A0', '#FFE11A', '#E0A800'], // topaz yellow
  F: ['#FFE0EE', '#FFB0D6', '#FF6FB5'], // orthoclase pink
  X: ['#C9B8FF', '#9B7BFF', '#5B2BD6'], // axinite violet
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
 */
export function drawCrystal(ctx, key, x, y, size) {
  const m = model(key);
  const light = norm([-0.5, 0.65, 0.6]);
  const P = (i) => [x + m.pts[i][0] * size, y + m.pts[i][1] * size];
  const [lit, mid, shade] = TINTS[key];
  const visible = m.faces.map((f) => f.n[2] > 1e-4);
  const lw = Math.max(1.5, size / 26);
  const face = (f, dx = 0, dy = 0) => {
    ctx.beginPath();
    f.idx.forEach((i, k) => {
      const [px, py] = P(i);
      k ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy);
    });
    ctx.closePath();
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Hard offset shadow: the silhouette in ink, pushed down and right.
  const off = size * 0.045;
  ctx.fillStyle = INK;
  m.faces.forEach((f, fi) => {
    if (!visible[fi]) return;
    face(f, off, off);
    ctx.fill();
  });

  // Faces in three flat tones, by how squarely they face the light.
  m.faces.forEach((f, fi) => {
    if (!visible[fi]) return;
    const s = dot(f.n, light);
    face(f);
    ctx.fillStyle = s > 0.55 ? lit : s > 0.05 ? mid : shade;
    ctx.fill();
  });

  // Edges: every visible edge in ink, the outline heavier.
  const edges = new Map();
  m.faces.forEach((f, fi) => {
    f.idx.forEach((a, k) => {
      const b = f.idx[(k + 1) % f.idx.length];
      const id = a < b ? `${a}-${b}` : `${b}-${a}`;
      const e = edges.get(id) || { a, b, seen: 0 };
      if (visible[fi]) e.seen += 1;
      edges.set(id, e);
    });
  });
  ctx.strokeStyle = INK;
  for (const e of edges.values()) {
    if (!e.seen) continue;
    ctx.beginPath();
    ctx.moveTo(...P(e.a));
    ctx.lineTo(...P(e.b));
    ctx.lineWidth = e.seen === 1 ? lw * 1.5 : lw;
    ctx.stroke();
  }

  // A cream glint on the most lit face.
  let best = -1;
  let bestS = -Infinity;
  m.faces.forEach((f, fi) => {
    const s = dot(f.n, light);
    if (visible[fi] && s > bestS) {
      bestS = s;
      best = fi;
    }
  });
  if (best >= 0) {
    const pts = m.faces[best].idx.map(P);
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    sparkle(ctx, cx - size * 0.04, cy - size * 0.04, size * 0.07, '#FFFFFF', lw * 0.55);
  }
  ctx.restore();
}

/** A four-point star with an ink edge. */
function sparkle(ctx, x, y, s, fill, lw) {
  const k = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + k, y + k);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - k, y + k);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - k, y - k);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// The opal, from the site's opal mark (the "opal" symbol in lib/art.mjs),
// in its 48 × 48 box: a cyan stone with magenta, yellow, red and green
// patches of colour, a halftone, a white highlight and a yellow sparkle.
let OPAL = null;
function opalPaths() {
  if (OPAL) return OPAL;
  const dots = new Path2D();
  for (let y = 3; y < 48; y += 6) for (let x = 3; x < 48; x += 6) {
    dots.moveTo(x + 1.25, y);
    dots.arc(x, y, 1.25, 0, Math.PI * 2);
  }
  OPAL = {
    stone: new Path2D('M24 4c10 0 17 9 17 20s-7 20-17 20S7 35 7 24 14 4 24 4z'),
    patches: [
      ['#FF2E93', new Path2D('M0 16L21 6l14 13-19 10z')],
      ['#FFE11A', new Path2D('M24 29l24-8v20l-18 7z')],
      ['#FF4A3D', new Path2D('M2 34l15-4 5 18H0z')],
      ['#13C08B', new Path2D('M30 4l18 2v10l-13 3z')],
    ],
    dots,
    shine: new Path2D('M14 17c1.5-4.5 4.5-7 8.5-8'),
    star: new Path2D('M40 4l1.3 3.2 3.2 1.3-3.2 1.3L40 13l-1.3-3.2-3.2-1.3 3.2-1.3z'),
  };
  return OPAL;
}

/** Draw the opal (the wild) centred at (x, y), fitting a box of `size` px. */
export function drawOpal(ctx, x, y, size) {
  const o = opalPaths();
  const s = size / 42;
  ctx.save();
  ctx.translate(x - 24 * s, y - 24 * s);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // hard shadow
  ctx.save();
  ctx.translate(2, 2);
  ctx.fillStyle = INK;
  ctx.fill(o.stone);
  ctx.restore();
  ctx.save();
  ctx.clip(o.stone);
  ctx.fillStyle = '#00AEEF';
  ctx.fillRect(0, 0, 48, 48);
  for (const [fill, p] of o.patches) {
    ctx.fillStyle = fill;
    ctx.fill(p);
  }
  ctx.fillStyle = 'rgb(24 18 43 / 0.35)';
  ctx.fill(o.dots);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke(o.stone);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.2;
  ctx.stroke(o.shine);
  ctx.fillStyle = '#FFE11A';
  ctx.fill(o.star);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke(o.star);
  ctx.restore();
}
