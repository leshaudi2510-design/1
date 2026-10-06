// Type pack: social-casino (UK free-to-play social casino). Contract v0
// (engine/lib/pack.mjs). In Phase 1 the pages, chrome and game code are still
// the engine's (engine/pages, engine/lib/layout.mjs, engine/games/_legacy);
// this pack orders them, names the stylesheet partials, owns the type's lint
// rules (lint.mjs) and declares the three check builds. Phase 2 moves the
// type's pages, chrome and client modules here (MASTER-PLAN 6.1, D-03).

import home from '../../engine/pages/home.mjs';
import gamesIndex from '../../engine/pages/games-index.mjs';
import pragmaticGame from '../../engine/pages/pragmatic-game.mjs';
import sevenSystems from '../../engine/pages/seven-systems.mjs';
import lapidaryWheel from '../../engine/pages/lapidary-wheel.mjs';
import brilliant21 from '../../engine/pages/brilliant-twenty-one.mjs';
import responsibleGaming from '../../engine/pages/responsible-gaming.mjs';
import { rules, MANDATORY } from './lint.mjs';

// Our own games' page modules, by slug (until engine/games/<id>/ plugins, Phase 3).
const HOUSE_PAGES = { 'seven-systems': sevenSystems, 'lapidary-wheel': lapidaryWheel, 'brilliant-twenty-one': brilliant21 };

const withPragmatic = (on) => (cfg) => ({ ...cfg, pragmatic: { ...cfg.pragmatic, enabled: on } });
// The check sections every build feeds (engine/tools/check.mjs, today's 'needed' table).
const ALL_SECTIONS = ['pages', 'stage', 'keyboard', 'tables', 'lobby', 'consent', 'dialogs', 'prefs', 'chrome', 'offline', 'deploy', 'axe'];

export default {
  id: 'social-casino',
  version: '0.1.0',
  status: 'full',
  lintPrefix: 'sc',
  variants: ['own-games', 'demo-lobby'],
  chrome: 'full',

  /** The page list in sitemap order: home, the lobby, every game, then the shared pages around the safer-play page. */
  pages(ctx, common) {
    return [
      home(ctx),
      gamesIndex(ctx),
      ...ctx.games.map((g) => (g.provider === 'pragmatic' ? pragmaticGame(ctx, g) : HOUSE_PAGES[g.slug](ctx))),
      common.about,
      responsibleGaming(ctx),
      common.terms,
      common.privacy,
      common.cookies,
      common.contact,
      common.notFound,
      common.offline,
    ];
  },

  styles: {
    partials: [
      '10-base.css', '20-chrome.css', '25-prose.css', '30-controls.css', '40-dialogs.css', '50-home.css',
      '55-pages.css', '60-lobby.css', '70-stage.css', '75-game-page.css', '80-tables.css', '95-prefs.css',
    ],
  },

  lint: { rules },
  mandatory: { pageLints: MANDATORY },

  checks: {
    builds: {
      pragmatic: { edit: withPragmatic(true), sections: ALL_SECTIONS.filter((s) => s !== 'consent') },
      fallback: { edit: withPragmatic(false), sections: ['pages', 'keyboard', 'tables', 'lobby', 'dialogs', 'prefs', 'chrome', 'offline', 'axe'] },
      ga: { edit: (cfg) => ({ ...withPragmatic(true)(cfg), analytics: { ga4: 'G-TEST000000', adsConversionId: '' } }), sections: ['consent', 'axe'] },
    },
  },

  templateSite: 'template-site',
  data: {
    policyUrls: 'policy-urls.json',
    helplines: 'helplines.json',
    pragmaticCatalog: 'data/pragmatic-catalog.json',
    knownStudioTitles: 'data/known-studio-titles.json',
  },
  schemas: { orderOptions: 'schema/order-options.schema.json' },
};
