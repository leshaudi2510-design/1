import { html, esc, num, pct } from '../lib/html.mjs';
import { videoGameLd } from '../lib/layout.mjs';
import { slotPanel, slotPaytable, gameList } from '../lib/games-ui.mjs';

export default function sevenSystems(ctx) {
  const g = ctx.game('seven-systems');
  const { SYMBOLS, STOPS, LINES, STAKES } = ctx.slot;
  const s = ctx.slotStats;
  const c = ctx.cur;
  const perThousand = Math.round(s.rtp * 10000);

  return {
    id: 'game-seven-systems',
    path: g.path,
    title: `Seven Systems: Free Crystal Slot · ${ctx.brand}`,
    description: `Play Seven Systems free: a 3-reel, 5-line slot of crystal drawings with virtual ${c.plural}. Full paytable, rules and exact ${g.rtpLabel} RTP. 18+.`,
    ogImage: g.image,
    ogAlt: 'Seven Systems: three reels of crystal drawings with an opal in the middle.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Games', path: '/games/' },
      { name: g.name, path: g.path },
    ],
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/seven-systems.js', '/assets/js/games/seven-systems.math.js', '/assets/js/lib/crystals.js'],
    bodyClass: 'is-game',
    body: html`
<article class="gamepage" data-transition="${g.slug}">
  <header class="page-head page-head--game">
    <p class="eyebrow"><span class="num">No. ${g.no}</span> · ${esc(g.kind)} · ${esc(g.spec)}</p>
    <h1 class="page-title">Seven Systems</h1>
    <p class="lede">A three-reel, five-line slot drawn from the seven crystal systems that mineralogists use to sort every crystal on Earth. Opal has no crystal system at all, so on these reels it's wild.</p>
  </header>

  ${slotPanel(ctx, { variant: 'page', headingId: 'play' })}

  <div class="prose-grid">
    <nav class="toc" aria-label="On this page">
      <p class="toc__head">On this page</p>
      <ol>
        <li><a href="#how-to-play">How to play</a></li>
        <li><a href="#paytable">Paytable</a></li>
        <li><a href="#rtp">How the RTP is worked out</a></li>
        <li><a href="#rules">The rules in full</a></li>
        <li><a href="#minerals">The minerals on the reels</a></li>
        <li><a href="#history">A short history of the slot</a></li>
        <li><a href="#questions">Questions</a></li>
      </ol>
    </nav>
    <div class="prose">
      <section id="how-to-play" aria-labelledby="h-how">
        <h2 id="h-how">How to play</h2>
        <ol>
          <li>Choose your stake: ${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)} a spin. It's split evenly across the five lines, so a 10-${esc(c.singular)} spin puts 2 on each line.</li>
          <li>Press <strong>Spin</strong>. The reels stop from left to right.</li>
          <li>Each of the five lines is checked on its own. A line pays if its three symbols are the same mineral, or three minerals from the same group.</li>
          <li>The result line under the reels tells you what each line paid and your net result for the spin.</li>
        </ol>
        <p>The five lines are the three rows, plus two diagonals: top-left to bottom-right, and bottom-left to top-right.</p>
      </section>

      <section id="paytable" aria-labelledby="h-pay">
        <h2 id="h-pay">Paytable</h2>
        <p>Pays are multiples of the line stake. The chance column is the exact chance that a single line lands that result on any spin.</p>
        <div class="table-wrap">${slotPaytable(ctx)}</div>
        <p>Opal stands in for any mineral. Two Opals and a Beryl count as three Beryl, for example. Three Opals pay ${ctx.slot.TRIPLE.O}×.</p>
        <p>If a line qualifies for more than one pay, only the highest counts. Three Beryl pay ${ctx.slot.TRIPLE.B}×, not ${ctx.slot.TRIPLE.B}× plus the ${ctx.slot.SETS.hex.pays}× group pay.</p>
      </section>

      <section id="rtp" aria-labelledby="h-rtp">
        <h2 id="h-rtp">How the RTP is worked out</h2>
        <p>Return to player (RTP) is the share of everything staked that comes back over a very long run. It says nothing about any one session. Short runs swing well above and below it.</p>
        <p>Each reel has ${STOPS} stops and every stop is equally likely. The three reels stop independently, so a spin can land in ${STOPS} × ${STOPS} × ${STOPS} = ${num(s.spins)} different ways. We don't estimate: the site's build checks all ${num(s.spins)}, adds up what each pays across the ${LINES.length} lines, and divides by the total staked.</p>
        <p class="callout"><span class="callout__figure num">${pct(s.rtp, 3)}</span> <span>Exact return to player. For every 10,000 ${esc(c.plural)} staked over a very long run, about ${num(perThousand)} come back.</span></p>
        <p>${pct(s.hitRate, 1)} of spins pay something on at least one line. Most of those pay back <em>less</em> than the stake: a mixed tilted-axes line on a 10-${esc(c.singular)} spin returns 4. When that happens the result line shows your net loss for the spin, and the opal doesn't flash. It only lights up when a spin returns more than you put in.</p>
        <p>You can check the arithmetic yourself: the reel strips and the counting code are in <a href="/assets/js/games/seven-systems.math.js">seven-systems.math.js</a>.</p>
      </section>

      <section id="rules" aria-labelledby="h-rules">
        <h2 id="h-rules">The rules in full</h2>
        <ul>
          <li>Three reels, three rows, five fixed lines. You can't switch lines off.</li>
          <li>Your stake is split equally across the five lines.</li>
          <li>A line pays for three of the same mineral, or three minerals from one group: the hexagonal family (Beryl, Quartz), right-angled axes (Garnet, Zircon, Topaz) or tilted axes (Orthoclase, Axinite).</li>
          <li>Opal is wild and stands in for any mineral. Three Opals make the top pay: ${ctx.slot.TRIPLE.O}× the line stake, paid in ${esc(c.plural)} like everything else.</li>
          <li>Only the highest pay on each line counts. Pays on different lines add together.</li>
          <li>Results come from <code>crypto.getRandomValues</code> and are fixed when you press Spin. The animation shows the result; it doesn't decide it.</li>
          <li>If the page is closed mid-spin, the spin has already been settled and your balance is already updated.</li>
        </ul>
      </section>

      <section id="minerals" aria-labelledby="h-min">
        <h2 id="h-min">The minerals on the reels</h2>
        <p>Every crystal grows from a repeating lattice, and every lattice belongs to one of seven systems, set by the lengths of its three axes and the angles between them. The drawings on the reels follow the style of 19th-century mineralogy plates. Hidden edges are dashed, as they were in print.</p>
        <div class="table-wrap">
        <table class="minerals">
          <caption>Symbols, their crystal systems and Mohs hardness</caption>
          <thead><tr><th scope="col">Mineral</th><th scope="col">Crystal system</th><th scope="col">What that means</th><th scope="col">Hardness</th></tr></thead>
          <tbody>
            ${Object.entries(SYMBOLS).map(
              ([k, m]) => `<tr><th scope="row">${m.name}</th><td>${m.system}</td><td>${m.note}</td><td class="num">${m.hardness}</td></tr>`,
            )}
          </tbody>
        </table>
        </div>
        <p>Opal is a mineraloid: hydrated silica with no crystal lattice. Its play-of-colour comes from tiny silica spheres, stacked in rows like shot, that split white light into colours. Tilt the stone and the colours move. Australian researchers first saw those spheres under an electron microscope in the 1960s.</p>
      </section>

      <section id="history" aria-labelledby="h-hist">
        <h2 id="h-hist">A short history of the slot</h2>
        <p>The three-reel slot is usually credited to Charles Fey, a mechanic in San Francisco, in the late 1890s. His Liberty Bell had three reels and five symbols: horseshoes, diamonds, spades, hearts and a bell.</p>
        <p>In Britain these machines became <em>fruit machines</em>, after the fruit symbols of early American machines. Electromechanical reels arrived in the 1960s, and video reels in the 1970s. The reels on this page are drawn on a canvas, but they follow the old rule: fixed strips of symbols, stopped at random.</p>
      </section>

      <section id="questions" aria-labelledby="h-q">
        <h2 id="h-q">Questions</h2>
        <details name="q"><summary>Does a long losing run make a pay more likely?</summary><p>No. Every spin is independent. The reels have no memory and nothing adjusts to your balance.</p></details>
        <details name="q"><summary>Why is Opal wild?</summary><p>Because it has no crystal lattice, it doesn't belong to any of the seven systems, so it can fit in with any of them. It's also the rarest symbol: two stops in thirty-four on each reel.</p></details>
        <details name="q"><summary>Can I play with the keyboard?</summary><p>Yes. Tab to the Spin button and press <kbd>Enter</kbd> or <kbd>Space</kbd>. Anywhere in the game, <kbd>S</kbd> spins and <kbd>1</kbd> to <kbd>4</kbd> change the stake. Results are read out to screen readers.</p></details>
        <details name="q"><summary>What happens when I run out of ${esc(c.plural)}?</summary><p>When your balance is under ${num(c.topUpBelow)}, a <strong>Claim ${ctx.carats(c.topUpAmount)}</strong> button appears. It's free.</p></details>
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
