// The games index (/games/): title band, filter chips, the slot and table
// grids (#slots and #tables, which the main nav links to) and a table of
// every game's provider, grid, top payout and RTP.
import { html, esc, num } from '../lib/html.mjs';
import { breadcrumbs } from '../lib/layout.mjs';
import { lobby } from '../lib/games-ui.mjs';

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const Words = (n) => WORDS[n] || num(n);

/** Seven Systems' top payout, as a multiple of the spin stake: the best of all 39,304 reel stops. */
function slotTopPayout(slot) {
  let best = 0;
  for (let a = 0; a < slot.STOPS; a++)
    for (let b = 0; b < slot.STOPS; b++)
      for (let c = 0; c < slot.STOPS; c++) best = Math.max(best, slot.settle([a, b, c], 1).returned);
  return best;
}

/** One row of the side-by-side table: grid, top payout and RTP, each with an optional note. */
function row(ctx, g) {
  if (g.provider === 'pragmatic') {
    return {
      grid: esc(g.grid),
      top: g.topPayout ? `${num(g.topPayout)}× stake` : '<span class="rtp__none">Not listed</span>',
      rtp: esc(g.rtpLabel),
    };
  }
  const plain = (s) => esc(s.replace(/ · /g, ', '));
  switch (g.slug) {
    case 'seven-systems':
      return {
        grid: plain(g.spec),
        top: `${num(Math.round(slotTopPayout(ctx.slot) * 10) / 10)}× stake<small>the best spin of all 39,304</small>`,
        rtp: `${esc(g.rtpLabel)}<small>${esc(g.rtpHow)}</small>`,
      };
    case 'lapidary-wheel':
      return { grid: plain(g.spec), top: '35 to 1<small>a single number</small>', rtp: `${esc(g.rtpLabel)}<small>${esc(g.rtpHow)}</small>` };
    case 'brilliant-twenty-one':
      return {
        grid: plain(g.spec),
        top: '3 to 2<small>a Brilliant: a two-card 21</small>',
        rtp: `${esc(g.rtpLabel.replace(/^about/, 'About'))}<small>with basic strategy</small>`,
      };
    default:
      return { grid: plain(g.spec || ''), top: '', rtp: esc(g.rtpLabel || '') };
  }
}

export default function gamesIndex(ctx) {
  const c = ctx.cur;
  const pp = ctx.pragmaticOn;
  const slots = ctx.games.filter((g) => !g.table);
  const tables = ctx.games.filter((g) => g.table);
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Games', path: '/games/' },
  ];
  const description = pp
    ? `${Words(slots.length)} free Pragmatic Play slot demos and our own roulette and blackjack. Filter by feature and compare RTP and top payouts. No real money. 18+.`
    : `Our own slot, roulette and blackjack, played with free ${c.plural}. Compare their rules, RTP and top payouts. No real money, no prizes. For adults 18+.`;

  // The slot rows close at every width (spec 5): an odd number of slots leads
  // with a wide card, and from 1240px the grid keeps four columns when four
  // close the rows and five would not (twelve cells: 5/5/2 on five columns).
  const cells = slots.length + (slots.length % 2);
  const many = pp && slots.length > 3;
  const groups = [
    {
      id: 'slots',
      title: pp ? 'Slot demos' : 'Our slot',
      intro: pp
        ? `Pragmatic Play's own demos. Each one loads only when you press Play, and plays with demo credits, which aren't ${esc(c.plural)} and have no value.`
        : 'Seven Systems: three reels of crystal drawings.',
      games: slots,
      cls: many && cells % 5 !== 0 && cells % 4 === 0 ? 'grid--four' : '',
      lead: many && slots.length % 2 === 1,
    },
    {
      id: 'tables',
      title: 'Table games',
      intro: pp ? `Roulette and blackjack of our own, played with free ${esc(c.plural)}.` : 'Roulette and blackjack of our own.',
      games: tables,
      // with only two tables, they sit side by side as wide cards with a line about each
      cls: pp ? 'grid--pair' : '',
      wide: pp,
      short: pp,
    },
  ];

  return {
    id: 'games',
    path: '/games/',
    title: pp ? `Games: Free Slot Demos and RTP Compared · ${ctx.brand}` : `Our Games: Rules and RTP Compared · ${ctx.brand}`,
    description,
    breadcrumbs: crumbs,
    crumbsInBody: true,
    jsonld: [
      {
        '@type': 'CollectionPage',
        '@id': `${ctx.origin}/games/#page`,
        name: 'Games',
        url: `${ctx.origin}/games/`,
        description,
        inLanguage: 'en-GB',
        isPartOf: { '@id': ctx.websiteId },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: ctx.games.length,
          itemListElement: ctx.games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: g.url, name: g.name })),
        },
      },
    ],
    budgetModules: ['/assets/js/lib/lobby.js'],
    bodyClass: 'is-games',
    body: html`
<header class="page-hero">
  <div class="wrap">
    ${breadcrumbs(crumbs)}
    <h1 class="display">Games</h1>
    <p class="lede">${pp
      ? `${Words(slots.length)} Pragmatic Play slot demos and ${Words(tables.length).toLowerCase()} tables of our own, all free. Filter by feature, open a game for its rules, or compare them all in the table at the end.`
      : `Our own slot and ${Words(tables.length).toLowerCase()} tables, all free and played with ${esc(c.plural)}. Open a game for its rules, or compare them in the table at the end.`}</p>
  </div>
</header>

<div class="lobby lobby--index">
  <div class="wrap">
    ${lobby(ctx, { id: 'games', headingLevel: 3, groups, split: !pp })}
  </div>
</div>

<section class="rtp" aria-labelledby="rtp-h">
  <div class="wrap">
    <div class="sechead">
      <h2 id="rtp-h" class="display">Side by side</h2>
      <p>Return to player (RTP) is the share of stakes a game pays back over a very long run. It says nothing about what happens in any one session.</p>
    </div>
    <div class="table-wrap">
    <table class="paytable paytable--index">
      <caption class="visually-hidden">Provider, grid, top payout and RTP for every game</caption>
      <thead><tr><th scope="col">Game</th><th scope="col">Provider</th><th scope="col">Grid</th><th scope="col">Top payout</th><th scope="col"><abbr title="Return to player">RTP</abbr></th></tr></thead>
      <tbody>
        ${ctx.games.map((g) => {
          const r = row(ctx, g);
          return `<tr><th scope="row"><a href="${g.path}">${esc(g.name).replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>')}</a></th><td class="rtp__prov"><i class="dot dot--${g.provider === 'pragmatic' ? 'pp' : 'oq'}" aria-hidden="true"></i>${esc(g.providerName)}</td><td>${r.grid}</td><td>${r.top}</td><td>${r.rtp}</td></tr>`;
        })}
      </tbody>
    </table>
    </div>
    <p class="rtp__note">${pp
      ? `The Pragmatic Play figures are the usual defaults, taken from Pragmatic's announcements and independent reviews. A demo can run a version set differently: inside it, the i button shows the figures for the version you are playing. Our own games' figures are worked out as each game page explains. Demo credits and ${esc(c.plural)} have no cash value.`
      : `Each game page shows how its figure is worked out. ${esc(c.plural)} have no cash value.`}</p>
  </div>
</section>`,
  };
}
