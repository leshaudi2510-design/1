// Lobby: game tiles, their covers, the filter chips and the tile grids.
//
// Markup contract with assets/js/lib/lobby.js:
//   [data-lobby]                       wraps one lobby: its filter bar and all its tiles
//     [data-filters]                   the chip row (role="group")
//       button.chip[data-filter]       "all" or a tag; aria-pressed marks the chosen one
//       [data-filter-count]            polite live count: "Showing all 10 games"
//     [data-lobby-group]               optional section of tiles; hidden when a filter empties it
//       li.tile[data-tags]             space-separated tags: tumble megaways freespins table
//
// Covers carry no inline styles (the CSP blocks them): each game's colours
// come from the [data-cover="slug"] rules that coverCss() in art.mjs adds to
// site.css.
import { esc } from '../html.mjs';
import { coverFor } from '../art.mjs';

/** The lobby filters, in chip order. Tiles carry the keys in data-tags. */
export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'tumble', label: 'Tumble' },
  { key: 'megaways', label: 'Megaways' },
  { key: 'freespins', label: 'Free spins' },
  { key: 'table', label: 'Table games' },
];

/** Escape a game name and keep hyphenated words ("Twenty-One") on one line. */
const keepHyphens = (name) => esc(name).replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>');

/** "Showing all 10 games" / "Showing 3 of 10 games" (lobby.js writes the same wording). */
export const countText = (shown, total) =>
  shown === total ? `Showing all ${total} ${total === 1 ? 'game' : 'games'}` : `Showing ${shown} of ${total} games`;

/**
 * A game's cover: gradient, rays, our own object drawing, the lettering and
 * a "Demo" or "Carats" badge. Decorative (aria-hidden): the tile's heading
 * carries the name.
 */
export function cover(ctx, g, { cls = '' } = {}) {
  const c = coverFor(g.slug, g.name);
  const ours = g.provider === 'house';
  return `<div class="cover${cls ? ` ${cls}` : ''}" data-cover="${esc(g.slug)}" aria-hidden="true">
      <span class="badge${ours ? ' badge--ours' : ''}">${ours ? esc(ctx.cur.plural) : 'Demo'}</span>
      <svg class="cover__art" viewBox="0 0 200 150" focusable="false">${c.art}</svg>
      <p class="ct">${c.title}</p>
    </div>`;
}

/**
 * One game tile (spec 7.7). The title link stretches over the whole card.
 *   headingLevel  the tile title's heading level (3 under a section h2)
 *   wide          turn into a horizontal card at 600–1239px, spanning two
 *                 columns (our two tables, so the lobby rows close)
 *   short         add the game's one-line description (horizontal cards)
 */
export function tile(ctx, g, { headingLevel = 3, wide = Boolean(g.table), short = false } = {}) {
  const h = `h${headingLevel}`;
  const [a = '', b = ''] = g.tileFacts || [];
  return `<li class="tile${wide ? ' tile--table' : ''}" data-tags="${esc((g.tags || []).join(' '))}" data-cover="${esc(g.slug)}">
    ${cover(ctx, g)}
    <div class="tile__body">
      <${h} class="tile__title"><a href="${g.path}">${keepHyphens(g.name)}</a></${h}>
      <p class="tile__prov"><i class="dot dot--${g.provider === 'pragmatic' ? 'pp' : 'oq'}" aria-hidden="true"></i>${esc(g.providerName)}</p>
      ${short && g.short ? `<p class="tile__short">${esc(g.short)}</p>` : ''}
      <p class="tile__facts"><span>${esc(a)}</span><span>${esc(b)}</span></p>
    </div>
  </li>`;
}

/**
 * A grid of tiles (spec 7.7): 5 columns from 1240px, 4 from 600px, 2 below.
 * Grids of one to three tiles get .grid--few (no two-column table cards
 * unless `wide` is true, and on phones an odd first tile turns into a
 * full-width card), so no row ends on a lone tile.
 *   lead  the first tile is a wide card, two columns across, with its
 *         one-line description (.grid--lead): for an odd number of tiles
 */
export function tileGrid(ctx, games, { headingLevel = 3, id = '', cls = '', wide, short = false, lead = false } = {}) {
  const n = games.length;
  const few = n <= 3;
  const classes = ['grid', cls, few ? `grid--few grid--n${n}` : '', lead ? 'grid--lead' : ''].filter(Boolean).join(' ');
  return `<ul class="${classes}"${id ? ` id="${esc(id)}"` : ''}>
  ${games.map((g, i) => tile(ctx, g, { headingLevel, short: short || (lead && i === 0), wide: few ? wide === true : wide ?? Boolean(g.table) })).join('\n  ')}
  </ul>`;
}

/**
 * The filter chips (spec 7.4) for a set of games, with a count on each chip
 * and a polite live count at the end. Chips that would show no games, or all
 * of them, are left out; with nothing to filter, there is no bar at all.
 *   filters   limit the chips to these keys (default: all of FILTERS)
 *   controls  space-separated ids of the grids the chips filter
 */
export function filterBar(games, { id = 'lobby', controls = '', filters, label = 'Filter games' } = {}) {
  const chips = FILTERS.filter((f) => f.key === 'all' || !filters || filters.includes(f.key))
    .map((f) => ({ ...f, n: f.key === 'all' ? games.length : games.filter((g) => (g.tags || []).includes(f.key)).length }))
    // a chip that would show every game, or none, filters nothing
    .filter((f) => f.key === 'all' || (f.n > 0 && f.n < games.length));
  if (chips.length < 2) return '';
  const ctl = controls ? ` aria-controls="${esc(controls)}"` : '';
  return `<div class="filters" role="group" aria-label="${esc(label)}" data-filters>
    ${chips
      .map(
        (f) =>
          `<button class="chip" type="button" aria-pressed="${f.key === 'all'}" data-filter="${f.key}"${ctl}>${esc(f.label)} <span class="n" aria-hidden="true">${f.n}</span><span class="visually-hidden">, ${f.n} ${f.n === 1 ? 'game' : 'games'}</span></button>`,
      )
      .join('\n    ')}
    <p class="filters__count" id="${esc(id)}-count" aria-live="polite" data-filter-count>${countText(games.length, games.length)}</p>
  </div>`;
}

/**
 * A lobby: the filter chips, then either one grid of games or several
 * titled groups of them (the games index uses #slots and #tables).
 *   games         the games to show (default: every game)
 *   id            prefix for the ids inside: `${id}-count`, `${id}-grid`
 *   headingLevel  tile titles; group titles are one level above
 *   groups        [{ id, title, intro, games, cls, short, wide, lead }]: one section each
 *   split         lay short groups side by side from 721px (for when there are
 *                 only three games in all)
 */
export function lobby(ctx, { games = ctx.games, filters, id = 'lobby', headingLevel = 3, groups, split = false } = {}) {
  if (!groups) {
    return `<div class="lobby__ui" data-lobby>
  ${filterBar(games, { id, controls: `${id}-grid`, filters })}
  ${tileGrid(ctx, games, { headingLevel, id: `${id}-grid` })}
</div>`;
  }
  const all = groups.flatMap((gr) => gr.games);
  const gh = `h${Math.max(2, headingLevel - 1)}`;
  return `<div class="lobby__ui" data-lobby>
  ${filterBar(all, { id, controls: groups.map((gr) => `${gr.id}-grid`).join(' '), filters })}
  <div class="lobby__groups${split ? ' lobby__groups--split' : ''}">
  ${groups
    .map(
      (gr) => `<section class="lobby__group" id="${esc(gr.id)}" aria-labelledby="${esc(gr.id)}-h" data-lobby-group>
    <div class="sechead">
      <${gh} class="display" id="${esc(gr.id)}-h">${gr.title}</${gh}>
      ${gr.intro ? `<p>${gr.intro}</p>` : ''}
    </div>
    ${tileGrid(ctx, gr.games, { headingLevel, id: `${gr.id}-grid`, cls: gr.cls || '', short: gr.short, wide: gr.wide, lead: gr.lead })}
  </section>`,
    )
    .join('\n  ')}
  </div>
</div>`;
}

/**
 * "More games" tiles for the foot of a game page: the games after this one
 * in lobby order (same kind first, wrapping round), up to `limit`. Five fill
 * a row at 1240px and wider; below that the grid shows four. Just two (the
 * demos switched off) sit side by side as wide cards with a line about each,
 * like the table pair on the games index, so the row closes.
 *   current  the page's path or slug (left out of the list)
 */
export function gameList(ctx, { current, headingLevel = 3, limit = 5 } = {}) {
  const here = ctx.games.find((g) => g.path === current || g.slug === current);
  let pick = ctx.games;
  if (here) {
    const same = ctx.games.filter((g) => Boolean(g.table) === Boolean(here.table));
    const k = same.indexOf(here);
    pick = [...same.slice(k + 1), ...same.slice(0, k), ...ctx.games.filter((g) => Boolean(g.table) !== Boolean(here.table))];
  }
  const list = pick.slice(0, limit);
  const pair = list.length === 2;
  return tileGrid(ctx, list, { headingLevel, cls: pair ? 'grid--more grid--pair' : 'grid--more', wide: pair, short: pair });
}
