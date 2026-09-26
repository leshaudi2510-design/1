// The 404 and offline pages, plus the small building blocks every info and
// legal page shares: the title band, the "On this page" list, the "In short"
// card, numbered legal sections and external links.
import { html, esc } from '../lib/html.mjs';
import { icons, icon } from '../lib/icons.mjs';
import { breadcrumbs } from '../lib/layout.mjs';

// ---------- shared pieces ----------

/** A link that opens in a new tab and says so to screen readers. */
export const ext = (href, text, { arrow = true } = {}) =>
  `<a href="${href}" rel="noopener" target="_blank">${text}<span class="visually-hidden"> (opens in a new tab)</span>${arrow ? icon('i-ext', 'ext-ico') : ''}</a>`;

// Line icons these pages need that the sprite doesn't have. Same style as
// icons.mjs: 24 × 24, currentColor, no style attributes (CSP).
const line = (body) =>
  `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const pageIcons = {
  lock: line('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/><path d="M12 14.5v2.5"/>'),
  stack: line('<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>'),
  offline: line('<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.8a10 10 0 0 1 5-2.6M19 12.8a10 10 0 0 0-2.9-2"/><path d="M2 9.3a14.5 14.5 0 0 1 4.3-2.6M22 9.3A14.5 14.5 0 0 0 11 5.6"/><circle cx="12" cy="19.6" r=".6" fill="currentColor"/>'),
  question: line('<circle cx="12" cy="12" r="9"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="17.2" r=".7" fill="currentColor"/>'),
};

/**
 * The title band (spec 7.17): the game-hero panel without rays, dots or the
 * stage. Crumbs, an optional eyebrow, the h1, the lede and optional fact pills.
 * art: { icon, tone: 'c' | 'm' | 'y' | 'r' } adds a starburst sticker on wide screens.
 */
export function pageHero(page, { eyebrow = '', title, lede = '', meta = [], actions = '', art = null } = {}) {
  const crumbs = page.breadcrumbs?.length ? breadcrumbs(page.breadcrumbs) : '';
  const cls = ['page-hero', art ? 'page-hero--art' : '', crumbs ? '' : 'page-hero--plain'].filter(Boolean).join(' ');
  return html`<header class="${cls}">
  <div class="wrap">
    ${crumbs}
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <h1 class="display">${title}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${meta.length ? `<p class="page-hero__meta">${meta.map((m) => `<span class="fact">${m}</span>`).join('')}</p>` : ''}
    ${actions ? `<div class="page-hero__actions">${actions}</div>` : ''}
    ${art
      ? `<div class="page-hero__art page-hero__art--${art.tone || 'c'}" aria-hidden="true"><svg class="page-hero__burst" viewBox="0 0 100 100" focusable="false"><use href="#burst-c"/></svg><span class="page-hero__disc">${art.icon}</span></div>`
      : ''}
  </div>
</header>`;
}

/** "Updated 25 September 2026" as a fact pill for the title band. */
export const updatedPill = (ctx) => `<span>Updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time></span>`;

/** The "On this page" list for legal pages. items: [{ id, title }] */
export function toc(items, { numbered = false } = {}) {
  return html`<nav class="toc" aria-labelledby="toc-title">
  <h2 id="toc-title" class="toc__title">On this page</h2>
  <ol class="toc__list${numbered ? ' toc__list--numbered' : ''}">
    ${items.map((s, i) => `<li><a href="#${s.id}">${numbered ? `<span class="toc__no num" aria-hidden="true">${i + 1}</span>` : ''}<span>${s.title}</span></a></li>`)}
  </ol>
</nav>`;
}

/** The "In short" card at the top of a legal page. */
export function inShort(items, label = 'In short') {
  return html`<section class="in-short" aria-labelledby="in-short-title">
  <h2 id="in-short-title" class="sticker">${label}</h2>
  <ul>${items.map((t) => `<li>${icons.tick}<span>${t}</span></li>`)}</ul>
</section>`;
}

/**
 * A legal page body: the "On this page" list, then the "In short" card and
 * the sections. sections: [{ id, title, body }]
 */
export function legalBody(sections, { numbered = false, summary = null } = {}) {
  const shown = sections.filter(Boolean);
  return html`<div class="page-body legal">
  ${toc(shown, { numbered })}
  <div class="legal__main">
    ${summary ? inShort(summary) : ''}
    <div class="prose prose--legal">
      ${shown.map(
        (s, i) => html`<section aria-labelledby="${s.id}">
        <h2 id="${s.id}">${numbered ? `<span class="h-no num" aria-hidden="true">${i + 1}</span><span class="visually-hidden">${i + 1}. </span>` : ''}${s.title}</h2>
        ${s.body}
      </section>`,
      )}
    </div>
  </div>
</div>`;
}

/** Link cards (the .tools / .tool pattern) for the 404 and offline pages. */
function jumpCards(items) {
  return html`<ul class="tools jump">
    ${items.map(
      (j) => `<li><a class="tool" href="${j.href}"><span class="ti ti--${j.tone}" aria-hidden="true">${j.icon}</span><span>${j.title}<small>${j.text}</small></span>${icon('i-arrow', 'go')}</a></li>`,
    )}
  </ul>`;
}

const keepHyphens = (name) => esc(name).replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>');

// ---------- 404 ----------

export function notFound(ctx) {
  const page = {
    id: 'not-found',
    path: '/404.html',
    file: '404.html',
    canonical: false,
    noindex: true,
    sitemap: false,
    title: `Page Not Found · ${ctx.brand}`,
    description: `This page isn't here. Try the games, the safer play tools or the home page of ${ctx.brand}.`,
  };
  const tables = ctx.houseGames.filter((g) => g.table);
  const slot = ctx.featured || ctx.games.find((g) => !g.table);
  const cards = [
    { href: '/games/', icon: icons.reels, tone: 'y', title: 'All games', text: ctx.pragmaticOn ? 'Slot demos and our own tables' : 'Our slot and tables' },
    slot && {
      href: slot.path,
      icon: icons.spins,
      tone: 'm',
      title: keepHyphens(slot.name),
      text: ctx.pragmaticOn ? 'Free demo from Pragmatic Play' : 'Three reels, five lines',
    },
    ...tables.map((g, i) => ({ href: g.path, icon: g.slug === 'lapidary-wheel' ? icons.wheel : icons.cards, tone: i ? 'c' : 'g', title: keepHyphens(g.name), text: g.slug === 'lapidary-wheel' ? 'Single-zero roulette with Carats' : 'Six-deck blackjack with Carats' })),
    { href: '/responsible-gaming/', icon: icons.shield, tone: 'r', title: 'Responsible gaming', text: 'Limits, breaks and where to get help' },
    { href: '/contact/', icon: pageIcons.question, tone: 'y', title: 'Contact us', text: 'Tell us about a broken link' },
  ].filter(Boolean);
  page.body = html`
${pageHero(page, {
  eyebrow: '<span class="num">Error 404</span>',
  title: 'This page isn’t here',
  lede: 'It may have moved, or the address may have a typo. Everything else is where you left it.',
  actions: '<a class="btn btn--primary" href="/">Back to the home page</a>',
  art: { icon: pageIcons.question, tone: 'm' },
})}
<section class="page-body" aria-labelledby="nf-more">
  <h2 id="nf-more" class="page-body__title">Try one of these</h2>
  ${jumpCards(cards)}
</section>`;
  return page;
}

// ---------- offline ----------

export function offline(ctx) {
  const page = {
    id: 'offline',
    path: '/offline/',
    canonical: false,
    noindex: true,
    sitemap: false,
    title: `You're Offline · ${ctx.brand}`,
    description: `You're offline. Pages you've visited on ${ctx.brand} still work, and so do our own games.`,
  };
  const own = ctx.houseGames;
  const cards = [
    { href: '/', icon: icons.home, tone: 'y', title: 'Home', text: 'The lobby and how it all works' },
    ...own.map((g, i) => ({
      href: g.path,
      icon: g.slug === 'lapidary-wheel' ? icons.wheel : g.slug === 'brilliant-twenty-one' ? icons.cards : icons.reels,
      tone: ['g', 'c', 'm'][i % 3],
      title: keepHyphens(g.name),
      text: 'Works without a connection',
    })),
    { href: '/responsible-gaming/', icon: icons.shield, tone: 'r', title: 'Responsible gaming', text: 'Your limits and breaks still apply' },
  ];
  page.body = html`
${pageHero(page, {
  eyebrow: 'No connection',
  title: 'You’re offline',
  lede: `This page hasn’t been saved on your device yet. Pages you’ve already opened still work, and so do our own games.${ctx.pragmaticOn ? ' The Pragmatic Play slot demos need a connection.' : ''}`,
  art: { icon: pageIcons.offline, tone: 'c' },
})}
<section class="page-body" aria-labelledby="off-more">
  <h2 id="off-more" class="page-body__title">These work offline</h2>
  ${jumpCards(cards)}
</section>`;
  return page;
}
