import { html, esc, num } from '../lib/html.mjs';
import { icons } from '../lib/icons.mjs';
import { pageHero, updatedPill, legalBody, ext } from './misc.mjs';

export const PRAGMATIC_TERMS = 'https://www.pragmaticplay.com/en/terms-of-use/';

export default function terms(ctx) {
  const c = ctx.cur;
  const { op } = ctx;
  const pp = ctx.pragmaticOn;
  const tables = ctx.houseGames.filter((g) => g.table).map((g) => g.name);
  const ours = ctx.houseGames.map((g) => `<span class="nobr">${esc(g.name)}</span>`);
  const oxford = (a) => (a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);

  const page = {
    id: 'terms',
    path: '/terms/',
    title: `Terms of Use · ${ctx.brand}`,
    description: `The terms for using ${ctx.brand}: adults 18+ only, free games${pp ? ', slot demos from Pragmatic Play' : ''}, virtual ${c.plural}, no real money and no prizes.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Terms of use', path: '/terms/' },
    ],
    crumbsInBody: true,
    bodyClass: 'is-legal',
  };

  const sections = [
    {
      id: 'who-we-are',
      title: 'Who we are',
      body: html`<p>${esc(ctx.brand)} (the “site”) is run by ${esc(op.companyName)}, company number ${esc(op.companyNumber)}, registered in ${esc(op.registeredIn)}, with its registered office at ${esc(op.address)} (“we”, “us”). You can contact us at <a href="mailto:${esc(op.email)}">${esc(op.email)}</a>.</p>
    <p>By using the site you agree to these terms. If you don’t agree, please don’t use it.</p>`,
    },
    {
      id: 'who-can-play',
      title: 'Who can play',
      body: html`<p>You must be 18 or over. We ask your age on your first visit. If you tell us you’re under 18, the games are locked on that device for 30 days. If we have reason to believe a user is under 18, we may block access.</p>
    <p>The site is intended for people in the United Kingdom.</p>`,
    },
    {
      id: 'the-games',
      title: 'What the games are',
      body: html`<p><strong>${esc(ctx.disclaimer)}</strong></p>
    ${pp
      ? html`<p>The site has two kinds of game:</p>
    <ul>
      <li><strong>Slot demos</strong>: free demonstration versions of slot games made by Pragmatic Play. <a href="#demos">How the demos work</a> is below.</li>
      <li><strong>Our own tables</strong>: ${oxford(tables.map((t) => `<span class="nobr">${esc(t)}</span>`))}, which we wrote and which run in your browser with a virtual currency called ${esc(c.plural)}.</li>
    </ul>`
      : html`<p>The games (${oxford(ours)}) are our own. They run in your browser with a virtual currency called ${esc(c.plural)}.</p>`}
    <p>The games are for entertainment. Doing well in a free game doesn’t mean you’d do well gambling with real money.</p>`,
    },
    pp && {
      id: 'demos',
      title: 'The Pragmatic Play demos',
      body: html`<ul>
      <li>The slot demos are provided by Pragmatic Play and load from Pragmatic Play’s servers. Nothing loads until you press a Play button.</li>
      <li>They play with demo credits. Demo credits are not ${esc(c.plural)}, have no value and can’t be bought or exchanged for anything.</li>
      <li>Pragmatic Play runs the demos, not us. A demo may be unavailable, slow to load, changed or removed at any time, and we can’t fix problems inside it.</li>
      <li>We don’t control what happens inside a demo, including its rules, results, sounds and settings. Pragmatic Play’s own ${ext(PRAGMATIC_TERMS, 'terms of use')} apply to the demo itself.</li>
      <li>Your time limits and breaks on this site still apply: when a break or your daily limit starts, an open demo closes.</li>
      <li>We are not affiliated with or endorsed by Pragmatic Play. Game names are trademarks of their owners, and the cover pictures on this site are our own artwork.</li>
    </ul>`,
    },
    {
      id: 'carats',
      title: esc(c.plural),
      body: html`<ul>
      <li>${esc(c.plural)} are a virtual game currency with no monetary value${pp ? `, used on our own tables` : ''}. They are not money, e-money, a voucher, a cryptoasset or property of any kind.</li>
      <li>${esc(c.plural)} can’t be bought${ctx.cfg.purchases ? ' except through the optional purchases described on the site' : ''}, sold, transferred, redeemed, exchanged for money, goods or services, or used anywhere else.</li>
      <li>There are no prizes, competitions or prize draws on the site.</li>
      <li>You start with ${ctx.carats(c.startingBalance)}. When your balance is under ${num(c.topUpBelow)}, you can claim ${ctx.carats(c.topUpAmount)} free.</li>
      <li>Your balance is stored in your browser. If you clear your browser’s data, change browser or change device, the balance starts again. We can’t restore it.</li>
      <li>We may change how ${esc(c.plural)} work, including starting balances and top-ups, at any time.</li>
    </ul>`,
    },
    {
      id: 'purchases',
      title: ctx.cfg.purchases ? 'Purchases' : 'No purchases',
      body: html`<p>${ctx.cfg.purchases
        ? `You can buy extra ${esc(c.plural)}. Purchases are for entertainment only. Purchased ${esc(c.plural)} have no cash value and can’t be refunded or exchanged, except where the law says otherwise.`
        : `There is nothing to buy on the site. We don’t take payments of any kind, and we will never ask you for card or bank details.`}</p>`,
    },
    {
      id: 'fair-play',
      title: 'Fair play on our games',
      body: html`<p>Results on our own games come from your browser’s cryptographic random number generator. We publish the rules, the pays and the return to player for each one on its page. Results don’t depend on your balance, history or time spent playing.</p>
    ${pp ? `<p>For the Pragmatic Play demos, the figures we show, such as return to player, are the usual defaults taken from Pragmatic Play’s announcements and independent reviews. The version in a demo may differ; its own information screen (the i button) is the one to go by. Pragmatic Play decides how its demos work.</p>` : ''}`,
    },
    {
      id: 'tools',
      title: 'Tools to limit your play',
      body: html`<p>The site shows a session clock, shows a reality check every 15, 30 or 60 minutes, and lets you set a daily time limit, take a 5-minute break or lock the games for 24 hours, 7 days or 30 days. They cover every game on the site. See <a href="/responsible-gaming/">Responsible gaming</a>.</p>`,
    },
    {
      id: 'proper-use',
      title: 'Using the site properly',
      body: html`<p>Please don’t try to disrupt the site, get around the age check or limits, copy the site’s code or content for commercial use without permission, or use the site to break the law.</p>`,
    },
    {
      id: 'our-content',
      title: 'Our content',
      body: html`<p>The site’s design, our own games, the cover artwork and the text belong to us or our licensors.${pp ? ' The Pragmatic Play demos, and everything inside them, belong to Pragmatic Play or its licensors.' : ''} Fonts are used under the SIL Open Font Licence. You may share links to any page.</p>`,
    },
    {
      id: 'availability',
      title: 'Availability and changes',
      body: html`<p>We provide the site free of charge and “as is”. We try to keep it working but can’t promise it will always be available or free of errors. We may change or remove games or pages. If we change these terms, we’ll update the date at the top of this page.</p>`,
    },
    {
      id: 'responsibility',
      title: 'Our responsibility to you',
      body: html`<p>Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that can’t be limited by law. Because the site is free and ${pp ? `neither ${esc(c.plural)} nor demo credits have any value` : `${esc(c.plural)} have no value`}, we aren’t liable for the loss of a balance or for indirect losses.</p>`,
    },
    {
      id: 'complaints',
      title: 'Questions and complaints',
      body: html`<p>Email <a href="mailto:${esc(op.email)}">${esc(op.email)}</a> or use the <a href="/contact/">contact form</a>. We aim to reply within five working days.</p>`,
    },
    {
      id: 'law',
      title: 'Law',
      body: html`<p>These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.</p>`,
    },
  ].filter(Boolean);

  page.body = html`
${pageHero(page, {
  eyebrow: 'Legal',
  title: 'Terms of use',
  lede: 'Please read these before you play. They’re in plain English, and the short version comes first.',
  meta: [updatedPill(ctx)],
  art: { icon: icons.book, tone: 'c' },
})}
${legalBody(sections, {
  numbered: true,
  summary: [
    'You must be 18 or over to play.',
    `Everything is free. There’s no real money and there are no prizes.`,
    `${esc(c.plural)} have no value and can’t be bought, sold or exchanged.`,
    pp ? 'The slot demos come from Pragmatic Play’s servers, and Pragmatic Play may change them or take them down.' : 'Every game on the site is our own and runs in your browser.',
  ],
})}`;
  return page;
}
