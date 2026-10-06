// Type pack: hotel-casino (marketing sites for hotels and resorts that have a
// casino). STUB, contract v0 (engine/lib/pack.mjs): generic content-only
// pages under the engine's basic chrome, no type lint rules yet, the
// 'type-stub' lint (a warning; an error under --strict, so no site of this
// type can launch on the stub). The full pack (Mode A / A+ / B, multilingual
// i18n, booking hand-off, gallery, map facade, hotel.* lints, check sections
// gallery, map, cta, lcp, i18n, casino-mode) is Phase 4, partition T
// (MASTER-PLAN 3.4, 6.3). The stub's pages never mention the casino: Mode A,
// the default, is a casino-free domain.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articlePages } from '../../engine/pages/article.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default {
  id: 'hotel-casino',
  version: '0.0.1',
  status: 'stub',
  lintPrefix: 'hotel',
  variants: ['single-hotel', 'integrated-resort', 'resort-group'],
  chrome: 'basic',

  /** The content-only pages: the site's content/pages.json, else content-defaults/pages.json. */
  pages(ctx) {
    return articlePages(ctx, path.join(HERE, 'content-defaults/pages.json')).pages;
  },

  /** Web app manifest: a hotel site, not a games site. */
  manifest(ctx, m) {
    return { ...m, description: `${ctx.brand}: rooms, dining and offers.`, categories: ['travel', 'lifestyle'], shortcuts: [] };
  },

  styles: {
    partials: ['10-base.css', '20-chrome.css', '25-prose.css', '30-controls.css', '40-dialogs.css', '55-pages.css', '95-prefs.css'],
  },

  lint: { rules: [] },
  mandatory: { pageLints: [] },

  checks: {
    builds: {
      default: { edit: (cfg) => cfg, sections: ['pages', 'keyboard', 'chrome', 'axe'] },
      ga: { edit: (cfg) => ({ ...cfg, analytics: { ga4: 'G-TEST000000', adsConversionId: '' } }), sections: ['consent', 'axe'] },
    },
  },

  templateSite: 'template-site',
  schemas: { orderOptions: 'schema/order-options.schema.json' },
};
