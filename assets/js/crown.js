/* Pixel Crown Club: the hero crown. Built pixel by pixel on load, then a glint sweeps across it. */
(function () {
  'use strict';

  const canvas = document.getElementById('crown');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const C = Lounge.PALETTE;

  const CROWN = [
    '.GGG...GGG...GGG.',
    '.GWG...GWG...GWG.',
    '..G.....G.....G..',
    '..GG...GGG...GG..',
    '..GGG.GGGGG.GGG..',
    '..GLLGGGGGGGGGG..',
    '..GLGGGGGGGGGGG..',
    '..GDDDDDDDDDDDG..',
    '..DRDDEDRDEDDRD..',
    '..GDDDDDDDDDDDG..',
    '..GGGGGGGGGGGGG..',
    '.DDDDDDDDDDDDDDD.',
  ];
  const COLS = CROWN[0].length;
  const ROWS = CROWN.length;

  // Pixels arrive from the base upward, with a little scatter inside each row.
  const cells = [];
  CROWN.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (C[ch]) cells.push({ x, y, ch, at: (ROWS - y) * 55 + Lounge.rint(160) });
    });
  });
  const BUILT = Math.max(...cells.map((c) => c.at)) + 200;

  const SPARKS = [
    { x: -3, y: 1, ph: 0 }, { x: 19, y: 3, ph: 1.4 }, { x: -2, y: 9, ph: 2.2 },
    { x: 19, y: 10, ph: 0.6 }, { x: 8, y: -3, ph: 2.9 }, { x: 3, y: -2, ph: 3.7 },
    { x: 14, y: 14, ph: 1.9 },
  ];

  let W = 0, H = 0, P = 1, ox = 0, oy = 0;
  let t0 = performance.now();
  let raf = 0, visible = true;

  function layout() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P = Math.max(4, Math.floor(Math.min(W / (COLS + 8), H / (ROWS + 7))));
    ox = Math.round((W - COLS * P) / 2);
    oy = Math.round((H - ROWS * P) / 2 - P);
  }

  function frame(now) {
    const reduce = Lounge.reduceMotion();
    const t = reduce ? BUILT + 1 : now - t0;
    ctx.clearRect(0, 0, W, H);

    // Floor reflection: stepped pixel rows under the crown.
    const base = oy + (ROWS + 1) * P;
    [[15, 0.16], [11, 0.1], [7, 0.06]].forEach(([w, a], i) => {
      ctx.fillStyle = `rgba(242, 193, 78, ${a})`;
      ctx.fillRect(ox + ((COLS - w) / 2) * P, base + i * P, w * P, P);
    });

    // Glint band travels along x + y once the crown is built.
    const cycle = 3800;
    const glint = !reduce && t > BUILT ? (((t - BUILT) % cycle) / cycle) * 46 - 8 : -99;

    for (const c of cells) {
      if (t < c.at) continue;
      let col = C[c.ch];
      if (t - c.at < 110) col = C.W;
      else if (c.ch !== 'R' && c.ch !== 'E' && Math.abs(c.x + c.y - glint) < 1.1) col = C.W;
      ctx.fillStyle = col;
      ctx.fillRect(ox + c.x * P, oy + c.y * P, P, P);
    }

    // Four-point pixel sparkles.
    const q = Math.max(2, Math.round(P / 2));
    for (const s of SPARKS) {
      const a = reduce ? 0.8 : Math.sin(t / 520 + s.ph);
      if (a < 0.25 || t < BUILT * 0.6) continue;
      const x = ox + s.x * P, y = oy + s.y * P;
      ctx.fillStyle = a > 0.7 ? C.W : C.L;
      ctx.fillRect(x, y, q, q);
      if (a > 0.7) {
        ctx.fillStyle = C.G;
        ctx.fillRect(x - q, y, q, q); ctx.fillRect(x + q, y, q, q);
        ctx.fillRect(x, y - q, q, q); ctx.fillRect(x, y + q, q, q);
      }
    }

    if (!reduce && visible) raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    layout();
    raf = requestAnimationFrame(frame);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 120);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const was = visible;
      visible = entries[0].isIntersecting;
      if (visible && !was) start();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) start();
  });

  start();
})();
