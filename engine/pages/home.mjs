// Home (spec section 8): hero with the featured demo, the tape, the lobby,
// How it works, Safer play, questions. When the Pragmatic Play demos are
// switched off (site.config.json "pragmatic.enabled": false) the hero shows
// our own slot instead and the copy speaks about our three games.
import { html, esc, num } from '../lib/html.mjs';
import { organizationLd, websiteLd } from '../lib/layout.mjs';
import { pragmaticStage, slotPanel, lobby } from '../lib/games-ui.mjs';
import { icons, icon } from '../lib/icons.mjs';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const words = (n) => WORDS[n] || num(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The fact strip under the featured demo: grid, mechanics, how it pays, volatility. */
function demoFacts(g) {
  const facts = [/^\d+×\d+$/.test(g.grid) ? `${g.grid} grid` : g.grid.replace(/,.*$/, '')];
  if (g.tags.includes('megaways')) facts.push('Megaways');
  if (g.tags.includes('tumble')) facts.push('Tumble');
  const ways = /up to ([\d,]+) ways/i.exec(g.pays);
  const lines = /(\d+) (?:fixed )?paylines/i.exec(g.pays);
  if (/anywhere/i.test(g.pays)) facts.push('Pays anywhere');
  else if (/^clusters/i.test(g.pays)) facts.push('Cluster pays');
  else if (ways) facts.push(`${ways[1]} ways`);
  else if (lines) facts.push(`${lines[1]} paylines`);
  if (/^(low|medium|high|very high)$/i.test(g.volatility || '')) facts.push(`${cap(g.volatility.toLowerCase())} volatility`);
  return facts.slice(0, 4);
}

const factStrip = (facts, link) =>
  html`<p class="stage__facts">${facts.map((f) => `<span class="fact">${f}</span>`)}<a class="fact fact--link" href="${link.href}">${link.text} ${icons.arrow}</a></p>`;

export default function home(ctx) {
  const c = ctx.cur;
  const pp = ctx.pragmaticOn;
  const slots = ctx.games.filter((g) => !g.table);
  const tables = ctx.games.filter((g) => g.table);
  // The lobby: the first eight slots, then our tables.
  const shown = [...slots.slice(0, 8), ...tables];
  const shownSlots = shown.length - tables.length;
  const f = ctx.featured;
  const house = ctx.game('seven-systems');
  const noBuy = ctx.cfg.purchases ? 'No purchases needed' : 'Nothing to buy';

  const hero = pp
    ? {
        kicker: 'Pragmatic Play demos and our own tables',
        h1: 'Slot demos in full colour.',
        stage: html`${pragmaticStage(ctx, f, { featured: true })}
        ${factStrip(demoFacts(f), { href: f.path, text: 'Rules and features' })}`,
        lede: `Try free Pragmatic Play slot demos, then take a seat at our own roulette and blackjack tables with free ${esc(c.plural)}. Nothing here pays out, so there's nothing to chase.`,
      }
    : {
        kicker: 'Our own slot, roulette and blackjack',
        h1: 'Slots and tables in full colour.',
        stage: html`${slotPanel(ctx, { variant: 'hero', headingId: 'hero-game' })}
        ${factStrip(
          [...house.tileFacts, `RTP ${house.rtpLabel}`],
          { href: house.path, text: 'Rules and paytable' },
        )}`,
        lede: `Spin Seven Systems, our own three-reel slot, then take a seat at our roulette and blackjack tables. You play with free ${esc(c.plural)}. Nothing here pays out, so there's nothing to chase.`,
      };

  const lobbyIntro = pp
    ? shownSlots < slots.length
      ? `${cap(words(shownSlots))} of the ${words(slots.length)} Pragmatic Play slot demos, and our ${words(tables.length)} tables. Every game is free, and each one has its rules and RTP on its own page.`
      : `${cap(words(shownSlots))} Pragmatic Play slot demos and ${words(tables.length)} tables of our own. Every game is free, and each one has its rules and RTP on its own page.`
    : `Our own slot and ${words(tables.length)} tables. Every game is free, and each one has its rules and RTP on its own page.`;
  const more =
    shown.length < ctx.games.length
      ? `See all ${ctx.games.length} games`
      : `Compare all ${words(ctx.games.length)} games`;

  const steps = pp
    ? [
        ['Press play on a demo', `Slot demos stay switched off until you press Play. Then they load from Pragmatic Play's servers and play with demo credits, which have no value.`],
        [`Take a seat with ${esc(c.plural)}`, `Our roulette and blackjack tables use ${esc(c.plural)}, a free virtual currency. You start with ${num(c.startingBalance)}. Drop below ${num(c.topUpBelow)} and you can claim another ${num(c.topUpAmount)} at any time.`],
        ['Nothing pays out', ctx.cfg.purchases
          ? `You can buy extra ${esc(c.plural)} if you choose, but ${esc(c.plural)} and demo credits can't be sold, paid out or swapped for prizes. Nothing on this site has a cash value.`
          : `${esc(c.plural)} and demo credits can't be bought, sold, paid out or swapped for prizes. There is no real money anywhere on this site.`],
      ]
    : [
        ['Pick a game', `Spin Seven Systems, bet on Lapidary Wheel or play a hand of <span class="nobr">Brilliant Twenty-One</span>. All three run in your browser.`],
        [`Play with ${esc(c.plural)}`, `Every game uses ${esc(c.plural)}, a free virtual currency. You start with ${num(c.startingBalance)}. Drop below ${num(c.topUpBelow)} and you can claim another ${num(c.topUpAmount)} at any time.`],
        ['Nothing pays out', ctx.cfg.purchases
          ? `You can buy extra ${esc(c.plural)} if you choose, but they can't be sold, paid out or swapped for prizes. Nothing on this site has a cash value.`
          : `${esc(c.plural)} can't be bought, sold, paid out or swapped for prizes. There is no real money anywhere on this site.`],
      ];

  const tools = [
    ['limits', 'tool--y', icons.timer, 'Set a time limit', 'Lower it and it applies at once. Raise it and it waits until tomorrow.'],
    ['break', 'tool--m', icons.pause, 'Take a break', "24 hours, 7 or 30 days. It can't be cut short."],
    ['reality-check', 'tool--c', icons.bell, 'Reality checks', 'A reminder every 15, 30 or 60 minutes, with your time played'],
    ['self-check', 'tool--r', icons.check, 'Check in with yourself', 'A few minutes, with GamCare’s self-assessment'],
  ];

  const faq = [
    ['Is any real money involved?', `No. You can't pay in or bet real money here, nothing pays out, and nothing you play for has real-world value. Your ${esc(c.plural)} balance is kept only in your browser.`],
    pp
      ? ['Why do the slots load from another website?', `The slots are made by Pragmatic Play, who host the demos. So that your browser doesn't contact their servers without asking, a demo only loads after you press its Play button. Pragmatic Play's own privacy policy applies inside the demo, and our <a href="/cookies/">cookies page</a> says what it may store.`]
      : ['How are results decided?', `By your browser's own cryptographic random number generator. Each result is fixed before the reels, wheel or cards start to move, and nothing changes with your balance, your history or how long you've played.`],
    ['Why is it for adults only?', `Games that look like gambling are for adults, even when they're free. ${esc(ctx.brand)} is for people aged 18 and over in the United Kingdom. We ask your age on your first visit, and we never aim our games or adverts at anyone under 18.`],
  ];

  return {
    id: 'home',
    path: '/',
    title: pp ? `Free Slot Demos and Table Games · ${ctx.brand}` : `Free Slot, Roulette and Blackjack · ${ctx.brand}`,
    description: pp
      ? `Free-to-play social casino for UK adults: Pragmatic Play slot demos and our own roulette and blackjack with free ${c.plural}. No real money, no prizes.`
      : `Free-to-play social casino for UK adults: our own slot, roulette and blackjack, played with free ${c.plural}. No real money, no prizes${ctx.cfg.purchases ? '' : ', nothing to buy'}.`,
    jsonld: [
      organizationLd(ctx),
      websiteLd(ctx),
      {
        '@type': 'ItemList',
        name: 'The lobby',
        numberOfItems: shown.length,
        itemListElement: shown.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: g.url, name: g.name })),
      },
    ],
    modules: pp
      ? ['/assets/js/games/pragmatic.js']
      : ['/assets/js/games/seven-systems.js', '/assets/js/games/seven-systems.math.js', '/assets/js/lib/crystals.js'],
    // Loaded on demand by app.js, but part of what the home page needs.
    budgetModules: ['/assets/js/lib/lobby.js'],
    bodyClass: 'is-home',
    body: html`
<section class="hero${pp ? '' : ' hero--house'}" aria-labelledby="hero-h">
  <div class="wrap hero__grid">
    <div class="hero__head">
      <p class="kicker"><span class="sticker">Free to play</span> <span class="kicker__text">${hero.kicker}</span></p>
      <h1 id="hero-h" class="display">${hero.h1} <span class="hl">Played for fun.</span></h1>
    </div>
    <div class="hero__stage">
      <div class="hero__burst burst" aria-hidden="true"><svg focusable="false"><use href="#burst-b"/></svg></div>
      ${hero.stage}
    </div>
    <div class="hero__body">
      <p class="lede">${hero.lede}</p>
      <ul class="ticks">
        <li>${icons.tick}No sign-up</li>
        <li>${icons.tick}${noBuy}</li>
        <li>${icons.tick}Regular break reminders</li>
      </ul>
      <div class="hero__ctas">
        <a class="btn btn--primary" href="#lobby">Browse the lobby ${icons.arrow}</a>
        <a class="btn btn--secondary" href="#how">How it works</a>
      </div>
    </div>
  </div>
</section>

<div class="tape" role="note" aria-label="The short version">
  <ul class="wrap"><li>Free to play</li><li>No cash prizes</li><li>Adults 18+ only</li><li>Play money only</li><li>Take breaks</li></ul>
</div>

<section class="lobby" id="lobby" aria-labelledby="lobby-h">
  <div class="wrap">
    <div class="sechead">
      <h2 id="lobby-h" class="display">The lobby</h2>
      <p>${lobbyIntro}</p>
    </div>
    ${lobby(ctx, { games: shown, id: 'lobby', headingLevel: 3 })}
    <p class="lobby__more"><a class="btn btn--secondary" href="/games/">${more} ${icons.arrow}</a></p>
  </div>
</section>

<section class="band band--how" id="how" aria-labelledby="how-h">
  <div class="wrap">
    <div class="sechead">
      <h2 id="how-h" class="display">How it works</h2>
      <p>Free to play, with no cash prizes. Here is the whole deal in three panels.</p>
    </div>
    <ol class="steps">
      ${steps.map(
        ([h, p], i) => html`<li class="step">
        <span class="step__num burst" aria-hidden="true"><svg focusable="false"><use href="#burst-c"/></svg><b>${i + 1}</b></span>
        <h3>${h}</h3>
        <p>${p}</p>
      </li>`,
      )}
    </ol>
    <div class="how__note"><span class="sticker">Worth knowing</span><p>Doing well in a free game doesn't mean you'd do well gambling with real money.</p></div>
  </div>
</section>

<section class="band band--safe" id="safer" aria-labelledby="safe-h">
  <div class="wrap safe">
    <div>
      <h2 id="safe-h" class="display">Safer play, built in</h2>
      <p class="safe__lede">Games should be a break, not a habit. These tools work on every game${pp ? ', including the Pragmatic Play demos' : ' on the site'}.</p>
      <ul class="tools">
        ${tools.map(
          ([anchor, cls, ico, title, note]) =>
            `<li><a class="tool ${cls}" href="/responsible-gaming/#${anchor}"><span class="ti" aria-hidden="true">${ico}</span><span>${title}<small>${note}</small></span></a></li>`,
        )}
      </ul>
    </div>
    <div class="helpline" role="group" aria-labelledby="help-h">
      <h3 id="help-h">Need to talk?</h3>
      <p>GamCare's National Gambling Helpline is free, confidential and open 24 hours a day.</p>
      <a class="tel" href="tel:+448088020133">${icons.phone}<span class="num">0808 8020 133</span></a>
      <p>Or visit <a href="https://www.gamcare.org.uk/">GamCare.org.uk</a> for advice and live chat, or <a href="https://www.nhs.uk/live-well/addiction-support/gambling-addiction/">the NHS</a> for treatment near you.</p>
      <p class="clocknote"><span class="status__session"><span class="status__ico" aria-hidden="true">${icons.clockDisc}</span><span class="status__txt"><span class="visually-hidden">Session time:</span><b class="num" data-session>0:00</b><span class="status__unit" aria-hidden="true">Session</span></span></span><span>Your session clock stays in the header the whole time you play.</span></p>
    </div>
  </div>
</section>

<section class="faq" aria-labelledby="faq-h">
  <div class="wrap faq__grid">
    <div>
      <h2 id="faq-h" class="display">Straight answers</h2>
      <p class="faq__intro">More on the <a href="/about/">About</a> page, or <a href="/contact/">get in touch</a>.</p>
    </div>
    <div>
      ${faq.map(
        ([q, a], i) => html`<details class="qa"${i === 0 ? ' open' : ''}>
        <summary><span class="q" aria-hidden="true">?</span>${q}${icon('i-chev', 'chev')}</summary>
        <div class="a"><p>${a}</p></div>
      </details>`,
      )}
    </div>
  </div>
</section>`,
  };
}
