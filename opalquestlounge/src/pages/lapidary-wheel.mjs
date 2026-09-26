import { html, esc, num, pct } from '../lib/html.mjs';
import { videoGameLd, breadcrumbs } from '../lib/layout.mjs';
import { wheelPanel, tablePageHero, tablePageFacts, tablePageQuestions, tablePageMore } from '../lib/ui/tables.mjs';

export default function lapidaryWheel(ctx) {
  const g = ctx.game('lapidary-wheel');
  const { WHEEL, BETS, colourOf, rtpOf, CHIPS, TABLE_LIMIT } = ctx.wheel;
  const c = ctx.cur;
  const colourName = (n) => ({ malachite: 'Malachite', garnet: 'Garnet', jet: 'Jet' })[colourOf(n)];
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Table games', path: '/games/#tables' },
    { name: g.name, path: g.path },
  ];

  const betRows = [
    ['Straight up', 'n17', 'Any single number, zero included'],
    ['Dozen', 'd1', '1–12, 13–24 or 25–36'],
    ['Column', 'c1', 'A row of twelve on the table'],
    ['Garnet or Jet', 'garnet', 'All eighteen numbers of one colour'],
    ['Odd or Even', 'odd', 'Eighteen numbers; zero is neither'],
    ['1–18 or 19–36', 'low', 'Low or high half'],
  ];

  return {
    id: 'game-lapidary-wheel',
    path: g.path,
    title: `Lapidary Wheel: Free European Roulette · ${ctx.brand}`,
    description: `Free single-zero roulette with virtual ${c.plural}. Bets, pays, the full wheel order and why every bet returns 97.30%. No real money. 18+.`,
    ogImage: g.image,
    ogAlt: 'Lapidary Wheel: a single-zero roulette wheel with garnet, jet and malachite pockets around a gem.',
    breadcrumbs: crumbs,
    crumbsInBody: true,
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/lapidary-wheel.js', '/assets/js/games/lapidary-wheel.math.js'],
    bodyClass: 'is-game',
    body: html`
${tablePageHero(ctx, g, {
  crumbs: breadcrumbs(crumbs),
  panel: wheelPanel(ctx, { headingId: 'play' }),
  back: '/games/#tables',
  summary: 'Single-zero roulette. Garnet stands in for red, jet for black, and malachite marks the zero.',
})}

<section class="game-body" aria-label="Rules and pays">
  <div class="wrap game-body__grid game-body__grid--table">
    ${tablePageFacts(g, [
      ['Game', 'European roulette'],
      ['Wheel', '37 pockets', 'One zero, no double zero'],
      ['Chips', `${CHIPS.join(', ')} ${esc(c.plural)}`],
      ['Table limit', `${num(TABLE_LIMIT)} ${esc(c.plural)} a spin`],
      ['Top payout', '35 to 1', 'A straight-up number'],
      ['<abbr title="Return to player">RTP</abbr>', g.rtpLabel, 'Exact: 36 ÷ 37 for every bet'],
    ], {
      note: `${esc(c.plural)} are free and have no cash value. Doing well in a free game doesn't mean you'd do well gambling with real money.`,
      toc: [
        ['#how-to-play', 'How to play'],
        ['#bets', 'Bets and pays'],
        ['#rtp', 'Why every bet returns 97.30%'],
        ['#wheel-order', 'The wheel order'],
        ['#rules', 'The rules in full'],
        ['#history', 'A short history of roulette'],
        ['#questions', 'Questions'],
      ],
    })}
    <div class="prose">
      <h2 id="how-to-play">How to play</h2>
      <ol>
        <li>Pick a chip: ${CHIPS.join(', ')} ${esc(c.plural)}.</li>
        <li>Place it on the table. Press a number or an outside bet once for each chip. <strong>Undo</strong> takes off the last chip; <strong>Clear</strong> takes them all.</li>
        <li>Press <strong>Spin</strong>. The ball drops into one of 37 pockets.</li>
        <li>Every bet that covers that pocket is paid at the odds below, and its stake comes back on top. Chips on other bets are taken.</li>
        <li><strong>Same again</strong> puts your last set of chips back down.</li>
      </ol>
      <p>The table limit is ${num(TABLE_LIMIT)} ${esc(c.plural)} a spin.</p>

      <h2 id="bets">Bets and pays</h2>
      <div class="table-wrap">
      <table class="paytable paytable--wide">
        <caption>Every bet on the Lapidary Wheel table</caption>
        <thead><tr><th scope="col">Bet</th><th scope="col">Covers</th><th scope="col">Pays</th><th scope="col">Chance</th><th scope="col"><abbr title="Return to player">RTP</abbr></th></tr></thead>
        <tbody>
          ${betRows.map(([name, id, covers]) => {
            const b = BETS[id];
            return `<tr><th scope="row">${name}</th><td class="td--text">${covers}</td><td class="num">${b.pays} to 1</td><td class="num">${b.covers.length} in 37</td><td class="num">${pct(rtpOf(id))}</td></tr>`;
          })}
        </tbody>
      </table>
      </div>
      <p>"Pays 35 to 1" means a 1-${esc(c.singular)} chip on the number that comes up brings back 36: the 35 it pays plus the chip itself.</p>

      <h2 id="rtp">Why every bet returns 97.30%</h2>
      <p>Each of the 37 pockets is equally likely. Take a 1-${esc(c.singular)} chip on 17. It comes up once in 37 spins on average and brings back 36 when it does. So over a long run, each ${esc(c.singular)} staked returns 36 ÷ 37 of itself.</p>
      <p>The same sum works for every bet on the table. A garnet bet pays 18 times in 37 and brings back 2: 18 × 2 ÷ 37 = 36 ÷ 37. A dozen pays 12 times in 37 and brings back 3: 12 × 3 ÷ 37 = 36 ÷ 37.</p>
      <div class="callout callout--note callout--figure"><p class="callout__figure num">${pct(36 / 37, 3)}</p><p>Exact return to player for every bet. The missing 2.70% is the zero: when the ball lands there, every outside bet loses.</p></div>
      <p>American wheels add a second zero, which lowers the return to 36 ÷ 38, or 94.74%. That's why this table has only one.</p>

      <h2 id="wheel-order">The wheel order</h2>
      <p>Clockwise from zero, the 37 pockets of a European wheel run in this order. Colours alternate, and low, high, odd and even numbers are spread so that no arc of the wheel favours a simple bet.</p>
      <ol class="wheel-order" aria-label="Pockets clockwise from zero">
        ${WHEEL.map((n) => `<li class="is-${colourOf(n)}"><span class="num">${n}</span><span class="visually-hidden"> ${colourName(n)}</span></li>`)}
      </ol>
      <p>Written out: ${WHEEL.join(', ')}.</p>

      <h2 id="rules">The rules in full</h2>
      <ul>
        <li>One zero. No <em>en prison</em> or <em>la partage</em>: outside bets lose in full on zero.</li>
        <li>Bets: straight up on 0 to 36, dozens, columns, Garnet or Jet, Odd or Even, 1–18 or 19–36.</li>
        <li>Chips of ${CHIPS.join(', ')}. Table limit ${num(TABLE_LIMIT)} ${esc(c.plural)} a spin.</li>
        <li>The pocket comes from <code>crypto.getRandomValues</code> as soon as you press Spin. The ball's path is drawn to finish in that pocket.</li>
        <li>Your balance is updated when the result is decided, before the animation ends.</li>
      </ul>

      <h2 id="history">A short history of roulette</h2>
      <p><em>Roulette</em> is French for "little wheel". The game was being played in Paris by the late 18th century. A novel by Jaques Lablée, published in 1801, describes the wheel at the Palais-Royal in 1796, with two pockets for the bank: a zero and a double zero.</p>
      <p>In 1843 the brothers François and Louis Blanc opened a casino at Bad Homburg in Germany with a single-zero wheel, which halved the bank's edge and drew players from rival houses. François Blanc later ran the casino at Monte Carlo, and the single-zero wheel became the European standard.</p>
      <p>The names on this wheel are gemstones. Deep red garnets were everywhere in 19th-century jewellery. Jet, a black fossil wood from the cliffs at Whitby in Yorkshire, became the fashion after Prince Albert died in 1861. Malachite is a banded green copper mineral.</p>
    </div>
  </div>

  ${tablePageQuestions([
    ['Is there a pattern to the numbers?', 'No. Every spin is independent. A number that hasn\'t come up for a while is no more likely next time. The results list shows only what happened.'],
    ['Why do the numbers show as Garnet and Jet, not red and black?', 'They\'re the same thing: garnet is the red, jet is the black. The table and results name both, so screen readers announce them clearly.'],
    ['Can I play with the keyboard?', 'Yes. Tab to the table, move with the arrow keys, press <kbd>Enter</kbd> to place a chip and <kbd>Backspace</kbd> to take one off. Press <kbd>S</kbd> to spin.'],
  ])}
</section>

${tablePageMore(ctx, g)}`,
  };
}
