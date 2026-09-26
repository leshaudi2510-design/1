// Lobby: game tiles, covers and filters.
import { html, esc } from '../html.mjs';
import { icons } from '../icons.mjs';

export function gameList(ctx, { headingLevel = 3, current } = {}) {
  const h = `h${headingLevel}`;
  return html`<ol class="drawers">
  ${ctx.games
    .filter((g) => g.path !== current)
    .map(
      (g) => html`<li class="drawer" data-glyph="${g.glyph}" data-slug="${g.slug}">
      <p class="drawer__no num" aria-hidden="true">${g.no}</p>
      <div class="drawer__text">
        <p class="drawer__kind">${esc(g.kind)} · ${esc(g.spec)}</p>
        <${h} class="drawer__name"><a href="${g.path}">${esc(g.name)}</a></${h}>
        <p class="drawer__short">${esc(g.short)}</p>
      </div>
      <dl class="drawer__facts">
        <div><dt><abbr title="Return to player">RTP</abbr></dt><dd class="num">${g.rtpLabel}</dd></div>
        <div><dt>Stakes</dt><dd>${esc(g.stakes)}</dd></div>
        <div><dt>Cost</dt><dd>Free. No purchases.</dd></div>
      </dl>
      <picture class="drawer__img">
        <source type="image/avif" srcset="${g.preview}-480.avif 480w, ${g.preview}-960.avif 960w" sizes="(min-width: 60rem) 22rem, 90vw">
        <source type="image/webp" srcset="${g.preview}-480.webp 480w, ${g.preview}-960.webp 960w" sizes="(min-width: 60rem) 22rem, 90vw">
        <img src="${g.preview}-480.webp" width="480" height="320" loading="lazy" decoding="async" alt="${esc(g.name)}: ${g.glyph === 'crystal' ? 'three reels of crystal drawings' : g.glyph === 'wheel' ? 'a single-zero wheel with garnet, jet and malachite pockets' : 'playing cards on the table'}.">
      </picture>
      <a class="drawer__go" href="${g.path}" aria-hidden="true" tabindex="-1">${icons.arrow}</a>
    </li>`,
    )}
</ol>`;
}
