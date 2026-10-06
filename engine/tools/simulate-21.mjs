#!/usr/bin/env node
// Monte Carlo check of the twenty-one return to player (the engine's
// blackjack maths, engine/games/_legacy/brilliant-21.math.js), playing the
// same basic strategy the game offers as a hint.
//
//   node engine/tools/simulate-21.mjs [<site-dir>] [hands]
//   node engine/tools/simulate-21.mjs sites/opalquestlounge 20000000
//
// The site folder only names the play currency in the result line (its
// site.config.json currency.singular); the maths are the engine's. Hands
// default to 1,000,000. Phase 3 adds --spec for a game's own rule set.
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  freshShoe, score, isBrilliant, canSplit, dealerShouldDraw, basicStrategy, settleHand, DECKS, CUT_AT,
} from '../games/_legacy/brilliant-21.math.js';

const args = process.argv.slice(2);
const isSite = (a) => existsSync(a) && statSync(a).isDirectory();
const siteArg = args.find(isSite);
const handsArg = args.find((a) => !isSite(a) && !a.startsWith('--'));
const N = Number(handsArg || 1_000_000);
if (!Number.isInteger(N) || N <= 0) {
  console.error('usage: node engine/tools/simulate-21.mjs [<site-dir>] [hands]');
  process.exit(2);
}
let unit = 'unit';
if (siteArg) {
  const cfgFile = path.join(siteArg, 'site.config.json');
  if (!existsSync(cfgFile)) {
    console.error(`error: ${siteArg} has no site.config.json`);
    process.exit(2);
  }
  unit = JSON.parse(readFileSync(cfgFile, 'utf8')).currency?.singular || unit;
}
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
console.log(`Return per ${unit} staked (doubles and splits included): ${(100 * returned / staked).toFixed(3)}%`);
