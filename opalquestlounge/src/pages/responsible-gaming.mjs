import { html, esc } from '../lib/html.mjs';
import { icons } from '../lib/icons.mjs';
import { pageHero, ext } from './misc.mjs';

// Every data-* hook on this page is bound by assets/js/lib/rg.js:
//   [data-rg="limit"] form + select[name=limit], [data-rg-limit-status], [data-playtime]
//   [data-rg="cooloff"] with [data-days], [data-rg-pause-status]
//   [data-action="break-5"], radios named "rc" (15/30/60)
//   [data-rg-state="limit|limit-pending|reality|break"] pills
//   [data-session], [data-rc-staked], [data-rc-returned] (filled every second)

const HELP = [
  { name: 'National Gambling Helpline', text: 'Free, confidential and open 24 hours a day. Run by GamCare.', link: '<a class="tel-link" href="tel:+448088020133"><span class="num nobr">0808 8020 133</span></a>' },
  { name: 'GamCare', text: 'Advice, live chat, and support for friends and family.', link: ext('https://www.gamcare.org.uk/', 'gamcare.org.uk') },
  { name: 'BeGambleAware', text: 'Information on gambling harms and where to find treatment.', link: ext('https://www.begambleaware.org/', 'begambleaware.org') },
  { name: 'Gamblers Anonymous', text: 'Local and online meetings.', link: ext('https://www.gamblersanonymous.org.uk/', 'gamblersanonymous.org.uk') },
  { name: 'NHS', text: 'Help with gambling, including NHS gambling clinics.', link: ext('https://www.nhs.uk/live-well/addiction-support/gambling-addiction/', 'nhs.uk') },
  { name: 'GAMSTOP', text: 'Free self-exclusion from every online gambling company licensed in Great Britain.', link: ext('https://www.gamstop.co.uk/', 'gamstop.co.uk') },
];

export default function responsibleGaming(ctx) {
  const c = ctx.cur;
  const pp = ctx.pragmaticOn;
  const page = {
    id: 'responsible-gaming',
    path: '/responsible-gaming/',
    title: `Responsible Gaming Tools and Help · ${ctx.brand}`,
    description: 'Daily time limits, breaks and reality checks for every game here, plus free, confidential UK help: National Gambling Helpline 0808 8020 133.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Responsible gaming', path: '/responsible-gaming/' },
    ],
    crumbsInBody: true,
  };

  const tools = [
    { href: '#limits', tone: 'y', icon: icons.timer, title: 'Set a time limit', text: 'Lower it and it applies at once. Raise it and it waits until tomorrow.' },
    { href: '#break', tone: 'm', icon: icons.pause, title: 'Take a break', text: '5 minutes, 24 hours, 7 or 30 days. Longer breaks can’t be cut short.' },
    { href: '#reality-check', tone: 'c', icon: icons.bell, title: 'Reality checks', text: 'A reminder every 15, 30 or 60 minutes, with your time played' },
    { href: '#self-check', tone: 'r', icon: icons.check, title: 'Check in with yourself', text: 'A few minutes, with BeGambleAware or GamCare' },
  ];

  const panelHead = (id, tone, ico, title, state = '') => html`<header class="rg-panel__head">
      <div class="rg-panel__title"><span class="ti ti--${tone}" aria-hidden="true">${ico}</span><h2 id="${id}-title">${title}</h2></div>
      ${state}
    </header>`;

  page.body = html`
${pageHero(page, {
  eyebrow: 'Safer play',
  title: 'Responsible gaming',
  lede: 'Everything here is free and there are no prizes, but the games copy the look and pace of casino games. That can pull people in. Here are the tools we give you, and where to get help.',
  art: { icon: icons.shield, tone: 'c' },
})}

<section class="band band--safe rg-band" aria-labelledby="rg-tools-title">
  <div class="wrap safe">
    <div>
      <h2 id="rg-tools-title" class="display">Your tools</h2>
      <p class="safe__lede">They cover every game here${pp ? ', including the Pragmatic Play demos,' : ''} and take effect straight away on this device.</p>
      <ul class="tools">
        ${tools.map(
          (t) => `<li><a class="tool" href="${t.href}"><span class="ti ti--${t.tone}" aria-hidden="true">${t.icon}</span><span>${t.title}<small>${t.text}</small></span></a></li>`,
        )}
      </ul>
    </div>
    <aside class="helpline" aria-labelledby="help-now-title">
      <h2 id="help-now-title">Need to talk?</h2>
      <p>GamCare’s National Gambling Helpline is free, confidential and open 24 hours a day.</p>
      <a class="tel" href="tel:+448088020133">${icons.phone}<span class="num">0808 8020 133</span></a>
      <p>Or visit ${ext('https://www.begambleaware.org/', 'BeGambleAware.org', { arrow: false })} and ${ext('https://www.gamcare.org.uk/', 'GamCare.org.uk', { arrow: false })} for advice and live chat.</p>
      <p class="clocknote"><span class="status__session"><span class="status__ico" aria-hidden="true">${icons.clockDisc}</span><span class="status__txt"><span class="visually-hidden">Session time:</span><b class="num" data-session>0:00</b><span class="status__unit" aria-hidden="true">Session</span></span></span><span>Your session clock stays in the header the whole time you play.</span></p>
    </aside>
  </div>
</section>

<div class="page-body rg">
  <div class="rg-panels">
    <section class="rg-panel" id="limits" aria-labelledby="limits-title">
      ${panelHead('limits', 'y', icons.timer, 'Daily time limit', '<span class="settings__state" data-rg-state="limit">Off</span>')}
      <p>Choose how long you can play each day. At the limit, every game pauses until midnight${pp ? ' and an open demo closes' : ''}.</p>
      <form class="rg-form" data-rg="limit">
        <label class="field"><span>Limit per day</span>
          <select name="limit" aria-describedby="limits-rule">
            <option value="0">No limit</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="240">4 hours</option>
          </select>
        </label>
        <button type="submit" class="btn btn--secondary">Save limit</button>
      </form>
      <p class="rg-rule" id="limits-rule">A lower limit applies at once; a higher one starts tomorrow.</p>
      <p class="rg-status" data-rg-limit-status aria-live="polite">Today: <span data-playtime>0 minutes</span> on the site.</p>
      <p class="rg-pending" data-rg-state="limit-pending" hidden></p>
      <p class="rg-panel__fine">The limit counts the time this site is open in front of you, on any page, and starts again at midnight.</p>
    </section>

    <section class="rg-panel" id="break" aria-labelledby="break-title">
      ${panelHead('break', 'm', icons.pause, 'Take a break', '<span class="settings__state" data-rg-state="break">None set</span>')}
      <p>A short break pauses every game for five minutes${pp ? ', including any open demo' : ''}. The reality check offers one too.</p>
      <p><button type="button" class="btn btn--primary" data-action="break-5">${icons.pause}<span>Take a 5-minute break</span></button></p>
      <h3 class="rg-panel__sub">Longer breaks</h3>
      <p>Lock the games on this device for a day, a week or a month. You can still read the site, but you can’t play until the time is up. <strong>A longer break can’t be cut short.</strong></p>
      <div class="rg-actions" data-rg="cooloff">
        <button type="button" class="btn btn--secondary" data-days="1"><span><span class="visually-hidden">Pause the games for </span>24 hours</span></button>
        <button type="button" class="btn btn--secondary" data-days="7"><span><span class="visually-hidden">Pause the games for </span>7 days</span></button>
        <button type="button" class="btn btn--secondary" data-days="30"><span><span class="visually-hidden">Pause the games for </span>30 days</span></button>
      </div>
      <p class="rg-status" data-rg-pause-status aria-live="polite"></p>
    </section>

    <section class="rg-panel" id="reality-check" aria-labelledby="reality-check-title">
      ${panelHead('reality-check', 'c', icons.bell, 'Reality checks', '<span class="settings__state" data-rg-state="reality">Every 30 min</span>')}
      <p>A reminder shows how long you’ve been here and${pp ? ', on our own tables,' : ''} what you’ve staked and had back. You can take a five-minute break or carry on.</p>
      <fieldset class="segmented">
        <legend>Remind me every</legend>
        <label><input type="radio" name="rc" value="15"><span>15 min</span></label>
        <label><input type="radio" name="rc" value="30" checked><span>30 min</span></label>
        <label><input type="radio" name="rc" value="60"><span>60 min</span></label>
      </fieldset>
      <dl class="rg-stats">
        <div><dt>Session</dt><dd class="num" data-session>0:00</dd></div>
        <div><dt>Today</dt><dd data-playtime>0 minutes</dd></div>
        <div><dt>Staked</dt><dd><span class="num" data-rc-staked>0</span> <span class="rg-stats__unit">${esc(c.plural)}</span></dd></div>
        <div><dt>Had back</dt><dd><span class="num" data-rc-returned>0</span> <span class="rg-stats__unit">${esc(c.plural)}</span></dd></div>
      </dl>
      ${pp ? '<p class="rg-rule">We can’t see inside the Pragmatic Play demos, so demo credits aren’t counted. Your time is.</p>' : ''}
    </section>

    <section class="rg-panel" id="self-check" aria-labelledby="self-check-title">
      ${panelHead('self-check', 'r', icons.check, 'Check in with yourself')}
      <p>A self-assessment asks a few honest questions about how gambling has affected you over the last 12 months: your time, your money and how you feel. Many UK services use a nine-question check called the Problem Gambling Severity Index.</p>
      <p>It takes a few minutes, and nobody else needs to see your answers. BeGambleAware and GamCare both have one on their websites, alongside advice and live chat.</p>
      <p class="rg-actions">
        ${ext('https://www.begambleaware.org/', '<span>BeGambleAware</span>').replace('<a ', '<a class="btn btn--secondary" ')}
        ${ext('https://www.gamcare.org.uk/', '<span>GamCare</span>').replace('<a ', '<a class="btn btn--secondary" ')}
      </p>
    </section>
  </div>

  <div class="note-strip">
    <p class="sticker">Worth knowing</p>
    <p>Doing well in a free game doesn’t mean you’d do well gambling with real money.</p>
  </div>

  <div class="split rg-more">
    <div class="split__main prose">
      <section aria-labelledby="signs-title">
        <h2 id="signs-title">Signs it might be time to stop</h2>
        <ul>
          <li>You play for longer than you meant to, often.</li>
          <li>You feel restless or irritable when you can’t play.</li>
          <li>You play to escape worries, or to change your mood.</li>
          <li>You’re thinking about gambling for real money to get the same feeling.</li>
          <li>People close to you have mentioned how much you play.</li>
        </ul>
        <p>Research has linked social casino games with later gambling for some people. If any of this sounds familiar, take a break and talk to someone.</p>
      </section>
      ${pp
        ? html`<section aria-labelledby="demos-title">
        <h2 id="demos-title">The slot demos</h2>
        <p>Your limits and breaks cover the Pragmatic Play demos. When a break starts or you reach your daily limit, an open demo closes and can’t be reopened until the time is up. Reality checks appear over a demo too.</p>
        <p>Demo credits are not ${esc(c.plural)} and have no value, however many you have.</p>
      </section>`
        : ''}
      <section aria-labelledby="minors-title">
        <h2 id="minors-title">Keeping under-18s out</h2>
        <p>We ask everyone’s age on their first visit. If someone says they’re under 18, the games lock on that device for 30 days. Our artwork shows objects and places only: no characters, mascots or cartoon animals.</p>
        <p>The age question isn’t an identity check. If you share a device with children, use its parental controls, or blocking software such as ${ext('https://betblocker.org/', 'BetBlocker')}, which is free.</p>
      </section>
      <section aria-labelledby="cover-title">
        <h2 id="cover-title">What these tools cover</h2>
        <p>They work on this site, in this browser, on this device.${pp ? ' They don’t apply to games you open on other websites, including Pragmatic Play’s own.' : ''} If you also gamble for money, <strong>GAMSTOP</strong> lets you exclude yourself from every online gambling company licensed in Great Britain, for free: ${ext('https://www.gamstop.co.uk/', 'gamstop.co.uk')}.</p>
      </section>
      <section aria-labelledby="reset-title">
        <h2 id="reset-title">Start again</h2>
        <p>You can reset your balance to ${ctx.carats(c.startingBalance)} at any time from <button type="button" class="linkish" data-open="settings" aria-haspopup="dialog">Settings</button>.</p>
      </section>
    </div>
    <aside class="split__side side-card" aria-labelledby="help-title">
      <h2 id="help-title" class="side-card__head">Free, confidential help in the UK</h2>
      <dl class="helplist side-card__body">
        ${HELP.map((h) => `<div><dt>${h.name}</dt><dd>${h.text} ${h.link}</dd></div>`)}
      </dl>
    </aside>
  </div>
</div>`;
  return page;
}
