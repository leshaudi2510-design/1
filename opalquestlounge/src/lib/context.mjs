import { readFileSync } from 'node:fs';
import { longDate, num, pct } from './html.mjs';
import * as slot from '../public/assets/js/games/seven-systems.math.js';
import * as wheel from '../public/assets/js/games/lapidary-wheel.math.js';
import * as bj from '../public/assets/js/games/brilliant-21.math.js';

export const DISCLAIMER =
  'Free-to-play social casino game. No real-money gambling and no prizes of real-world value. For adults 18+.';

// Measured with tools/simulate-21.mjs over 20 million hands of basic strategy.
export const TWENTY_ONE_RTP = 0.9957;

const pragmaticData = JSON.parse(readFileSync(new URL('../data/pragmatic-games.json', import.meta.url), 'utf8'));

export function makeContext(cfg) {
  const origin = `https://${cfg.domain}`;
  const cur = cfg.currency;
  const slotStats = slot.exactStats();

  // Our own games. Seven Systems is our slot; it is listed only when the
  // Pragmatic Play demos are switched off (site.config.json "pragmatic.enabled").
  const house = [
    {
      slug: 'seven-systems',
      no: '001',
      name: 'Seven Systems',
      kind: 'Slot',
      spec: '3 reels · 5 lines',
      genre: ['Slot machine', 'Casino game'],
      short: 'A three-reel slot drawn from the seven crystal systems. Opal has no crystal lattice, so it stands in for any mineral.',
      stakes: `${num(slot.STAKES[0])} to ${num(slot.STAKES.at(-1))} ${cur.plural} a spin`,
      rtp: slotStats.rtp,
      rtpLabel: pct(slotStats.rtp),
      rtpHow: 'Exact: every one of the 39,304 reel-stop combinations, counted',
      glyph: 'crystal',
      tileFacts: ['3 reels', '5 lines'],
      // Lobby filter tags only for features a game really has: Seven Systems has
      // no free spins, tumbles or Megaways (build.mjs checks this).
      tags: [],
    },
    {
      slug: 'lapidary-wheel',
      no: '002',
      name: 'Lapidary Wheel',
      kind: 'European roulette',
      spec: '37 pockets · single zero',
      genre: ['Roulette', 'Casino game'],
      short: 'Single-zero roulette on a wheel cut like a gemstone. Garnet for red, Whitby jet for black, malachite for zero.',
      stakes: `${num(wheel.CHIPS[0])} to ${num(wheel.TABLE_LIMIT)} ${cur.plural} a spin`,
      rtp: 36 / 37,
      rtpLabel: pct(36 / 37),
      rtpHow: 'Exact: 36 ÷ 37 for every bet on the table',
      glyph: 'wheel',
      tileFacts: ['Roulette', 'Single zero'],
      tags: ['table'],
    },
    {
      slug: 'brilliant-twenty-one',
      no: '003',
      name: 'Brilliant Twenty-One',
      kind: 'Blackjack',
      spec: '6 decks · dealer stands on 17',
      genre: ['Blackjack', 'Card game', 'Casino game'],
      short: 'Six-deck blackjack. A two-card 21 is a Brilliant and pays 3 to 2. Ask for the basic-strategy hint whenever you like.',
      stakes: `${num(bj.STAKES[0])} to ${num(bj.STAKES.at(-1))} ${cur.plural} a hand`,
      rtp: TWENTY_ONE_RTP,
      rtpLabel: `about ${pct(TWENTY_ONE_RTP, 1)}`,
      rtpHow: 'Measured: 20 million simulated hands of basic strategy',
      glyph: 'card',
      tileFacts: ['Blackjack', '6 decks'],
      tags: ['table'],
    },
  ].map((g) => ({ ...g, provider: 'house', providerName: cfg.brand, table: g.tags.includes('table') }));

  // Pragmatic Play demos (src/data/pragmatic-games.json), loaded in an iframe
  // only when the visitor presses "Play demo".
  const pragmaticOn = Boolean(cfg.pragmatic?.enabled);
  const TAGS = { 'free-spins': 'freespins', tumble: 'tumble', megaways: 'megaways' };
  const shortGrid = (grid) => (/^\d+×\d+$/.test(grid) ? grid : grid.replace(/,.*$/, ''));
  const mechanicTag = (d) =>
    d.tags.includes('megaways') ? 'Tumble' : d.tags.includes('cluster') ? 'Clusters' : d.tags.includes('tumble') ? 'Tumble'
      : d.tags.includes('respins') ? 'Respins' : d.tags.includes('sticky-wilds') ? 'Sticky wilds' : /(\d+) (fixed )?paylines/.test(d.pays) ? `${d.pays.match(/(\d+) (?:fixed )?paylines/)[1]} lines` : 'Free spins';
  const pragmatic = pragmaticOn
    ? pragmaticData.games.map((d) => ({
        ...d,
        provider: 'pragmatic',
        providerName: 'Pragmatic Play',
        kind: 'Video slot',
        genre: ['Slot machine', 'Casino game'],
        short: d.summary,
        rtpLabel: d.rtp ? `${d.rtp.toFixed(2)}%` : '',
        tileFacts: [shortGrid(d.grid), mechanicTag(d)],
        tags: [...new Set(d.tags.map((t) => TAGS[t]).filter(Boolean))],
        table: false,
      }))
    : [];

  // Lobby order: the featured demo first, then a mix of mechanics, then our tables.
  const LOBBY = [
    'gates-of-olympus', 'big-bass-bonanza', 'wolf-gold', 'great-rhino-megaways', 'madame-destiny-megaways', 'zeus-vs-hades-gods-of-war',
    'wild-west-gold', 'buffalo-king-megaways', 'sweet-bonanza', 'gates-of-olympus-1000', 'fruit-party', 'big-bass-splash',
  ];
  const slots = pragmaticOn
    ? LOBBY.map((slug) => pragmatic.find((g) => g.slug === slug)).filter(Boolean).concat(pragmatic.filter((g) => !LOBBY.includes(g.slug)))
    : house.filter((g) => !g.table);
  const games = [...slots, ...house.filter((g) => g.table)];
  for (const g of games) {
    g.path = `/games/${g.slug}/`;
    g.url = origin + g.path;
    g.image = `/assets/img/og-${g.slug}.png`;
    g.cover = g.slug;
  }

  const op = cfg.operator;
  const orgId = `${origin}/#organization`;

  return {
    cfg,
    origin,
    brand: cfg.brand,
    cur,
    carats: (n) => `${num(n)} ${n === 1 ? cur.singular : cur.plural}`,
    op,
    orgId,
    websiteId: `${origin}/#website`,
    disclaimer: DISCLAIMER,
    updated: longDate(cfg.lastUpdated),
    updatedIso: cfg.lastUpdated,
    year: cfg.lastUpdated.slice(0, 4),
    games,
    game: (slug) => games.find((g) => g.slug === slug),
    pragmaticOn,
    pragmaticGames: pragmatic,
    houseGames: games.filter((g) => g.provider === 'house'),
    featured: pragmaticOn ? games.find((g) => g.slug === (cfg.pragmatic.featured || 'gates-of-olympus')) : null,
    slot,
    slotStats,
    wheel,
    bj,
    analyticsOn: Boolean(cfg.analytics?.ga4 || cfg.analytics?.adsConversionId),
  };
}
