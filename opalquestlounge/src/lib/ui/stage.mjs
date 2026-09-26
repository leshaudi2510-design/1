// The Pragmatic Play demo stage (spec 7.8). The markup contract is the one
// assets/js/games/pragmatic.js reads:
//
//   figure.stage[data-game="pragmatic"][data-symbol][data-name][data-state]
//     .stage__bar      label, name, then the tools (Close demo and fullscreen);
//                      on home the provider shows instead until Play is pressed
//     .stage__screen   our cover art, the lettering and the Play button
//       [data-stage]   the box the iframe goes into, after a click on Play
//       .stage__msg--loading / --failed / --blocked
//     figcaption       required in every state; it describes the Play button
//     [data-status]    polite live region
//
// Nothing here contacts Pragmatic Play, and the page holds no address of
// theirs: pragmatic.js builds the demo's address and sets the iframe's src
// only after Play is pressed.
import { html, esc } from '../html.mjs';
import { icon } from '../icons.mjs';
import { STAGE_OLYMPUS, COVERS } from '../art.mjs';

// Games with artwork drawn for the 16:10 stage. Every other game uses its
// lobby cover motif across the stage, or the stage variant in its COVERS
// entry (`stage: { dy, art }`) where the lobby motif would run into the
// lettering at the top or hide behind the Play button.
const STAGE_ART = { 'gates-of-olympus': STAGE_OLYMPUS };

function stageArt(g) {
  if (STAGE_ART[g.slug]) return STAGE_ART[g.slug];
  const c = COVERS[g.slug];
  const art = c?.stage?.art ?? c?.art;
  if (!art) return ''; // no cover yet: the screen shows the cover gradient on its own
  // An SVG transform, not a style attribute: the CSP (style-src 'self') blocks inline styles.
  const body = c.stage?.dy ? `<g transform="translate(0 ${c.stage.dy})">${art}</g>` : art;
  return `<svg class="stage__art stage__art--cover" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${body}</svg>`;
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
 * "Play Gates of Olympus demo". The label wraps at most once, and "demo"
 * never sits on a line of its own. A short name stays whole, together with
 * "demo" ("Play / Gates of Olympus demo"); a long one may break at its dash
 * ("Zeus vs Hades – / Gods of War demo") or before its last word.
 */
function playLabel(name) {
  const nb = (s) => `<span class="nobr">${esc(s)}</span>`;
  const dash = name.split(/ (?=[–-] )/);
  if (dash.length === 2) return `Play ${nb(`${dash[0]} ${dash[1][0]}`)} ${nb(`${dash[1].slice(2)} demo`)}`;
  if (name.length <= 16) return `Play ${nb(`${name} demo`)}`;
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
  const name = esc(g.name);
  const close = `<button class="btn btn--secondary btn--sm when-ready" type="button" data-action="unload">${icon('i-close')}Close demo</button>`;
  const fullscreen = `<button class="icon-btn" type="button" data-action="fullscreen" aria-label="Fullscreen" aria-pressed="false" aria-disabled="true">${icon('i-full')}</button>`;
  // Home shows the provider until Play is pressed, then the same tools as a game page.
  const right = featured
    ? `<span class="stage__prov when-idle"><i class="dot dot--pp" aria-hidden="true"></i>Pragmatic Play</span>
      <div class="stage__tools when-ready">${close}${fullscreen}</div>`
    : `<div class="stage__tools">
        ${close}
        ${fullscreen}
      </div>`;

  return html`<figure class="stage${featured ? ' stage--featured' : ''}" id="${id}" data-game="pragmatic" data-symbol="${esc(g.symbol)}" data-name="${name}" data-state="idle" aria-labelledby="${id}-name" aria-describedby="${id}-cap">
    <div class="stage__bar">
      <span class="stage__label">${featured ? 'Featured demo' : 'Free demo'}</span>
      <span class="stage__name" id="${id}-name">${name}</span>
      ${right}
    </div>
    <div class="stage__screen cover" data-cover="${g.slug}">
      ${stageArt(g)}
      <div class="stage__over">
        ${stageTitle(g)}
        <button class="btn btn--primary btn--play" type="button" data-action="load" aria-describedby="${id}-cap">
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
        <p>Pragmatic Play's server didn't answer. You can try again in a minute.</p>
        <p class="stage__msg-actions"><button class="btn btn--secondary btn--sm" type="button" data-action="load" aria-describedby="${id}-cap">Try again</button></p>
        <a href="/contact/">Report a problem</a>
      </div></div>
      <div class="stage__msg stage__msg--blocked"><div>
        <span class="ico" aria-hidden="true">${icon('i-pause')}</span>
        <strong data-blocked-title>You're on a break</strong>
        <p data-blocked>Games are paused for now. The rules and pages still work.</p>
        <button class="btn btn--secondary btn--sm" type="button" data-open="age-gate" aria-haspopup="dialog" hidden>Confirm my age</button>
        <a href="/responsible-gaming/#break">About breaks and limits</a>
      </div></div>
    </div>
    <figcaption class="stage__foot" id="${id}-cap">
      ${icon('i-info')}
      <p>Pressing Play loads the free demo from Pragmatic Play's servers. Pragmatic Play, and Google Analytics inside the demo, may then set cookies on your device (<a href="/cookies/#third-party">about these cookies</a>). <span>Demo credits are not ${esc(ctx.cur.plural)} and have no value.</span></p>
    </figcaption>
    <p class="visually-hidden" data-status aria-live="polite"></p>
  </figure>`;
}
