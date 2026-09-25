import { html, esc, num } from '../lib/html.mjs';
import { icons } from '../lib/icons.mjs';

const ext = (href, text) =>
  `<a href="${href}" rel="noopener" target="_blank">${text}<span class="visually-hidden"> (opens in a new tab)</span>${icons.external}</a>`;

export default function responsibleGaming(ctx) {
  const c = ctx.cur;
  return {
    id: 'responsible-gaming',
    path: '/responsible-gaming/',
    title: `Responsible Gaming Tools and Help · ${ctx.brand}`,
    description: 'Session clock, 30-minute break reminders, daily limits and longer breaks. Plus free, confidential UK help: National Gambling Helpline 0808 8020 133.',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Responsible gaming', path: '/responsible-gaming/' },
    ],
    body: html`
<header class="page-head">
  <p class="eyebrow">Keep it a pastime</p>
  <h1 class="page-title">Responsible gaming</h1>
  <p class="lede">These games are free and nothing can be won, but they copy the look and pace of casino games. That can pull people in. Here's what we do about it, and where to get help.</p>
</header>

<section class="helpline-card" aria-labelledby="help-now">
  <h2 id="help-now">Talk to someone now</h2>
  <p class="helpline-card__number"><a class="tel" href="tel:+448088020133">${icons.phone}<span class="num">0808 8020 133</span></a></p>
  <p>The <strong>National Gambling Helpline</strong>, run by GamCare. Free, confidential and open 24 hours a day, every day. You can also chat online at ${ext('https://www.gamcare.org.uk/', 'gamcare.org.uk')}.</p>
</section>

<section class="section rg-tools" aria-labelledby="tools-title">
  <header class="section__head">
    <h2 id="tools-title">Your tools on this site</h2>
    <p>Everything here works on this device and takes effect straight away.</p>
  </header>
  <div class="rg-grid">
    <section class="rg-card" aria-labelledby="t-clock">
      <h3 id="t-clock">${icons.clock}Session clock</h3>
      <p>This session: <strong class="num" data-session>0:00</strong>. Staked <span class="num" data-rc-staked>0</span>, back <span class="num" data-rc-returned>0</span> ${esc(c.plural)}.</p>
      <p>The clock is always in the top bar. It resets when you close the browser tab.</p>
    </section>
    <section class="rg-card" aria-labelledby="t-remind">
      <h3 id="t-remind">${icons.pause}Break reminders</h3>
      <p>Every 30 minutes, a reminder shows how long you've played, what you've staked and what came back. You can take a five-minute break, which pauses the games, or carry on.</p>
    </section>
    <section class="rg-card" aria-labelledby="t-limit">
      <h3 id="t-limit">${icons.sliders}Daily time limit</h3>
      <form class="rg-form" data-rg="limit">
        <label class="field"><span>Limit per day</span>
          <select name="limit">
            <option value="0">No limit</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="240">4 hours</option>
          </select>
        </label>
        <button type="submit" class="btn btn--secondary">Save limit</button>
      </form>
      <p class="rg-status" data-rg-limit-status aria-live="polite">Today: <span class="num" data-playtime>0 minutes</span> played.</p>
      <p>Lower a limit and it applies at once. Raise it, or remove it, and the change starts tomorrow.</p>
    </section>
    <section class="rg-card" aria-labelledby="t-break">
      <h3 id="t-break">${icons.lounge}Take a longer break</h3>
      <p>Lock the games on this device. You can still read the site, but you can't play until the time is up. <strong>You can't undo this early.</strong></p>
      <div class="rg-actions" data-rg="cooloff">
        <button type="button" class="btn btn--secondary" data-days="1">Pause for 24 hours</button>
        <button type="button" class="btn btn--secondary" data-days="7">Pause for 7 days</button>
        <button type="button" class="btn btn--secondary" data-days="30">Pause for 30 days</button>
      </div>
      <p class="rg-status" data-rg-pause-status aria-live="polite"></p>
    </section>
  </div>
  <p class="rg-note">These tools only cover this site on this browser. If you also gamble for money, <strong>GAMSTOP</strong> lets you exclude yourself from every online gambling company licensed in Great Britain, for free: ${ext('https://www.gamstop.co.uk/', 'gamstop.co.uk')}.</p>
</section>

<div class="prose-grid prose-grid--plain">
  <div class="prose">
    <section aria-labelledby="signs-title">
      <h2 id="signs-title">Signs it might be time to stop</h2>
      <ul>
        <li>You play for longer than you meant to, often.</li>
        <li>You feel restless or irritable when you can't play.</li>
        <li>You play to escape worries, or to change your mood.</li>
        <li>You're thinking about gambling for real money to get the same feeling.</li>
        <li>People close to you have mentioned how much you play.</li>
      </ul>
      <p>Research has linked social casino games with later gambling for some people. If any of this sounds familiar, take a break and talk to someone.</p>
    </section>
    <section aria-labelledby="help-title">
      <h2 id="help-title">Free, confidential help in the UK</h2>
      <dl class="helplist">
        <div><dt>National Gambling Helpline</dt><dd><a class="tel" href="tel:+448088020133">0808 8020 133</a>, 24 hours. Run by GamCare.</dd></div>
        <div><dt>GamCare</dt><dd>Advice, online chat, and support for friends and family. ${ext('https://www.gamcare.org.uk/', 'gamcare.org.uk')}</dd></div>
        <div><dt>BeGambleAware</dt><dd>Information on gambling harms and where to find treatment. ${ext('https://www.begambleaware.org/', 'begambleaware.org')}</dd></div>
        <div><dt>Gamblers Anonymous</dt><dd>Local and online meetings. ${ext('https://www.gamblersanonymous.org.uk/', 'gamblersanonymous.org.uk')}</dd></div>
        <div><dt>NHS</dt><dd>Help with gambling, including NHS gambling clinics. ${ext('https://www.nhs.uk/live-well/addiction-support/gambling-addiction/', 'nhs.uk')}</dd></div>
        <div><dt>GAMSTOP</dt><dd>Self-exclusion from licensed online gambling in Great Britain. ${ext('https://www.gamstop.co.uk/', 'gamstop.co.uk')}</dd></div>
      </dl>
    </section>
    <section aria-labelledby="minors-title">
      <h2 id="minors-title">Keeping under-18s out</h2>
      <p>We ask everyone's age on their first visit. If someone says they're under 18, the games lock on that device for 30 days. Our design stays away from cartoon characters, toys and anything else aimed at children.</p>
      <p>If you share a device with children, use your phone's or computer's parental controls, or blocking software such as ${ext('https://betblocker.org/', 'BetBlocker')}, which is free.</p>
    </section>
    <section aria-labelledby="reset-title">
      <h2 id="reset-title">Start again</h2>
      <p>You can reset your balance to ${ctx.carats(c.startingBalance)} at any time from <button type="button" class="linkish" data-open="settings">Settings</button>.</p>
    </section>
  </div>
</div>`,
  };
}
