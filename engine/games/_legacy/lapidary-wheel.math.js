// Lapidary Wheel: single-zero (European) roulette maths, with no DOM.

// Pocket order clockwise from zero, as on every European wheel.
export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Garnet stands in for red and Whitby jet for black. Zero is malachite green.
export const GARNET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function colourOf(n) {
  if (n === 0) return 'malachite';
  return GARNET.has(n) ? 'garnet' : 'jet';
}

export const CHIPS = [1, 5, 25, 100];
export const TABLE_LIMIT = 500;

// Every bet the table accepts. `covers` lists the numbers it wins on and
// `pays` is the odds paid to one (the stake comes back on top).
export const BETS = (() => {
  const bets = {};
  for (let n = 0; n <= 36; n++) bets[`n${n}`] = { label: String(n), covers: [n], pays: 35 };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const all = range(1, 36);
  bets.garnet = { label: 'Garnet', covers: all.filter((n) => GARNET.has(n)), pays: 1 };
  bets.jet = { label: 'Jet', covers: all.filter((n) => !GARNET.has(n)), pays: 1 };
  bets.odd = { label: 'Odd', covers: all.filter((n) => n % 2 === 1), pays: 1 };
  bets.even = { label: 'Even', covers: all.filter((n) => n % 2 === 0), pays: 1 };
  bets.low = { label: '1 to 18', covers: range(1, 18), pays: 1 };
  bets.high = { label: '19 to 36', covers: range(19, 36), pays: 1 };
  bets.d1 = { label: '1st 12', covers: range(1, 12), pays: 2 };
  bets.d2 = { label: '2nd 12', covers: range(13, 24), pays: 2 };
  bets.d3 = { label: '3rd 12', covers: range(25, 36), pays: 2 };
  bets.c1 = { label: 'Column 1', covers: all.filter((n) => n % 3 === 1), pays: 2 };
  bets.c2 = { label: 'Column 2', covers: all.filter((n) => n % 3 === 2), pays: 2 };
  bets.c3 = { label: 'Column 3', covers: all.filter((n) => n % 3 === 0), pays: 2 };
  return bets;
})();

/**
 * Settle a spin. `stakes` maps bet ids to Carats staked.
 * Returns the total that comes back (winning stakes plus their pay).
 */
export function settle(stakes, number) {
  let returned = 0;
  const winners = [];
  for (const [id, amount] of Object.entries(stakes)) {
    if (!amount) continue;
    const bet = BETS[id];
    if (bet.covers.includes(number)) {
      const back = amount * (bet.pays + 1);
      returned += back;
      winners.push({ id, amount, back });
    }
  }
  return { returned, winners };
}

/**
 * Return to player for any single bet. Each of the 37 pockets is equally
 * likely, so a bet covering k numbers and paying p to 1 returns
 * k × (p + 1) ÷ 37. For every bet on this table that is 36 ÷ 37.
 */
export function rtpOf(id) {
  const b = BETS[id];
  return (b.covers.length * (b.pays + 1)) / WHEEL.length;
}
