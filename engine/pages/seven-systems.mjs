import { html, esc, num, pct } from '../lib/html.mjs';
import { videoGameLd, breadcrumbs } from '../lib/layout.mjs';
import { slotPanel, slotPaytable, tablePageHero, tablePageFacts, tablePageQuestions, tablePageMore } from '../lib/ui/tables.mjs';

// Seven Systems is our own slot. It is built only when the Pragmatic Play
// demos are switched off (site.config.json "pragmatic.enabled": false).
export default function sevenSystems(ctx) {
  const g = ctx.game('seven-systems');
  const { SYMBOLS, STOPS, LINES, STAKES, TRIPLE, SETS } = ctx.slot;
  const s = ctx.slotStats;
  const c = ctx.cur;
  const perThousand = Math.round(s.rtp * 10000);
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Slots', path: '/games/#slots' },
    { name: g.name, path: g.path },
  ];

  return {
    id: 'game-seven-systems',
    path: g.path,
    title: `Seven Systems: Free Crystal Slot · ${ctx.brand}`,
    description: `Play Seven Systems free: a 3-reel, 5-line slot of bright crystals with virtual ${c.plural}. Full paytable, rules and exact ${g.rtpLabel} RTP. 18+.`,
    ogImage: g.image,
    ogAlt: 'Seven Systems: a clear crystal point between a violet and a gold one, with an opal at its foot.',
    breadcrumbs: crumbs,
    crumbsInBody: true,
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/seven-systems.js', '/assets/js/games/seven-systems.math.js', '/assets/js/lib/crystals.js'],
    bodyClass: 'is-game',
    body: html`
${tablePageHero(ctx, g, {
  crumbs: breadcrumbs(crumbs),
  panel: slotPanel(ctx, { variant: 'page', headingId: 'play' }),
  back: '/games/#slots',
  summary: 'A three-reel, five-line slot of crystals. Opal has no crystal system, so it stands in for any mineral.',
})}

<section class="game-body" aria-label="Rules and pays">
  <div class="wrap game-body__grid game-body__grid--table">
    ${tablePageFacts(g, [
      ['Layout', '3 reels × 3 rows'],
      ['Lines', `${LINES.length} fixed lines`, 'Three rows and two diagonals'],
      ['Stakes', `${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)}`],
      ['Top payout', `${TRIPLE.O}× line stake`, 'Three Opals on a line'],
      ['Wild', 'Opal', 'Stands in for any mineral'],
      ['<abbr title="Return to player">RTP</abbr>', g.rtpLabel, `Exact: all ${num(s.spins)} reel stops, counted`],
    ], {
      note: `${esc(c.plural)} are free and have no cash value. Doing well in a free game doesn't mean you'd do well gambling with real money.`,
      toc: [
        ['#how-to-play', 'How to play'],
        ['#paytable', 'Paytable'],
        ['#rtp', 'How the RTP is worked out'],
        ['#rules', 'The rules in full'],
        ['#minerals', 'The minerals on the reels'],
        ['#history', 'A short history of the slot'],
        ['#questions', 'Questions'],
      ],
    })}
    <div class="prose">
      <h2 id="how-to-play">How to play</h2>
      <ol>
        <li>Choose your stake: ${STAKES.map((x) => num(x)).join(', ')} ${esc(c.plural)} a spin. It's split evenly across the five lines, so a 10-${esc(c.singular)} spin puts 2 on each line.</li>
        <li>Press <strong>Spin</strong>. The reels stop from left to right.</li>
        <li>Each of the five lines is checked on its own. A line pays if its three symbols are the same mineral, or three minerals from the same group.</li>
        <li>The result box beside the reels tells you what each line paid and your net result for the spin.</li>
      </ol>
      <p>The five lines are the three rows, plus two diagonals: top-left to bottom-right, and bottom-left to top-right.</p>

      <h2 id="paytable">Paytable</h2>
      <p>Pays are multiples of the line stake. The chance column is the exact chance that a single line lands that result on any spin.</p>
      <div class="table-wrap">${slotPaytable(ctx)}</div>
      <p>Opal stands in for any mineral. Two Opals and a Beryl count as three Beryl, for example. Three Opals pay ${TRIPLE.O}×.</p>
      <p>If a line qualifies for more than one pay, only the highest counts. Three Beryl pay ${TRIPLE.B}×, not ${TRIPLE.B}× plus the ${SETS.hex.pays}× group pay.</p>

      <h2 id="rtp">How the RTP is worked out</h2>
      <p>Return to player (RTP) is the share of everything staked that comes back over a very long run. It says nothing about any one session. Short runs swing well above and below it.</p>
      <p>Each reel has ${STOPS} stops and every stop is equally likely. The three reels stop independently, so a spin can land in ${STOPS} × ${STOPS} × ${STOPS} = ${num(s.spins)} different ways. We don't estimate: the site's build checks all ${num(s.spins)}, adds up what each pays across the ${LINES.length} lines, and divides by the total staked.</p>
      <div class="callout callout--note callout--figure"><p class="callout__figure num">${pct(s.rtp, 3)}</p><p>Exact return to player. For every 10,000 ${esc(c.plural)} staked over a very long run, about ${num(perThousand)} come back.</p></div>
      <p>${pct(s.hitRate, 1)} of spins pay something on at least one line. Most of those pay back <em>less</em> than the stake: a mixed tilted-axes line on a 10-${esc(c.singular)} spin returns 4. When that happens the result box shows your net loss for the spin, and nothing flashes. The box only lights up when a spin returns more than you put in.</p>
      <p>You can check the arithmetic yourself: the reel strips and the counting code are in <a href="/assets/js/games/seven-systems.math.js">seven-systems.math.js</a>.</p>

      <h2 id="rules">The rules in full</h2>
      <ul>
        <li>Three reels, three rows, five fixed lines. You can't switch lines off.</li>
        <li>Your stake is split equally across the five lines.</li>
        <li>A line pays for three of the same mineral, or three minerals from one group: the hexagonal family (Beryl, Quartz), right-angled axes (Garnet, Zircon, Topaz) or tilted axes (Orthoclase, Axinite).</li>
        <li>Opal is wild and stands in for any mineral. Three Opals make the top pay: ${TRIPLE.O}× the line stake, paid in ${esc(c.plural)} like everything else.</li>
        <li>Only the highest pay on each line counts. Pays on different lines add together.</li>
        <li>Results come from <code>crypto.getRandomValues</code> and are fixed when you press Spin. The animation shows the result; it doesn't decide it.</li>
        <li>If the page is closed mid-spin, the spin has already been settled and your balance is already updated.</li>
      </ul>

      <h2 id="minerals">The minerals on the reels</h2>
      <p>Every crystal grows from a repeating lattice, and every lattice belongs to one of seven systems, set by the lengths of its three axes and the angles between them. Each symbol on the reels is a real crystal shape from its system, drawn in bold ink with a bright fill.</p>
      <div class="table-wrap">
      <table class="paytable paytable--wide minerals">
        <caption>Symbols, their crystal systems and Mohs hardness</caption>
        <thead><tr><th scope="col">Mineral</th><th scope="col">Crystal system</th><th scope="col">What that means</th><th scope="col">Hardness</th></tr></thead>
        <tbody>
          ${Object.entries(SYMBOLS).map(
            ([k, m]) => `<tr><th scope="row"><span class="pt__name"><i class="sym sym--${k}" aria-hidden="true"></i>${m.name}</span></th><td>${m.system}</td><td class="td--text">${m.note}</td><td class="num">${m.hardness}</td></tr>`,
          )}
        </tbody>
      </table>
      </div>
      <p>Opal is a mineraloid: hydrated silica with no crystal lattice. Its play-of-colour comes from tiny silica spheres, stacked in rows like shot, that split white light into colours. Tilt the stone and the colours move. Australian researchers first saw those spheres under an electron microscope in the 1960s.</p>

      <h2 id="history">A short history of the slot</h2>
      <p>The three-reel slot is usually credited to Charles Fey, a mechanic in San Francisco, in the late 1890s. His Liberty Bell had three reels and five symbols: horseshoes, diamonds, spades, hearts and a bell.</p>
      <p>In Britain these machines became <em>fruit machines</em>, after the fruit symbols of early American machines. Electromechanical reels arrived in the 1960s, and video reels in the 1970s. The reels on this page are drawn on a canvas, but they follow the old rule: fixed strips of symbols, stopped at random.</p>
    </div>
  </div>

  ${tablePageQuestions([
    ['Does a long losing run make a pay more likely?', 'No. Every spin is independent. The reels have no memory and nothing adjusts to your balance.'],
    ['Why is Opal wild?', 'Because it has no crystal lattice, it doesn\'t belong to any of the seven systems, so it can fit in with any of them. It\'s also the rarest symbol: two stops in thirty-four on each reel.'],
    ['Can I play with the keyboard?', 'Yes. Tab to the Spin button and press <kbd>Enter</kbd> or <kbd>Space</kbd>. Anywhere in the game, <kbd>S</kbd> spins and <kbd>1</kbd> to <kbd>4</kbd> change the stake. Results are read out to screen readers.'],
    [`What happens when I run out of ${esc(c.plural)}?`, `When your balance is under ${num(c.topUpBelow)}, a <strong>Claim ${num(c.topUpAmount)} free ${esc(c.plural)}</strong> button appears. Top-ups never cost anything.`],
  ])}
</section>

${tablePageMore(ctx, g)}`,
  };
}
