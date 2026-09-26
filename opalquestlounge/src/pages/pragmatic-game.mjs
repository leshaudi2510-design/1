// One page per Pragmatic Play demo, written from src/data/pragmatic-games.json.
import { html, esc, num } from '../lib/html.mjs';
import { videoGameLd } from '../lib/layout.mjs';
import { pragmaticStage } from '../lib/games-ui.mjs';

export default function pragmaticGame(ctx, g) {
  return {
    id: `game-${g.slug}`,
    path: g.path,
    title: `${g.name} Free Demo · ${ctx.brand}`,
    description: `Play the free ${g.name} demo from Pragmatic Play. How it plays, the bonus rules and its RTP. Demo credits only, no real money. 18+.`,
    ogImage: g.image,
    ogAlt: `${g.name}: our own cover art.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Games', path: '/games/' },
      { name: g.name, path: g.path },
    ],
    jsonld: [videoGameLd(ctx, g)],
    modules: ['/assets/js/games/pragmatic.js'],
    bodyClass: 'is-game',
    body: html`
<article class="gamepage">
  <h1>${esc(g.name)}</h1>
  ${pragmaticStage(ctx, g)}
  <p>${esc(g.summary)}</p>
  <p class="game__disclaimer">${esc(ctx.disclaimer)}</p>
</article>`,
  };
}
