import { html, esc, num, pct } from '../lib/html.mjs';
import { videoGameLd, breadcrumbs } from '../lib/layout.mjs';
import { twentyOnePanel, tablePageHero, tablePageFacts, tablePageQuestions, tablePageMore } from '../lib/ui/tables.mjs';

// Build the basic-strategy charts from the same function the in-game hint uses.
function strategyTables(bj) {
  const card = (rank) => ({ rank, suit: 'spades' });
  const ups = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const cell = (cards, up, canSplitNow = false) => {
    const withDouble = bj.basicStrategy(cards, card(up), { canDouble: true, canSplitNow });
    if (withDouble !== 'D') return withDouble;
    const without = bj.basicStrategy(cards, card(up), { canDouble: false, canSplitNow });
    return without === 'S' ? 'Ds' : 'D';
  };
  // Arrays, not objects: an object would list the numeric keys (9 to 16) before "8 or less".
  const hardHands = [
    ['8 or less', ['3', '5']], ['9', ['4', '5']], ['10', ['4', '6']], ['11', ['5', '6']], ['12', ['10', '2']], ['13', ['10', '3']],
    ['14', ['10', '4']], ['15', ['10', '5']], ['16', ['10', '6']], ['17 or more', ['10', '7']],
  ];
  const softHands = ['2', '3', '4', '5', '6', '7', '8', '9'].map((r) => [`A,${r}`, ['A', r]]);
  const pairs = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map((r) => [`${r},${r}`, r]);
  const NAMES = { H: 'Hit', S: 'Stand', D: 'Double, or hit if you can’t', Ds: 'Double, or stand if you can’t', P: 'Split' };
  const table = (caption, rows, isPair = false) => html`<div class="table-wrap"><table class="strategy">
    <caption>${caption}</caption>
    <thead><tr><th scope="col">Your hand</th>${ups.map((u) => `<th scope="col" class="num"><span class="visually-hidden">Dealer shows </span>${u}</th>`)}</tr></thead>
    <tbody>${rows.map(([label, cards]) => {
      const hand = isPair ? [card(cards), card(cards)] : cards.map(card);
      return `<tr><th scope="row" class="num">${label}</th>${ups
        .map((u) => {
          const m = cell(hand, u, isPair);
          return `<td class="mv mv--${m}"><abbr title="${NAMES[m]}">${m}</abbr></td>`;
        })
        .join('')}</tr>`;
    })}</tbody></table></div>`;
  return (
    table('Hard totals (no Ace, or an Ace counted as 1), against the dealer’s face-up card', hardHands) +
    table('Soft totals (an Ace counted as 11)', softHands) +
    table('Pairs, when you can split', pairs, true)
  );
}

export default function brilliant21(ctx) {
  const g = ctx.game('brilliant-twenty-one');
  const { STAKES, DECKS } = ctx.bj;
  const c = ctx.cur;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Table games', path: '/games/#tables' },
    { name: g.name, path: g.path },
  ];
  const rtp = g.rtpLabel.replace('about ', '≈ ');

  return {
    id: 'game-brilliant-twenty-one',
    path: g.path,
    title: `Brilliant Twenty-One: Free Blackjack · ${ctx.brand}`,
    description: `Free six-deck blackjack with virtual ${c.plural}. Full rules, pays, a basic strategy chart and how we measured its ${g.rtpLabel} RTP. 18+.`,
    ogImage: g.image,
    ogAlt: 'Brilliant Twenty-One: two playing cards with lettered court cards on a blue table.',
    breadcrumbs: crumbs,
    crumbsInBody: true,
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/brilliant-21.js', '/assets/js/games/brilliant-21.math.js'],
    bodyClass: 'is-game',
    body: html`
${tablePageHero(ctx, g, {
  crumbs: breadcrumbs(crumbs),
  title: 'Brilliant <span class="nobr">Twenty-One</span>',
  panel: twentyOnePanel(ctx, { headingId: 'play' }),
  back: '/games/#tables',
  summary: 'Six-deck blackjack. A two-card 21 is a Brilliant and pays 3 to 2.',
})}

<section class="game-body" aria-label="Rules and pays">
  <div class="wrap game-body__grid game-body__grid--table">
    ${tablePageFacts(g, [
      ['Game', 'Blackjack'],
      ['Shoe', `${DECKS} decks`, 'Reshuffled when a quarter is left'],
      ['Dealer', 'Stands on every 17'],
      ['Stakes', `${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)}`],
      ['Top payout', '3 to 2', 'A Brilliant: a two-card 21'],
      ['<abbr title="Return to player">RTP</abbr>', rtp, 'Measured: 20 million hands of basic strategy'],
    ], {
      note: `${esc(c.plural)} are free and have no cash value. Doing well in a free game doesn't mean you'd do well gambling with real money.`,
      toc: [
        ['#how-to-play', 'How to play'],
        ['#rules', 'The rules in full'],
        ['#pays', 'Pays'],
        ['#strategy', 'Basic strategy'],
        ['#rtp', 'How we measured the RTP'],
        ['#history', 'A short history of twenty-one'],
        ['#questions', 'Questions'],
      ],
    })}
    <div class="prose">
      <h2 id="how-to-play">How to play</h2>
      <ol>
        <li>Choose a stake of ${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)} and press <strong>Deal</strong>.</li>
        <li>You get two cards face up. The dealer gets one face up and one face down.</li>
        <li>Get closer to 21 than the dealer without going over. Number cards count as their number, court cards as 10, and an Ace as 1 or 11.</li>
        <li><strong>Hit</strong> to take a card. <strong>Stand</strong> to stop. <strong>Double</strong> doubles your stake for exactly one more card. <strong>Split</strong> turns a pair into two hands, each with its own stake.</li>
        <li>When you stand, the dealer turns over the hidden card and draws until reaching 17 or more.</li>
      </ol>

      <h2 id="rules">The rules in full</h2>
      <ul>
        <li>${DECKS} decks of 52 cards, shuffled together. The shoe is reshuffled when a quarter of it is left.</li>
        <li>The dealer stands on every 17, including a soft 17 (an Ace counted as 11 plus six).</li>
        <li>A Brilliant (an Ace and a ten-value card as your first two cards) pays 3 to 2.</li>
        <li>If the dealer shows an Ace or a ten-value card, the dealer checks for a Brilliant straight away. If there is one, the hand ends and you lose only your first stake, unless you also have a Brilliant, which is a push.</li>
        <li>You can double on any first two cards, including after a split.</li>
        <li>You can split any two cards of the same value once, into two hands. Split Aces get one card each. A 21 made after a split counts as 21, not a Brilliant.</li>
        <li>There's no insurance and no surrender.</li>
        <li>If you leave the page in the middle of a hand, the hand is cancelled and your stake is returned.</li>
        <li>Cards come from <code>crypto.getRandomValues</code> via a Fisher–Yates shuffle of the whole shoe.</li>
      </ul>

      <h2 id="pays">Pays</h2>
      <div class="table-wrap">
      <table class="paytable paytable--wide">
        <caption>What comes back on a 10-${esc(c.singular)} stake</caption>
        <thead><tr><th scope="col">Result</th><th scope="col">Pays</th><th scope="col">Back on 10</th></tr></thead>
        <tbody>
          <tr><th scope="row">Brilliant (two-card 21)</th><td class="num">3 to 2</td><td class="num">25</td></tr>
          <tr><th scope="row">Your total beats the dealer's</th><td class="num">1 to 1</td><td class="num">20</td></tr>
          <tr><th scope="row">Push (same total)</th><td>Stake back</td><td class="num">10</td></tr>
          <tr><th scope="row">Dealer's total beats yours, or you go over 21</th><td>Stake lost</td><td class="num">0</td></tr>
        </tbody>
      </table>
      </div>

      <h2 id="strategy">Basic strategy</h2>
      <p>Basic strategy is the move that returns the most, on average, for your two cards against the dealer's face-up card. It was first worked out in 1956 and doesn't need any card counting. Turn on <strong>Show the basic-strategy move</strong> in the game and it will suggest a move for every hand.</p>
      <p class="legend"><span><span class="mv mv--H">H</span> Hit</span> <span><span class="mv mv--S">S</span> Stand</span> <span><span class="mv mv--D">D</span> Double, or hit if you can't</span> <span><span class="mv mv--Ds">Ds</span> Double, or stand if you can't</span> <span><span class="mv mv--P">P</span> Split</span></p>
      ${strategyTables(ctx.bj)}

      <h2 id="rtp">How we measured the RTP</h2>
      <p>The slot and the wheel have no choices, so their return can be counted exactly. Twenty-one depends on how you play, so we measure it instead.</p>
      <p>We dealt 20 million hands through the same rules engine the game uses, playing basic strategy every time. Stakes added by doubling and splitting count as stakes. Out of every 100 ${esc(c.plural)} staked, ${pct(g.rtp, 2).replace('%', '')} came back.</p>
      <div class="callout callout--note callout--figure"><p class="callout__figure num">${rtp}</p><p>Return to player with basic strategy, measured over 20 million hands. The margin of error is about ±0.03%. Playing on hunches usually returns less.</p></div>
      <p>The script that runs the test is in the site's source as <code>tools/simulate-21.mjs</code>.</p>

      <h2 id="history">A short history of twenty-one</h2>
      <p>Games of "twenty-one" go back at least four centuries. Cervantes mentions <em>veintiuna</em> in a story written in the early 1600s, and <em>vingt-et-un</em> was popular in 18th-century France. British players knew it as pontoon.</p>
      <p>The name <em>blackjack</em> came later, in the United States. In 1956 four US Army engineers, Baldwin, Cantey, Maisel and McDermott, published the first basic strategy. Edward Thorp's <em>Beat the Dealer</em> took it to a wide audience in 1962.</p>
      <p>We call a natural 21 a Brilliant after the round brilliant cut. Its proportions were set out by Marcel Tolkowsky in 1919 to return as much light as possible. Our court cards carry letters, not portraits.</p>
    </div>
  </div>

  ${tablePageQuestions([
    ['Can I count cards?', `You can try: the shoe runs until a quarter is left, and the game shows how many cards remain. There's nothing to gain here except the satisfaction, because ${esc(c.plural)} have no value.`],
    ['Why no insurance?', 'Insurance is a side bet that the dealer has a Brilliant. With basic strategy it returns less than the main game, so we left it out to keep the table simple.'],
    ['Can I play with the keyboard?', 'Yes. Tab to the game, then press <kbd>D</kbd> to deal, <kbd>H</kbd> to hit, <kbd>S</kbd> to stand, <kbd>X</kbd> to double and <kbd>P</kbd> to split. Every card is announced.'],
  ])}
</section>

${tablePageMore(ctx, g)}`,
  };
}
