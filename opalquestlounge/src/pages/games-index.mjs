import { html, esc } from '../lib/html.mjs';
import { gameList } from '../lib/games-ui.mjs';

export default function gamesIndex(ctx) {
  const c = ctx.cur;
  return {
    id: 'games',
    path: '/games/',
    title: `Free Casino Games: Rules and RTP · ${ctx.brand}`,
    description: `Three free casino-style games played with virtual ${c.plural}: a crystal slot, European roulette and blackjack. Rules, paytables and RTP for each. 18+.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Games', path: '/games/' },
    ],
    jsonld: [
      {
        '@type': 'CollectionPage',
        name: 'Games',
        url: `${ctx.origin}/games/`,
        isPartOf: { '@id': ctx.websiteId },
        hasPart: ctx.games.map((g) => ({ '@id': `${g.url}#game` })),
      },
    ],
    body: html`
<header class="page-head">
  <p class="eyebrow">The cabinet</p>
  <h1 class="page-title">Games</h1>
  <p class="lede">Three games, each in its own drawer. All free, all played with virtual ${esc(c.plural)}, and all with their rules and maths set out in full.</p>
  <p class="label">${esc(ctx.disclaimer)}</p>
</header>

${gameList(ctx, { headingLevel: 2 })}

<section class="section" aria-labelledby="compare-title">
  <h2 id="compare-title">Side by side</h2>
  <div class="table-wrap">
  <table>
    <caption>How the three games compare</caption>
    <thead><tr><th scope="col">Game</th><th scope="col">Type</th><th scope="col">Stakes</th><th scope="col"><abbr title="Return to player">RTP</abbr></th><th scope="col">How the RTP is found</th></tr></thead>
    <tbody>
      ${ctx.games.map(
        (g) => `<tr><th scope="row"><a href="${g.path}">${esc(g.name)}</a></th><td>${esc(g.kind)}</td><td>${esc(g.stakes)}</td><td class="num">${g.rtpLabel}</td><td>${esc(g.rtpHow)}</td></tr>`,
      )}
    </tbody>
  </table>
  </div>
</section>

<section class="section prose prose--narrow" aria-labelledby="fair-title">
  <h2 id="fair-title">How the games are made</h2>
  <p>We draw every game in your browser on a canvas. There are no embedded games from other companies and nothing is streamed from a server.</p>
  <p>Results come from <code>crypto.getRandomValues</code>, the cryptographic random number generator built into your browser. Each result is fixed before the animation starts. Nothing in the games responds to your balance, your history or how long you've been playing.</p>
  <p>Every game works with a keyboard and a screen reader. Results are read out as they happen. If you've switched on reduced motion on your device, the animations are shortened or skipped.</p>
</section>`,
  };
}
