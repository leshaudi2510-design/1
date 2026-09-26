// The Pragmatic Play demo stage (spec 7.8). The markup contract is the one
// assets/js/games/pragmatic.js reads:
//
//   figure.stage[data-game="pragmatic"][data-symbol][data-name][data-state]
//     .stage__bar      label, name, then the provider (home) or the tools (game pages)
//     .stage__screen   our cover art, the lettering and the Play button
//       [data-stage]   the box the iframe goes into, after a click on Play
//       .stage__msg--loading / --failed / --blocked
//     figcaption       required in every state
//     [data-status]    polite live region
//
// Nothing here contacts Pragmatic Play. The only address of theirs on the
// page is the fallback link, and that is a plain link opened in a new tab.
import { html, esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STAGE_OLYMPUS, COVERS } from '../art.mjs';
import { demoUrl } from '../../public/assets/js/lib/pragmatic-url.js';

// Games with artwork drawn for the 16:10 stage. Every other game uses its
// lobby cover motif, stretched across the stage.
const STAGE_ART = { 'gates-of-olympus': STAGE_OLYMPUS };

function stageArt(g) {
  if (STAGE_ART[g.slug]) return STAGE_ART[g.slug];
  const art = COVERS[g.slug]?.art;
  if (!art) return ''; // no cover yet: the screen shows the cover gradient on its own
  return `<svg class="stage__art stage__art--cover" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${art}</svg>`;
}

/**
 * The cover lettering. Its size class follows the longest line of the main
 * word(s), so long names stay on one line without overrunning the screen.
 */
function stageTitle(g) {
  const title = COVERS[g.slug]?.title || `<span class="toon" data-text="${esc(g.name)}">${esc(g.name)}</span>`;
  const main = [...title.matchAll(/data-text="([^"]*)"/g)].map((m) => m[1].length);
  const longest = Math.max(0, ...main);
  const size = longest > 11 ? ' stage__title--xl' : longest > 8 ? ' stage__title--l' : '';
  return `<p class="ct stage__title${size}" aria-hidden="true">${title}</p>`;
}

/**
 * "Play Gates of Olympus demo". A short name never breaks. A long one may
 * wrap, but only at its dash ("Zeus vs Hades – / Gods of War demo") or
 * before its last word, so "demo" never sits on a line of its own.
 */
function playLabel(name) {
  const nb = (s) => `<span class="nobr">${esc(s)}</span>`;
  if (name.length <= 20) return `Play ${nb(name)} demo`;
  const dash = name.split(/ (?=[–-] )/);
  if (dash.length === 2) return `Play ${nb(`${dash[0]} ${dash[1][0]}`)} ${nb(`${dash[1].slice(2)} demo`)}`;
  const words = name.split(' ');
  return `Play ${esc(words.slice(0, -1).join(' '))} ${nb(`${words.at(-1)} demo`)}`;
}

/**
 * @param {object} ctx  site context
 * @param {object} g    a Pragmatic game from ctx.games
 * @param {{ featured?: boolean }} [opts]  featured: the home page variant
 */
export function pragmaticStage(ctx, g, { featured = false } = {}) {
  const id = `demo-${g.slug}`;
  const href = demoUrl(ctx.cfg.pragmatic, g.symbol);
  const name = esc(g.name);
  const close = `<button class="btn btn--secondary btn--sm when-ready" type="button" data-action="unload">${icon('i-close')}Close demo</button>`;
  const right = featured
    ? `<span class="stage__prov when-idle"><i class="dot dot--pp" aria-hidden="true"></i>Pragmatic Play</span>
      ${close}`
    : `<div class="stage__tools">
        ${close}
        <button class="icon-btn" type="button" data-action="fullscreen" aria-label="Fullscreen" aria-pressed="false" aria-disabled="true">${icon('i-full')}</button>
      </div>`;

  return html`<figure class="stage${featured ? ' stage--featured' : ''}" id="${id}" data-game="pragmatic" data-symbol="${esc(g.symbol)}" data-name="${name}" data-state="idle" aria-labelledby="${id}-name ${id}-cap">
    <div class="stage__bar">
      <span class="stage__label">${featured ? 'Featured demo' : 'Free demo'}</span>
      <span class="stage__name" id="${id}-name">${name}</span>
      ${right}
    </div>
    <div class="stage__screen cover" data-cover="${g.slug}">
      ${stageArt(g)}
      <div class="stage__over">
        ${stageTitle(g)}
        <button class="btn btn--primary btn--play" type="button" data-action="load">
          <span class="play-ico" aria-hidden="true">${icon('i-play')}</span>
          <span>${playLabel(g.name)}</span>
        </button>
      </div>
      <div class="stage__frame" data-stage></div>
      <div class="stage__msg stage__msg--loading"><div>
        <strong>Loading the demo</strong>
        <span class="bar" aria-hidden="true"></span>
        <p>Fetching ${name} from Pragmatic Play's servers.</p>
      </div></div>
      <div class="stage__msg stage__msg--failed"><div>
        <span class="ico" aria-hidden="true">${icon('i-alert')}</span>
        <strong>The demo didn't load</strong>
        <p>Pragmatic Play's server didn't answer. You can try again, or open the demo on their site.</p>
        <p class="stage__msg-actions">
          <button class="btn btn--secondary btn--sm" type="button" data-action="load">Try again</button>
          <a class="btn btn--secondary btn--sm" data-fallback href="${esc(href)}" target="_blank" rel="noopener">Open on Pragmatic Play's site${icon('i-ext')}<span class="visually-hidden"> (opens in a new tab)</span></a>
        </p>
      </div></div>
      <div class="stage__msg stage__msg--blocked"><div>
        <span class="ico" aria-hidden="true">${icon('i-pause')}</span>
        <strong data-blocked-title>You're on a break</strong>
        <p data-blocked>Games are paused for now. The rules and pages still work.</p>
        <a href="/responsible-gaming/#break">About breaks and limits</a>
      </div></div>
    </div>
    <figcaption class="stage__foot" id="${id}-cap">
      ${icon('i-info')}
      <p>Loads the free demo from Pragmatic Play's servers. <span>Demo credits are not ${esc(ctx.cur.plural)} and have no value.</span></p>
    </figcaption>
    <p class="visually-hidden" data-status aria-live="polite"></p>
  </figure>`;
}
