# Game facts

The only fact source for game copy beyond the maths modules themselves and the provider catalogue (ECC-ADOPTION A-36, A-62). `copywriter`, `game-skinner` and `pragmatic-curator` take numbers and rules from here or from the code; each site rewrites them in its own vocabulary, so the words differ while the numbers stay exact. Owner: partition H. Sources: the reference build's maths modules (`opalquestlounge/src/public/assets/js/games/*.math.js`, moving to `engine/games/` in Phase 1), `opalquestlounge/src/lib/context.mjs`, `opalquestlounge/tools/simulate-21.mjs`, `opalquestlounge/COMPLIANCE.md` section 1; figures below were re-run from those modules on 2026-10-06.

Rules for using this file:

1. **A number in copy must come from code or from this file.** If a skin changes a rule (decks, payouts, reels), the number is recomputed by the code for that skin; never adjust a figure by hand.
2. **Provider demo facts are not here.** RTP, maximum win, volatility and layout of third-party demos live in `sites/<slug>/data/pragmatic-games.json` with a `verify` list and a `checked` date from a UK-browser check (`/pragmatic-verify`). An unchecked figure is never stated as the provider's.
3. **Rounding as the reference build prints it:** wheel and slot RTP to two decimals ("97.30%", "96.02%"); twenty-one as "about 99.6%" (one decimal, labelled as a simulation).
4. **History and trivia need a source.** Add a claim only with its source and a confidence note; none is recorded yet.

## Wheel (engine plugin `roulette`; skin in the reference build: Lapidary Wheel)

Single-zero (European) wheel: 37 pockets, 0 to 36, each equally likely.

Pocket order clockwise from zero (`WHEEL`):

```
0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
```

Red numbers (the reference skin calls red "garnet", black "jet" and zero "malachite"): 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36. Zero is neither colour, odd nor even, low nor high.

Bets offered by the reference table and what they pay (odds to one; the stake comes back on top):

| Bet | Numbers covered | Pays |
|---|---|---|
| Straight (one number, 0-36) | 1 | 35 to 1 |
| Red or black | 18 | 1 to 1 |
| Odd or even | 18 | 1 to 1 |
| 1 to 18 or 19 to 36 | 18 | 1 to 1 |
| Dozen (1st, 2nd, 3rd 12) | 12 | 2 to 1 |
| Column | 12 | 2 to 1 |

Return to player: a bet covering *k* numbers and paying *p* to 1 returns *k* x (*p* + 1) / 37. For every bet above that is **36/37 = 97.30%** (`rtpOf()`). The same arithmetic gives 36/37 for any bet laid out the standard way on a single-zero table (a split covers 2 and pays 17 to 1: 2 x 18 / 37). On a double-zero wheel (38 pockets) the same payouts give 36/38 = 94.74%; the factory's wheel is single-zero.

Reference table limits (skin values, not rules of the game): chips 1, 5, 25, 100; table limit 500.

## Twenty-one (engine plugin `blackjack`; skin: Brilliant Twenty-One)

Rules as implemented in the reference skin (`brilliant-21.math.js`):

| Rule | Value |
|---|---|
| Decks | 6; reshuffle when a quarter of the shoe is left |
| Dealer | draws to 17 and stands on all 17s |
| Two-card 21 (the skin calls it a "Brilliant") | pays 3 to 2; a two-card 21 after a split counts as 21, not a natural |
| Dealer natural | dealer checks under an Ace or ten-value card; a player natural against a dealer natural pushes |
| Double | on any first two cards, including after a split |
| Split | once; split Aces take one card each |
| Insurance, surrender | none |
| Stakes (skin values) | 10, 25, 50, 100 |

Return to player with basic strategy for these rules: **about 99.6%** (`TWENTY_ONE_RTP = 0.9957`, measured by `tools/simulate-21.mjs` over 20 million hands). This is a simulation figure; a skin that changes any rule above must re-run the simulator (`simulate-21.mjs --spec`, Phase 3) and publish the new figure. The basic-strategy tables printed on the game page come from the same `basicStrategy()` function the in-game hint uses.

## Reel slot (engine plugin `reel-slot`; skin: Seven Systems)

Mechanics in the reference skin (`seven-systems.math.js`):

- 3 reels of 34 stops; 3 rows visible; every stop combination equally likely.
- 5 lines: middle row, top row, bottom row, and the two diagonals. The stake is split equally across the 5 lines.
- Symbol counts, the same on every reel in a different order: Opal 2, Beryl 2, Quartz 2, Garnet 3, Zircon 4, Topaz 5, Orthoclase 7, Axinite 9 (34).
- Opal is wild: it stands in for any symbol; three Opals pay as their own triple.

Pays, as multiples of the line stake:

| Line | Pays |
|---|---|
| Three Opal | 100 |
| Three Beryl | 40 |
| Three Quartz | 25 |
| Three Garnet | 20 |
| Three Zircon | 12 |
| Three Topaz | 10 |
| Three Orthoclase | 6 |
| Three Axinite | 5 |
| Any mix of Beryl and Quartz (with Opal as wild) | 4 |
| Any mix of Garnet, Zircon and Topaz | 3 |
| Any mix of Orthoclase and Axinite | 2 |

A line pays its best result only (a triple outranks the mixed set when it pays more).

Return to player: **96.02%**, exact, by visiting all 34 x 34 x 34 = 39,304 stop combinations (`exactStats()`; 0.960182 before rounding). Chance that a spin pays on at least one line: 72.36%. No sampling, no rounding until the end; any skin that changes strips, lines or pays recomputes both figures the same way.

## Fairness facts every social-casino site may state

These describe the engine, so they hold for every factory site that uses the house games (invariant SC-FAIR-01):

- Outcomes are drawn with `crypto.getRandomValues` using rejection sampling, before any animation starts.
- Nothing adapts to the player's balance, history or time played.
- The RTP printed on a game page is computed by the same code the game runs.
- A round that returns less than the stake is reported as a loss ("N down on this one" in the reference copy), never as a win.
- The virtual currency has no monetary value, cannot be bought unless the order says `purchases: true` (then disclosed), and cannot be exchanged for money, prizes or anything of value.

## Support facts (social-casino)

| Fact | Value | Source in the repo |
|---|---|---|
| GamCare helpline | 0808 8020 133 | footer and RG page of the reference build |
| NHS gambling support | https://www.nhs.uk/live-well/addiction-support/gambling-addiction/ | footer of the reference build |
| (Be)GambleAware | not linked; the reference `COMPLIANCE.md` records that GambleAware closed on 31 March 2026 and its work passed to NHS England, OHID and UKRI | `opalquestlounge/COMPLIANCE.md` 1.6; fleet-wide rule awaits owner confirmation (ECC-ADOPTION question 7) |

Helplines for other markets come from `types/<type>/helplines.json` (verified fields as in `policy-urls.json`), never from copy.

## Games planned later

`dice` and `hi-lo` plugins arrive in Phase 4 (roster rule, SPEC 15.3). Their facts are added here when their maths modules exist, computed the same way.
