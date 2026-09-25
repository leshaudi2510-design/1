import { html, esc, num, pct } from '../lib/html.mjs';
import { videoGameLd } from '../lib/layout.mjs';
import { twentyOnePanel, gameList } from '../lib/games-ui.mjs';

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
  const hardHands = {
    '8 or less': ['3', '5'], 9: ['4', '5'], 10: ['4', '6'], 11: ['5', '6'], 12: ['10', '2'], 13: ['10', '3'],
    14: ['10', '4'], 15: ['10', '5'], 16: ['10', '6'], '17 or more': ['10', '7'],
  };
  const softHands = { 'A,2': ['A', '2'], 'A,3': ['A', '3'], 'A,4': ['A', '4'], 'A,5': ['A', '5'], 'A,6': ['A', '6'], 'A,7': ['A', '7'], 'A,8': ['A', '8'], 'A,9': ['A', '9'] };
  const pairs = { '2,2': '2', '3,3': '3', '4,4': '4', '5,5': '5', '6,6': '6', '7,7': '7', '8,8': '8', '9,9': '9', '10,10': '10', 'A,A': 'A' };
  const NAMES = { H: 'Hit', S: 'Stand', D: 'Double, or hit if you can’t', Ds: 'Double, or stand if you can’t', P: 'Split' };
  const table = (caption, rows, isPair = false) => html`<div class="table-wrap"><table class="strategy">
    <caption>${caption}</caption>
    <thead><tr><th scope="col">Your hand</th>${ups.map((u) => `<th scope="col" class="num">${u}</th>`)}</tr></thead>
    <tbody>${Object.entries(rows).map(([label, cards]) => {
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

  return {
    id: 'game-brilliant-twenty-one',
    path: g.path,
    title: `Brilliant Twenty-One: Free Blackjack · ${ctx.brand}`,
    description: `Free six-deck blackjack with virtual ${c.plural}. Full rules, pays, a basic strategy chart and how we measured its ${g.rtpLabel} RTP. 18+.`,
    ogImage: g.image,
    ogAlt: 'Brilliant Twenty-One: playing cards with lettered court cards on the table.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Games', path: '/games/' },
      { name: g.name, path: g.path },
    ],
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/brilliant-21.js', '/assets/js/games/brilliant-21.math.js'],
    bodyClass: 'is-game',
    body: html`
<article class="gamepage" data-transition="${g.slug}">
  <header class="page-head page-head--game">
    <p class="eyebrow"><span class="num">No. ${g.no}</span> · ${esc(g.kind)} · ${esc(g.spec)}</p>
    <h1 class="page-title">Brilliant Twenty-One</h1>
    <p class="lede">Six-deck blackjack, dealt on a lamp-lit table. A two-card 21 is a Brilliant, named after the most carefully cut of gemstones, and pays 3 to 2.</p>
  </header>

  ${twentyOnePanel(ctx, { headingId: 'play' })}

  <div class="prose-grid">
    <nav class="toc" aria-label="On this page">
      <p class="toc__head">On this page</p>
      <ol>
        <li><a href="#how-to-play">How to play</a></li>
        <li><a href="#rules">The rules in full</a></li>
        <li><a href="#pays">Pays</a></li>
        <li><a href="#strategy">Basic strategy</a></li>
        <li><a href="#rtp">How we measured the RTP</a></li>
        <li><a href="#history">A short history of twenty-one</a></li>
        <li><a href="#questions">Questions</a></li>
      </ol>
    </nav>
    <div class="prose">
      <section id="how-to-play" aria-labelledby="h-how">
        <h2 id="h-how">How to play</h2>
        <ol>
          <li>Choose a stake of ${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)} and press <strong>Deal</strong>.</li>
          <li>You get two cards face up. The dealer gets one face up and one face down.</li>
          <li>Get closer to 21 than the dealer without going over. Number cards count as their number, court cards as 10, and an Ace as 1 or 11.</li>
          <li><strong>Hit</strong> to take a card. <strong>Stand</strong> to stop. <strong>Double</strong> doubles your stake for exactly one more card. <strong>Split</strong> turns a pair into two hands, each with its own stake.</li>
          <li>When you stand, the dealer turns over the hidden card and draws until reaching 17 or more.</li>
        </ol>
      </section>

      <section id="rules" aria-labelledby="h-rules">
        <h2 id="h-rules">The rules in full</h2>
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
      </section>

      <section id="pays" aria-labelledby="h-pays">
        <h2 id="h-pays">Pays</h2>
        <div class="table-wrap">
        <table>
          <caption>What comes back on a 10-${esc(c.singular)} stake</caption>
          <thead><tr><th scope="col">Result</th><th scope="col">Pays</th><th scope="col">Back on 10</th></tr></thead>
          <tbody>
            <tr><th scope="row">Brilliant (two-card 21)</th><td class="num">3 to 2</td><td class="num">25</td></tr>
            <tr><th scope="row">Beat the dealer</th><td class="num">1 to 1</td><td class="num">20</td></tr>
            <tr><th scope="row">Push (same total)</th><td>Stake back</td><td class="num">10</td></tr>
            <tr><th scope="row">Dealer wins or you go over 21</th><td>Stake lost</td><td class="num">0</td></tr>
          </tbody>
        </table>
        </div>
      </section>

      <section id="strategy" aria-labelledby="h-strat">
        <h2 id="h-strat">Basic strategy</h2>
        <p>Basic strategy is the move that returns the most, on average, for your two cards against the dealer's face-up card. It was first worked out in 1956 and doesn't need any card counting. Turn on <strong>Show the basic-strategy move</strong> in the game and it will suggest a move for every hand.</p>
        <p class="legend"><span class="mv mv--H">H</span> Hit <span class="mv mv--S">S</span> Stand <span class="mv mv--D">D</span> Double, or hit if you can't <span class="mv mv--Ds">Ds</span> Double, or stand if you can't <span class="mv mv--P">P</span> Split</p>
        ${strategyTables(ctx.bj)}
      </section>

      <section id="rtp" aria-labelledby="h-rtp">
        <h2 id="h-rtp">How we measured the RTP</h2>
        <p>The slot and the wheel have no choices, so their return can be counted exactly. Twenty-one depends on how you play, so we measure it instead.</p>
        <p>We dealt 20 million hands through the same rules engine the game uses, playing basic strategy every time. Stakes added by doubling and splitting count as stakes. Out of every 100 ${esc(c.plural)} staked, ${pct(ctx.game('brilliant-twenty-one').rtp, 2).replace('%', '')} came back.</p>
        <p class="callout"><span class="callout__figure num">${g.rtpLabel.replace('about ', '≈ ')}</span> <span>Return to player with basic strategy, measured over 20 million hands. The margin of error is about ±0.03%. Playing on hunches usually returns less.</span></p>
        <p>The script that runs the test is in the site's source as <code>tools/simulate-21.mjs</code>.</p>
      </section>

      <section id="history" aria-labelledby="h-hist">
        <h2 id="h-hist">A short history of twenty-one</h2>
        <p>Games of "twenty-one" go back at least four centuries. Cervantes mentions <em>veintiuna</em> in a story written in the early 1600s, and <em>vingt-et-un</em> was popular in 18th-century France. British players knew it as pontoon.</p>
        <p>The name <em>blackjack</em> came later, in the United States. In 1956 four US Army engineers, Baldwin, Cantey, Maisel and McDermott, published the first basic strategy. Edward Thorp's <em>Beat the Dealer</em> took it to a wide audience in 1962.</p>
        <p>We call a natural 21 a Brilliant after the round brilliant cut. Its proportions were set out by Marcel Tolkowsky in 1919 to return as much light as possible. Our court cards carry letters, not portraits.</p>
      </section>

      <section id="questions" aria-labelledby="h-q">
        <h2 id="h-q">Questions</h2>
        <details name="q"><summary>Can I count cards?</summary><p>You can try: the shoe runs until a quarter is left, and the page shows how many cards remain. There's nothing to gain here except the satisfaction, because ${esc(c.plural)} have no value.</p></details>
        <details name="q"><summary>Why no insurance?</summary><p>Insurance is a side bet that the dealer has a Brilliant. With basic strategy it returns less than the main game, so we left it out to keep the table simple.</p></details>
        <details name="q"><summary>Can I play with the keyboard?</summary><p>Yes. Tab to the game, then press <kbd>D</kbd> to deal, <kbd>H</kbd> to hit, <kbd>S</kbd> to stand, <kbd>X</kbd> to double and <kbd>P</kbd> to split. Every card is announced.</p></details>
      </section>
    </div>
  </div>

  <section class="section more" aria-labelledby="more-title">
    <h2 id="more-title">Also in the cabinet</h2>
    ${gameList(ctx, { current: g.path })}
  </section>
</article>`,
  };
}
