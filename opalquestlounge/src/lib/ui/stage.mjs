// The Pragmatic Play demo stage (markup contract: assets/js/games/pragmatic.js).
import { html, esc } from '../html.mjs';

export function pragmaticStage(ctx, g, { featured = false } = {}) {
  return html`<figure class="stage" data-game="pragmatic" data-symbol="${g.symbol}" data-name="${esc(g.name)}" data-state="idle">
  <div class="stage__bar"><span class="stage__label">${featured ? 'Featured demo' : 'Free demo'}</span><span class="stage__name">${esc(g.name)}</span></div>
  <div class="stage__screen cover" data-cover="${g.slug}">
    <div class="stage__over"><button class="btn btn--primary btn--play" type="button" data-action="load"><span>Play ${esc(g.name)} demo</span></button></div>
    <div class="stage__frame" data-stage></div>
  </div>
  <figcaption class="stage__foot"><p>Loads the free demo from Pragmatic Play's servers. <span>Demo credits are not Carats and have no value.</span></p></figcaption>
  <p class="visually-hidden" data-status aria-live="polite"></p>
</figure>`;
}
