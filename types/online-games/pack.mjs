// Type pack: online-games (free browser games). STUB, contract v0
// (engine/lib/pack.mjs): generic content-only pages under the engine's basic
// chrome, no type lint rules yet, the 'type-stub' lint (a warning; an error
// under --strict, so no site of this type can launch on the stub). The full
// pack (portal / single-game / kids variants, provider adapters, catalogue,
// games.* lints, check sections embed, catalogue, search, ad-distance, i18n)
// is Phase 4, partition T (MASTER-PLAN 6.2).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articlePages } from '../../engine/pages/article.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default {
  id: 'online-games',
  version: '0.0.1',
  status: 'stub',
  lintPrefix: 'games',
  variants: ['portal', 'single-game', 'kids'],
  chrome: 'basic',

  /** The content-only pages: the site's content/pages.json, else content-defaults/pages.json. */
  pages(ctx) {
    return articlePages(ctx, path.join(HERE, 'content-defaults/pages.json')).pages;
  },

  /** Web app manifest: no games, no currency, no age line yet. */
  manifest(ctx, m) {
    return { ...m, description: `${ctx.brand}: free browser games.`, categories: ['games'], shortcuts: [] };
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
