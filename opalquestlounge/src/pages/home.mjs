import { html, esc, num } from '../lib/html.mjs';
import { organizationLd, websiteLd } from '../lib/layout.mjs';
import { slotPanel, gameList } from '../lib/games-ui.mjs';
import { icons } from '../lib/icons.mjs';

export default function home(ctx) {
  const c = ctx.cur;
  const slot = ctx.game('seven-systems');
  return {
    id: 'home',
    path: '/',
    title: `Free Social Casino Games · ${ctx.brand}`,
    description: `Free slots, European roulette and blackjack played with virtual ${c.plural}. No real money, no prizes and no purchases. For adults 18+ in the UK.`,
    jsonld: [
      organizationLd(ctx),
      websiteLd(ctx),
      {
        '@type': 'ItemList',
        name: 'Games',
        itemListElement: ctx.games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: g.url, name: g.name })),
      },
    ],
    // The hero headline is set in Bodoni roman and italic: those two fonts carry the largest paint.
    preloadFonts: ['bodoni-moda', 'bodoni-moda-italic'],
    budgetModules: ['/assets/js/games/seven-systems.js'],
    bodyClass: 'is-home',
    body: html`
<section class="hero" aria-labelledby="hero-title">
  <header class="hero__head">
    <p class="eyebrow"><span class="num">No. 000</span> · The lounge · Free to play</p>
    <h1 id="hero-title" class="hero__title">Play for ${esc(c.plural)}, <em>never for cash.</em></h1>
  </header>
  <p class="label hero__disclaimer">${esc(ctx.disclaimer)}</p>
  <div class="hero__game">
    ${slotPanel(ctx, { variant: 'hero', headingId: 'hero-game' })}
    <p class="hero__more"><a href="${slot.path}">Seven Systems: rules, paytable and RTP ${icons.arrow}</a></p>
  </div>
  <div class="hero__text">
    <p class="hero__lede">${esc(ctx.brand)} is a free games room laid out like a Victorian mineral cabinet. Spin a slot of crystal drawings, bet on a single-zero wheel or play twenty-one. You play with virtual ${esc(c.plural)}, and they never leave your device.</p>
    <ul class="hero__links">
      <li><a href="#carats">${icons.arrowDown}How ${esc(c.plural)} work</a></li>
      <li><a href="/responsible-gaming/">${icons.pause}Limits and breaks</a></li>
    </ul>
  </div>
  <figure class="specimen hero__specimen">
    <canvas data-opal="specimen" width="480" height="360" aria-hidden="true"></canvas>
    <figcaption class="specimen__label">
      <span class="num">Specimen No. 001</span>
      <span>Precious opal. Play-of-colour: harlequin.</span>
      <span class="specimen__hint">Move, tilt or scroll to turn it in the light. It flashes when a game pays back more than you staked.</span>
    </figcaption>
  </figure>
</section>

<section class="section cabinet" aria-labelledby="cabinet-title">
  <header class="section__head">
    <p class="eyebrow">Three drawers</p>
    <h2 id="cabinet-title">The cabinet</h2>
    <p>Each game has its own page with the full rules, the paytable, how we work out its return to player and a little history.</p>
  </header>
  ${gameList(ctx)}
</section>

<section class="section carats" id="carats" aria-labelledby="carats-title">
  <header class="section__head">
    <p class="eyebrow">The currency</p>
    <h2 id="carats-title">How ${esc(c.plural)} work</h2>
    <p>A carat is a jeweller's weight: one fifth of a gram. Here it's only a way of keeping score.</p>
  </header>
  <dl class="facts-list">
    <div>
      <dt><span class="num">${num(c.startingBalance)}</span> to start</dt>
      <dd>Your first visit gives you ${ctx.carats(c.startingBalance)}. They're kept in this browser, on this device. There's no account to make.</dd>
    </div>
    <div>
      <dt>Free top-ups</dt>
      <dd>If your balance drops below ${num(c.topUpBelow)}, press <strong>Claim ${ctx.carats(c.topUpAmount)}</strong>. It costs nothing and there's no wait.</dd>
    </div>
    <div>
      <dt>No value outside the lounge</dt>
      <dd>${esc(c.plural)} can't be bought, sold, cashed in, transferred or swapped for prizes. They only measure play.</dd>
    </div>
    <div>
      <dt>${ctx.cfg.purchases ? 'Optional purchases' : 'Nothing to buy'}</dt>
      <dd>${ctx.cfg.purchases
        ? `You can buy extra ${esc(c.plural)} if you choose. They still have no cash value.`
        : `There are no in-game purchases, adverts in the games or paid extras. Every game is free.`}</dd>
    </div>
  </dl>
</section>

<section class="section limits" aria-labelledby="limits-title">
  <header class="section__head">
    <p class="eyebrow">Responsible gaming</p>
    <h2 id="limits-title">Play within limits</h2>
    <p>Free games can still take up more time than you meant. These tools are built into every page.</p>
  </header>
  <ol class="tools">
    <li><h3>${icons.clock}Session clock</h3><p>The time you've spent this session is always in the top bar.</p></li>
    <li><h3>${icons.pause}A break every 30 minutes</h3><p>Every half hour you'll see how long you've played and what you staked. Take five minutes or carry on.</p></li>
    <li><h3>${icons.sliders}Daily time limit</h3><p>Set a limit in Settings. When you reach it, the games pause until midnight.</p></li>
    <li><h3>${icons.lounge}Longer breaks</h3><p>Lock the games on this device for a day, a week or a month from the <a href="/responsible-gaming/">responsible gaming page</a>.</p></li>
  </ol>
  <p class="helpline">If gambling of any kind is a worry for you or someone close to you, call the <strong>National Gambling Helpline</strong> on <a class="tel" href="tel:+448088020133">0808 8020 133</a>. It's run by GamCare, free and open 24 hours a day.</p>
</section>

<section class="section faq" aria-labelledby="faq-title">
  <header class="section__head">
    <p class="eyebrow">Questions</p>
    <h2 id="faq-title">Questions people ask</h2>
  </header>
  <div class="faq__list">
    <details name="faq"><summary>Is this gambling?</summary>
      <p>No. You can't pay to play and you can't win money or anything worth money. ${esc(c.plural)} are free and have no value outside this site. The games copy casino formats, which is why we keep them for adults.</p></details>
    <details name="faq"><summary>Can I buy ${esc(c.plural)}?</summary>
      <p>${ctx.cfg.purchases ? `Yes, if you want to, but you never need to. Purchased ${esc(c.plural)} have no cash value.` : `No. There's nothing to buy anywhere on the site. If you run low, you can claim a free top-up of ${ctx.carats(c.topUpAmount)}.`}</p></details>
    <details name="faq"><summary>Why do I have to be 18 or over?</summary>
      <p>Slots, roulette and blackjack are gambling formats, even when nothing is at stake. UK advertising rules expect games like these to be aimed at adults, and we agree. We ask your age on your first visit.</p></details>
    <details name="faq"><summary>How are results decided?</summary>
      <p>By your browser's cryptographic random number generator, <code>crypto.getRandomValues</code>. The result is fixed before any animation starts; the reels, wheel and cards only show it. Nothing changes with your balance, your history or how long you've played.</p></details>
    <details name="faq"><summary>What does RTP mean if nothing is paid out?</summary>
      <p>Return to player is the share of staked ${esc(c.plural)} that comes back over a very long run. Seven Systems returns ${ctx.game('seven-systems').rtpLabel}, Lapidary Wheel ${ctx.game('lapidary-wheel').rtpLabel} and Brilliant Twenty-One ${ctx.game('brilliant-twenty-one').rtpLabel} with basic strategy. Each game page shows how the figure is worked out.</p></details>
    <details name="faq"><summary>Is my balance saved?</summary>
      <p>Yes, in this browser's local storage. It isn't sent to us and doesn't follow you to other devices. Clearing your browser's site data resets it to ${num(c.startingBalance)}.</p></details>
    <details name="faq"><summary>Can I play offline or install the site?</summary>
      <p>Yes. After your first visit the games work without a connection. On a phone, use your browser's <em>Add to Home Screen</em> or <em>Install</em> option.</p></details>
    <details name="faq"><summary>Who runs ${esc(ctx.brand)}?</summary>
      <p>${esc(ctx.op.companyName)}, a company registered in ${esc(ctx.op.registeredIn)}. The <a href="/about/">about page</a> has the full details.</p></details>
  </div>
</section>`,
  };
}
