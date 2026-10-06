// Seven Systems: the maths, with no DOM. The browser game and the site
// build both import this file, so the paytable and RTP printed on the page
// come from the same numbers the reels use.

export const SYMBOLS = {
  O: { name: 'Opal', system: 'Amorphous', set: null, hardness: '5½–6½', note: 'No crystal lattice, so it stands in for any mineral.' },
  B: { name: 'Beryl', system: 'Hexagonal', set: 'hex', hardness: '7½–8', note: 'Six-sided prisms. Emerald and aquamarine are beryl.' },
  Q: { name: 'Quartz', system: 'Trigonal', set: 'hex', hardness: '7', note: 'Six-sided prism capped with a pyramid.' },
  G: { name: 'Garnet', system: 'Cubic', set: 'right', hardness: '6½–7½', note: 'Twelve rhombic faces: the dodecahedron.' },
  Z: { name: 'Zircon', system: 'Tetragonal', set: 'right', hardness: '7½', note: 'Square prism with pointed ends.' },
  T: { name: 'Topaz', system: 'Orthorhombic', set: 'right', hardness: '8', note: 'Three unequal axes, all at right angles.' },
  F: { name: 'Orthoclase', system: 'Monoclinic', set: 'tilt', hardness: '6', note: 'A feldspar. One axis leans.' },
  X: { name: 'Axinite', system: 'Triclinic', set: 'tilt', hardness: '6½–7', note: 'No right angles anywhere: sharp, axe-like blades.' },
};

export const SETS = {
  hex: { name: 'Hexagonal family', members: ['B', 'Q'], pays: 4, note: 'Beryl and Quartz in any mix' },
  right: { name: 'Right-angled axes', members: ['G', 'Z', 'T'], pays: 3, note: 'Garnet, Zircon and Topaz in any mix' },
  tilt: { name: 'Tilted axes', members: ['F', 'X'], pays: 2, note: 'Orthoclase and Axinite in any mix' },
};

// Pays for three of a kind, as multiples of the line stake.
export const TRIPLE = { O: 100, B: 40, Q: 25, G: 20, Z: 12, T: 10, F: 6, X: 5 };

// Three reels of 34 stops. Each reel holds the same count of every symbol
// (Opal 2, Beryl 2, Quartz 2, Garnet 3, Zircon 4, Topaz 5, Orthoclase 7,
// Axinite 9) in a different order.
export const STRIPS = [
  'BXFGTZXTZFXTGXFXTXOQZFTGBFXOFXZXQF',
  'BZTOXTXTXFQXFOXGXGTFXGFZXZFQBFZFXT',
  'BXTXTFGZTGXZFXOBFQFZXGXFTXZQXTOFXF',
].map((s) => s.split(''));

export const STOPS = 34;

// Rows are 0 (top), 1 (middle), 2 (bottom). Line 1 is the middle row.
export const LINES = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];

export const STAKES = [10, 20, 50, 100];

/** The three visible symbols on a reel that has stopped at `stop`. */
export function column(reel, stop) {
  const s = STRIPS[reel];
  return [s[(stop + STOPS - 1) % STOPS], s[stop], s[(stop + 1) % STOPS]];
}

/** Grid as [reel][row]. */
export function grid(stops) {
  return stops.map((stop, reel) => column(reel, stop));
}

/** Best pay for one line of three symbols, in multiples of the line stake. */
export function linePay(a, b, c) {
  const three = [a, b, c];
  const crystals = three.filter((s) => s !== 'O');
  if (crystals.length === 0) return { pays: TRIPLE.O, kind: 'triple', symbol: 'O' };
  let best = { pays: 0, kind: null };
  if (crystals.every((s) => s === crystals[0])) {
    best = { pays: TRIPLE[crystals[0]], kind: 'triple', symbol: crystals[0] };
  }
  const set = SYMBOLS[crystals[0]].set;
  if (crystals.every((s) => SYMBOLS[s].set === set) && SETS[set].pays > best.pays) {
    best = { pays: SETS[set].pays, kind: 'set', set };
  }
  return best;
}

/** Settle a spin. Returns every paying line and the total returned. */
export function settle(stops, stake) {
  const g = grid(stops);
  const lineStake = stake / LINES.length;
  const wins = [];
  LINES.forEach((rows, i) => {
    const syms = rows.map((row, reel) => g[reel][row]);
    const r = linePay(...syms);
    if (r.pays > 0) wins.push({ line: i + 1, rows, symbols: syms, ...r, amount: r.pays * lineStake });
  });
  return { grid: g, wins, returned: wins.reduce((t, w) => t + w.amount, 0) };
}

/**
 * Exact return to player. Every combination of the three reel stops is
 * equally likely, so we visit all 34 × 34 × 34 = 39,304 of them and average
 * what comes back. No sampling, no rounding until the end.
 */
export function exactStats() {
  let returned = 0;
  let hits = 0;
  const outcomes = {};
  for (let a = 0; a < STOPS; a++) {
    for (let b = 0; b < STOPS; b++) {
      for (let c = 0; c < STOPS; c++) {
        const r = settle([a, b, c], LINES.length);
        returned += r.returned;
        if (r.wins.length) hits++;
        for (const w of r.wins) {
          const key = w.kind === 'triple' ? w.symbol : `set:${w.set}`;
          outcomes[key] = (outcomes[key] || 0) + 1;
        }
      }
    }
  }
  const spins = STOPS ** 3;
  const lineChecks = spins * LINES.length;
  return {
    spins,
    rtp: returned / (spins * LINES.length),
    hitRate: hits / spins,
    // Chance that a single line shows each result.
    lineOdds: Object.fromEntries(Object.entries(outcomes).map(([k, n]) => [k, n / lineChecks])),
  };
}
