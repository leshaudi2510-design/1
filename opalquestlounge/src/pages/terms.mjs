import { html, esc, num } from '../lib/html.mjs';

export default function terms(ctx) {
  const c = ctx.cur;
  const { op } = ctx;
  return {
    id: 'terms',
    path: '/terms/',
    title: `Terms of Use · ${ctx.brand}`,
    description: `The terms for using ${ctx.brand}: adults 18+ only, free games played with virtual ${c.plural}, no real money, no prizes${ctx.cfg.purchases ? '' : ' and no purchases'}.`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Terms of use', path: '/terms/' },
    ],
    bodyClass: 'is-legal',
    body: html`
<header class="page-head">
  <p class="eyebrow">Legal</p>
  <h1 class="page-title">Terms of use</h1>
  <p class="lede">Last updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time>. Please read these before you play.</p>
  <p class="label"><strong>${esc(ctx.disclaimer)}</strong></p>
</header>
<div class="prose prose--legal">
  <section aria-labelledby="t1"><h2 id="t1"><span class="num">1.</span> Who we are</h2>
    <p>${esc(ctx.brand)} (the "site") is run by ${esc(op.companyName)}, company number ${esc(op.companyNumber)}, registered in ${esc(op.registeredIn)}, with its registered office at ${esc(op.address)} ("we", "us"). You can contact us at <a href="mailto:${esc(op.email)}">${esc(op.email)}</a>.</p>
    <p>By using the site you agree to these terms. If you don't agree, please don't use it.</p>
  </section>
  <section aria-labelledby="t2"><h2 id="t2"><span class="num">2.</span> Who can play</h2>
    <p>You must be 18 or over. We ask your age on your first visit. If you tell us you're under 18, the games are locked on that device for 30 days. If we have reason to believe a user is under 18, we may block access.</p>
    <p>The site is intended for people in the United Kingdom.</p>
  </section>
  <section aria-labelledby="t3"><h2 id="t3"><span class="num">3.</span> What the games are</h2>
    <p>${esc(ctx.disclaimer)}</p>
    <p>The games (Seven Systems, Lapidary Wheel and Brilliant Twenty-One) are for entertainment. They use a virtual currency called ${esc(c.plural)}. Success in these games doesn't mean you would succeed at gambling for real money.</p>
  </section>
  <section aria-labelledby="t4"><h2 id="t4"><span class="num">4.</span> ${esc(c.plural)}</h2>
    <ul>
      <li>${esc(c.plural)} are a virtual game currency with no monetary value. They are not money, e-money, a voucher, a cryptoasset or property of any kind.</li>
      <li>${esc(c.plural)} can't be bought${ctx.cfg.purchases ? ' except through the optional purchases described on the site' : ''}, sold, transferred, redeemed, exchanged for money, goods or services, or used anywhere else.</li>
      <li>There are no prizes, competitions or prize draws on the site.</li>
      <li>You start with ${ctx.carats(c.startingBalance)}. When your balance is under ${num(c.topUpBelow)}, you can claim ${ctx.carats(c.topUpAmount)} free.</li>
      <li>Your balance is stored in your browser. If you clear your browser's data, change browser or change device, the balance starts again. We can't restore it.</li>
      <li>We may change how ${esc(c.plural)} work, including starting balances and top-ups, at any time.</li>
    </ul>
  </section>
  <section aria-labelledby="t5"><h2 id="t5"><span class="num">5.</span> ${ctx.cfg.purchases ? 'Purchases' : 'No purchases'}</h2>
    <p>${ctx.cfg.purchases
      ? `You can buy extra ${esc(c.plural)}. Purchases are for entertainment only. Purchased ${esc(c.plural)} have no cash value and can't be refunded or exchanged, except where the law says otherwise.`
      : `There is nothing to buy on the site. We don't take payments of any kind, and we will never ask you for card or bank details.`}</p>
  </section>
  <section aria-labelledby="t6"><h2 id="t6"><span class="num">6.</span> Fair play</h2>
    <p>Each game's results come from your browser's cryptographic random number generator. We publish the rules, paytable and return to player for each game on its page. Results don't depend on your balance, history or time spent playing.</p>
  </section>
  <section aria-labelledby="t7"><h2 id="t7"><span class="num">7.</span> Tools to limit your play</h2>
    <p>The site shows a session clock, reminds you to take a break every 30 minutes, and lets you set a daily time limit or lock the games for 24 hours, 7 days or 30 days. See <a href="/responsible-gaming/">Responsible gaming</a>.</p>
  </section>
  <section aria-labelledby="t8"><h2 id="t8"><span class="num">8.</span> Using the site properly</h2>
    <p>Please don't try to disrupt the site, get around the age check or limits, copy the site's code or content for commercial use without permission, or use the site to break the law.</p>
  </section>
  <section aria-labelledby="t9"><h2 id="t9"><span class="num">9.</span> Our content</h2>
    <p>The site's design, games, drawings and text belong to us or our licensors. Fonts are used under the SIL Open Font Licence. You may share links to any page.</p>
  </section>
  <section aria-labelledby="t10"><h2 id="t10"><span class="num">10.</span> Availability and changes</h2>
    <p>We provide the site free of charge and "as is". We try to keep it working but can't promise it will always be available or free of errors. We may change or remove games or pages. If we change these terms, we'll update the date at the top of this page.</p>
  </section>
  <section aria-labelledby="t11"><h2 id="t11"><span class="num">11.</span> Our responsibility to you</h2>
    <p>Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that can't be limited by law. Because the site is free and ${esc(c.plural)} have no value, we aren't liable for the loss of a ${esc(c.plural)} balance or for indirect losses.</p>
  </section>
  <section aria-labelledby="t12"><h2 id="t12"><span class="num">12.</span> Questions and complaints</h2>
    <p>Email <a href="mailto:${esc(op.email)}">${esc(op.email)}</a> or use the <a href="/contact/">contact form</a>. We aim to reply within five working days.</p>
  </section>
  <section aria-labelledby="t13"><h2 id="t13"><span class="num">13.</span> Law</h2>
    <p>These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your local courts.</p>
  </section>
</div>`,
  };
}
