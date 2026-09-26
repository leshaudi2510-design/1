// Randomness for every game: the browser's cryptographic generator.
// randomInt uses rejection sampling so every value is exactly equally likely.

const buf = new Uint32Array(1);
const RANGE = 2 ** 32;

export function randomInt(n) {
  if (!Number.isInteger(n) || n < 1 || n > RANGE) throw new RangeError(`randomInt(${n})`);
  const limit = RANGE - (RANGE % n);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}

/** Fisher–Yates shuffle, in place. */
export function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
