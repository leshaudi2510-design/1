import { html, esc } from '../lib/html.mjs';
import { organizationLd } from '../lib/layout.mjs';
import { icons, icon } from '../lib/icons.mjs';
import { pageHero } from './misc.mjs';

export function operatorCard(ctx, { email = true } = {}) {
  const { op } = ctx;
  return html`<dl class="operator">
    <div><dt>Company</dt><dd>${esc(op.companyName)}</dd></div>
    <div><dt>Company number</dt><dd class="num">${esc(op.companyNumber)}</dd></div>
    <div><dt>Registered in</dt><dd>${esc(op.registeredIn)}</dd></div>
    <div><dt>Registered office</dt><dd>${esc(op.address)}</dd></div>
    ${email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(op.email)}">${esc(op.email)}</a></dd></div>` : ''}
    <div><dt>Website</dt><dd>${esc(ctx.cfg.domain)}</dd></div>
  </dl>`;
}

const nobr = (s) => `<span class="nobr">${esc(s)}</span>`;

export default function about(ctx) {
  const c = ctx.cur;
  const pp = ctx.pragmaticOn;
  const tables = ctx.houseGames.filter((g) => g.table);
  const slots = ctx.games.filter((g) => !g.table);
  const tableNames = tables.map((g) => `<a href="${g.path}">${nobr(g.name)}</a>`).join(' and ');

  const page = {
    id: 'about',
    path: '/about/',
    title: `About Us and Who Runs the Site · ${ctx.brand}`,
    description: pp
      ? `Who runs ${ctx.brand}, what you can play here, why there's no real money or prizes, and our link with Pragmatic Play: there isn't one.`
      : `Who runs ${ctx.brand}, how our free social casino games work, why there's no real money or prizes, and how to reach us.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about/' },
    ],
    crumbsInBody: true,
    jsonld: [
      organizationLd(ctx),
      { '@type': 'AboutPage', name: `About ${ctx.brand}`, url: `${ctx.origin}/about/`, about: { '@id': ctx.orgId }, dateModified: ctx.updatedIso },
    ],
  };

  // The two kinds of game on the site, as cards.
  const kinds = pp
    ? [
        {
          dot: 'pp',
          label: 'Pragmatic Play',
          title: 'Slot demos',
          text: `${slots.length} free demo versions of Pragmatic Play slots. Each one loads from Pragmatic Play’s servers when you press Play, and runs on demo credits that are separate from your ${esc(c.plural)} and have no value.`,
          link: { href: '/games/#slots', text: 'See the slot demos' },
        },
        {
          dot: 'oq',
          label: esc(ctx.brand),
          title: 'Our own tables',
          text: `${tableNames}: single-zero roulette and six-deck blackjack. We wrote them, they run in your browser, and you play with free ${esc(c.plural)}.`,
          link: { href: '/games/#tables', text: 'See the tables' },
        },
      ]
    : [
        {
          dot: 'oq',
          label: esc(ctx.brand),
          title: 'Our own games',
          text: `${ctx.houseGames.map((g) => `<a href="${g.path}">${nobr(g.name)}</a>`).join(', ').replace(/, ([^,]*)$/, ' and $1')}: a three-reel slot, single-zero roulette and six-deck blackjack, played with free ${esc(c.plural)}.`,
          link: { href: '/games/', text: 'See all games' },
        },
      ];

  page.body = html`
${pageHero(page, {
  eyebrow: 'About',
  title: `About ${esc(ctx.brand)}`,
  lede: pp
    ? `A free games room for adults in the UK: slot demos from Pragmatic Play, and our own roulette and blackjack tables played with free ${esc(c.plural)}. No real money, no prizes and nothing to buy.`
    : `A free games room for adults in the UK, with our own slot, roulette and blackjack games played with free ${esc(c.plural)}. No real money, no prizes and nothing to buy.`,
  art: { icon: icon('opal', 'disc-opal'), tone: 'm' },
})}
<div class="page-body split">
  <div class="split__main">
    <div class="prose">
      <section aria-labelledby="what-title">
        <h2 id="what-title">What this site is</h2>
        <p>${esc(ctx.brand)} is a social casino: games in the style of a casino that you play for fun. <strong>${esc(ctx.disclaimer)}</strong></p>
        <p>${ctx.cfg.purchases ? `You can buy extra ${esc(c.plural)}, but you never need to, and they have no cash value.` : `There are no purchases of any kind.`} You can’t pay money in, take money out or swap ${esc(c.plural)}${pp ? ' or demo credits' : ''} for anything, and we don’t run competitions or prize draws.</p>
      </section>
      <section aria-labelledby="here-title">
        <h2 id="here-title">What’s here</h2>
        <ul class="kinds${kinds.length === 1 ? ' kinds--one' : ''}">
          ${kinds.map(
            (k) => html`<li class="kind kind--${k.dot}">
            <p class="kind__by"><i class="dot dot--${k.dot}" aria-hidden="true"></i>${k.label}</p>
            <h3>${k.title}</h3>
            <p>${k.text}</p>
            <p class="kind__go"><a href="${k.link.href}">${k.link.text}</a></p>
          </li>`,
          )}
        </ul>
      </section>
      ${pp
        ? html`<section aria-labelledby="pp-title">
        <h2 id="pp-title">We’re not part of Pragmatic Play</h2>
        <p>${esc(ctx.brand)} is independent. We are <strong>not affiliated with or endorsed by Pragmatic Play</strong>, and Pragmatic Play doesn’t run this site. We choose which demos to list, write the descriptions in our own words and draw every cover picture ourselves.</p>
        <p>Pragmatic Play makes and hosts the demos, and its own terms apply inside them. Game names are trademarks of their owners and appear here only to say which demo you’re opening. Megaways is a trademark of Big Time Gaming.</p>
      </section>`
        : ''}
      <section aria-labelledby="isnt-title">
        <h2 id="isnt-title">What it isn’t</h2>
        <p>We’re not a gambling operator and we don’t hold a gambling licence, because there are no prizes and nothing here can be exchanged for money. We don’t carry gambling adverts, link to real-money casinos, or take payment for sending players anywhere.</p>
      </section>
      <section aria-labelledby="how-title">
        <h2 id="how-title">How our own games work</h2>
        <p>Results on our ${pp ? 'tables' : 'games'} come from your browser’s cryptographic random number generator. We publish the rules, the pays and the return to player for each game, with the arithmetic behind them. Nothing adjusts the odds to keep you playing.</p>
        <p>Your balance and settings live in your browser’s storage. We don’t have accounts, so we don’t know your balance and can’t change it.</p>
      </section>
      <section aria-labelledby="adults-title">
        <h2 id="adults-title">Adults only</h2>
        <p>Games that look like gambling are for adults, even when they’re free. The site is for people aged 18 and over in the United Kingdom. We ask your age on your first visit, and our artwork shows objects and places only: no characters, mascots or cartoon animals.</p>
        <p>The age question isn’t an identity check. If you share a device with children, please use its parental controls.</p>
      </section>
      <section aria-labelledby="access-title">
        <h2 id="access-title">Accessibility</h2>
        <p>We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. Our own games work with a keyboard and announce their results to screen readers. The site respects your device’s settings for reduced motion, higher contrast and dark mode.${pp ? ' The slot demos are made by Pragmatic Play and we can’t change how they work, so they may not suit every keyboard or screen reader.' : ''} If something doesn’t work for you, please <a href="/contact/">tell us</a>.</p>
      </section>
      <section aria-labelledby="ed-title">
        <h2 id="ed-title">How we write this site</h2>
        <p>${pp ? 'We write the slot descriptions ourselves from Pragmatic Play’s published game information. ' : ''}The rules and figures for our own games are checked against the code that runs them. We review the content whenever a game changes. This page was last updated on <time datetime="${ctx.updatedIso}">${ctx.updated}</time>.</p>
      </section>
    </div>
  </div>

  <aside class="split__side" aria-label="Company details">
    <section class="side-card" aria-labelledby="who-title">
      <h2 id="who-title" class="side-card__head">Who runs this site</h2>
      <div class="side-card__body">
        ${operatorCard(ctx)}
        <p><a class="btn btn--secondary" href="/contact/"><span>Contact us</span>${icons.arrow}</a></p>
      </div>
    </section>
    <div class="callout callout--note side-note-card">
      <p><strong>Need to talk about gambling?</strong> GamCare’s National Gambling Helpline is free, confidential and open 24 hours a day on <a class="nobr" href="tel:+448088020133">0808 8020 133</a>.</p>
    </div>
  </aside>
</div>`;
  return page;
}
