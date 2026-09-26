// Monte Carlo check of the Brilliant Twenty-One return to player, playing
// the same basic strategy the game offers as a hint.
//   node tools/simulate-21.mjs 2000000
import { randomInt } from 'node:crypto';
import {
  freshShoe, score, isBrilliant, canSplit, dealerShouldDraw, basicStrategy, settleHand, DECKS, CUT_AT,
} from '../src/public/assets/js/games/brilliant-21.math.js';

const N = Number(process.argv[2] || 1_000_000);
let shoe = [];
const shuffle = () => {
  shoe = freshShoe();
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
};
shuffle();
const draw = () => shoe.pop();

let staked = 0;
let returned = 0;
for (let n = 0; n < N; n++) {
  if (shoe.length < DECKS * 52 * CUT_AT) shuffle();
  const stake = 1;
  staked += stake;
  const player = [draw(), draw()];
  const dealer = [draw(), draw()];
  if (isBrilliant(dealer) || isBrilliant(player)) {
    returned += settleHand({ cards: player, stake, split: false }, dealer).back;
    continue;
  }
  const hands = [{ cards: player, stake, split: false, done: false }];
  for (let i = 0; i < hands.length; i++) {
    const h = hands[i];
    while (!h.done) {
      if (score(h.cards).total >= 21) break;
      const move = basicStrategy(h.cards, dealer[0], {
        canDouble: h.cards.length === 2,
        canSplitNow: canSplit(h, hands.length),
      });
      if (move === 'S') break;
      if (move === 'H') { h.cards.push(draw()); continue; }
      if (move === 'D') { staked += h.stake; h.stake *= 2; h.cards.push(draw()); break; }
      if (move === 'P') {
        staked += h.stake;
        const moved = h.cards.pop();
        const aces = moved.rank === 'A';
        h.split = true;
        h.cards.push(draw());
        hands.push({ cards: [moved, draw()], stake: h.stake, split: true, done: aces });
        if (aces) break;
      }
    }
  }
  if (hands.some((h) => score(h.cards).total <= 21)) while (dealerShouldDraw(dealer)) dealer.push(draw());
  for (const h of hands) returned += settleHand(h, dealer).back;
}
console.log(`${N.toLocaleString('en-GB')} hands`);
console.log(`Return per Carat staked (doubles and splits included): ${(100 * returned / staked).toFixed(3)}%`);
