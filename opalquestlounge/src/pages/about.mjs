import { html, esc } from '../lib/html.mjs';
import { organizationLd } from '../lib/layout.mjs';

export function operatorCard(ctx) {
  const { op } = ctx;
  return html`<dl class="operator">
    <div><dt>Company</dt><dd>${esc(op.companyName)}</dd></div>
    <div><dt>Company number</dt><dd class="num">${esc(op.companyNumber)}</dd></div>
    <div><dt>Registered in</dt><dd>${esc(op.registeredIn)}</dd></div>
    <div><dt>Registered office</dt><dd>${esc(op.address)}</dd></div>
    <div><dt>Email</dt><dd><a href="mailto:${esc(op.email)}">${esc(op.email)}</a></dd></div>
    <div><dt>Website</dt><dd>${esc(ctx.cfg.domain)}</dd></div>
  </dl>`;
}

export default function about(ctx) {
  const c = ctx.cur;
  return {
    id: 'about',
    path: '/about/',
    title: `About Us and Who Runs the Site · ${ctx.brand}`,
    description: `Who operates ${ctx.brand}, how our free social casino games work, why there's no real money or prizes, and how to reach us.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about/' },
    ],
    jsonld: [
      organizationLd(ctx),
      { '@type': 'AboutPage', name: `About ${ctx.brand}`, url: `${ctx.origin}/about/`, about: { '@id': ctx.orgId }, dateModified: ctx.updatedIso },
    ],
    body: html`
<header class="page-head">
  <p class="eyebrow">About</p>
  <h1 class="page-title">About ${esc(ctx.brand)}</h1>
  <p class="lede">A small, free games room with three casino-style games, run by a UK company. No real money, no prizes and nothing to buy.</p>
</header>

<div class="prose-grid prose-grid--plain">
  <aside class="aside-card" aria-labelledby="who-title">
    <h2 id="who-title">Who runs this site</h2>
    ${operatorCard(ctx)}
    <p><a href="/contact/">Contact us</a></p>
  </aside>
  <div class="prose">
    <section aria-labelledby="what-title">
      <h2 id="what-title">What this site is</h2>
      <p>${esc(ctx.brand)} is a social casino: games in the style of a casino that you play for fun, with a virtual currency called ${esc(c.plural)}. ${esc(ctx.disclaimer)}</p>
      <p>${ctx.cfg.purchases ? `You can buy extra ${esc(c.plural)}, but you never need to, and they have no cash value.` : `There are no purchases of any kind.`} You can't pay money in, take money out or swap ${esc(c.plural)} for anything, and we don't run competitions or prize draws.</p>
    </section>
    <section aria-labelledby="isnt-title">
      <h2 id="isnt-title">What it isn't</h2>
      <p>We're not a gambling operator and we don't hold a gambling licence, because nothing on the site can be won. We don't link to gambling sites, carry their adverts, or take payment for sending players to them.</p>
    </section>
    <section aria-labelledby="how-title">
      <h2 id="how-title">How the games work</h2>
      <p>Every game is written by us and drawn in your browser. Results come from your browser's cryptographic random number generator. We publish the rules, the paytables and the return to player for each game, with the arithmetic behind them. Nothing adjusts the odds to keep you playing.</p>
      <p>Your balance and settings live in your browser's storage. We don't have accounts, so we don't know your balance and can't change it.</p>
    </section>
    <section aria-labelledby="why-title">
      <h2 id="why-title">Why a mineral cabinet</h2>
      <p>Victorian collectors kept minerals in shallow wooden drawers, each specimen on a card with a number, a name and a line or two in careful handwriting. We liked the idea of games set out the same way: numbered, labelled and explained. The symbols are crystal drawings in the style of 19th-century mineralogy plates. The colours are opal, garnet, Whitby jet and malachite.</p>
      <p>Opal has a special place. Queen Victoria wore it and gave it to her daughters, at a time when many people thought it unlucky. It's also the only thing on the site with every colour in it.</p>
    </section>
    <section aria-labelledby="age-title">
      <h2 id="age-title">Adults only</h2>
      <p>The games are for people aged 18 and over. We ask your age on your first visit, keep our design and language grown-up, and don't target anyone under 18 in our marketing.</p>
    </section>
    <section aria-labelledby="access-title">
      <h2 id="access-title">Accessibility</h2>
      <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. Every game works with a keyboard and announces its results to screen readers. The site respects your device's settings for reduced motion, higher contrast and dark mode. If something doesn't work for you, please <a href="/contact/">tell us</a>.</p>
    </section>
    <section aria-labelledby="ed-title">
      <h2 id="ed-title">How we write this site</h2>
      <p>The game rules, maths and history on this site are written and checked by the team behind ${esc(ctx.brand)}. Figures such as RTP are produced by the same code that runs the games. We review the content whenever a game changes. This page was last updated on <time datetime="${ctx.updatedIso}">${ctx.updated}</time>.</p>
    </section>
  </div>
</div>`,
  };
}
