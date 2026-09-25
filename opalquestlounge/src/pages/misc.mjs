import { html, esc } from '../lib/html.mjs';
import { gameList } from '../lib/games-ui.mjs';

export function notFound(ctx) {
  return {
    id: 'not-found',
    path: '/404.html',
    file: '404.html',
    canonical: false,
    noindex: true,
    sitemap: false,
    title: `Page Not Found · ${ctx.brand}`,
    description: `This page isn't in the cabinet. Try the games, the rules or the home page of ${ctx.brand}.`,
    body: html`
<header class="page-head page-head--404">
  <p class="eyebrow"><span class="num">Error 404</span> · Empty drawer</p>
  <h1 class="page-title">No specimen in this drawer</h1>
  <p class="lede">The page you asked for isn't here. It may have moved, or the address may have a typo.</p>
  <p><a class="btn btn--primary" href="/">Back to the lounge</a></p>
</header>
<section class="section" aria-labelledby="nf-games">
  <h2 id="nf-games">The games are all still here</h2>
  ${gameList(ctx)}
</section>`,
  };
}

export function offline(ctx) {
  return {
    id: 'offline',
    path: '/offline/',
    canonical: false,
    noindex: true,
    sitemap: false,
    title: `You're Offline · ${ctx.brand}`,
    description: `You're offline. Pages you've visited on ${ctx.brand} still work, and so do the games.`,
    body: html`
<header class="page-head">
  <p class="eyebrow">No connection</p>
  <h1 class="page-title">You're offline</h1>
  <p class="lede">This page hasn't been saved on your device yet. Pages you've already opened, and the games, work without a connection.</p>
  <ul class="plain-links">${ctx.games.map((g) => `<li><a href="${g.path}">${esc(g.name)}</a></li>`)}<li><a href="/">The lounge</a></li></ul>
</header>`,
  };
}
