import { html, esc } from '../lib/html.mjs';

// Every item the site keeps in the browser. The client code uses exactly
// these keys (see assets/js/lib/store.js); keep the two in step.
export const STORAGE = [
  { key: 'oql.age', where: 'Local storage', what: 'Your answer to “Are you 18 or over?” and when you gave it.', keep: 'Until you clear site data. A “no” locks the games for 30 days.' },
  { key: 'oql.wallet', where: 'Local storage', what: 'Your balance of Carats.', keep: 'Until you clear site data or reset it.' },
  { key: 'oql.settings', where: 'Local storage', what: 'Theme, sound and vibration choices.', keep: 'Until you clear site data.' },
  { key: 'oql.limits', where: 'Local storage', what: 'Your daily time limit and any change waiting to start tomorrow.', keep: 'Until you clear site data.' },
  { key: 'oql.playtime', where: 'Local storage', what: 'Minutes played today, to apply your daily limit.', keep: 'Replaced each day.' },
  { key: 'oql.pause', where: 'Local storage', what: 'The end time of a break you’ve chosen.', keep: 'Until the break ends.' },
  { key: 'oql.consent', where: 'Local storage', what: 'Your cookie choices, so we don’t ask again.', keep: '12 months, then we ask again.' },
  { key: 'oql.session', where: 'Session storage', what: 'When this session started, what you’ve staked and had back, and when the last break reminder showed.', keep: 'Until you close the tab.' },
  { key: 'oql-v…', where: 'Cache storage', what: 'Copies of the site’s pages, styles, scripts and fonts, so the games work offline.', keep: 'Replaced when the site updates.' },
];

export function storageTable(ctx) {
  return html`<div class="table-wrap"><table class="storage">
    <caption>What the site stores in your browser</caption>
    <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">What it holds</th><th scope="col">How long</th></tr></thead>
    <tbody>${STORAGE.map(
      (s) => `<tr><th scope="row"><code>${s.key}</code></th><td>${s.where}</td><td>${s.what}</td><td>${s.keep}</td></tr>`,
    )}</tbody>
  </table></div>`;
}

export default function cookies(ctx) {
  const a = ctx.cfg.analytics || {};
  const optional = [];
  if (a.ga4) {
    optional.push({ name: '_ga', who: 'Google Analytics', what: 'Tells visits apart.', keep: '2 years' });
    optional.push({ name: `_ga_${a.ga4.replace(/^G-/, '')}`, who: 'Google Analytics', what: 'Keeps session state for this site’s analytics.', keep: '2 years' });
  }
  if (a.adsConversionId) {
    optional.push({ name: '_gcl_au', who: 'Google Ads', what: 'Links a visit to the advert that led to it.', keep: '90 days' });
  }
  return {
    id: 'cookies',
    path: '/cookies/',
    title: `Cookies and Storage · ${ctx.brand}`,
    description: `Every item ${ctx.brand} stores in your browser, including local storage, what each is for and how long it lasts. ${ctx.analyticsOn ? 'Analytics cookies only with consent.' : 'No tracking cookies.'}`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Cookies and storage', path: '/cookies/' },
    ],
    bodyClass: 'is-legal',
    body: html`
<header class="page-head">
  <p class="eyebrow">Legal</p>
  <h1 class="page-title">Cookies and storage</h1>
  <p class="lede">Last updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time>. This page lists everything the site keeps in your browser, not just cookies.</p>
  <p><button type="button" class="btn btn--secondary" data-open="consent">Open cookie settings</button></p>
</header>
<div class="prose prose--legal">
  <section aria-labelledby="c1"><h2 id="c1">Strictly necessary storage</h2>
    <p>The site doesn't set any cookies of its own. It uses your browser's local storage, session storage and cache storage to run the games. This is strictly necessary for the service you ask for, so under PECR it doesn't need consent. It stays on your device and isn't sent to us.</p>
    ${storageTable(ctx)}
  </section>

  <section aria-labelledby="c2"><h2 id="c2">Optional cookies</h2>
    ${optional.length
      ? html`<p>These are only set if you choose "Accept all" or switch them on in Cookie settings. Until then no script from Google loads at all.</p>
      <div class="table-wrap"><table>
        <caption>Optional cookies, set only with your consent</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Set by</th><th scope="col">Purpose</th><th scope="col">How long</th></tr></thead>
        <tbody>${optional.map((o) => `<tr><th scope="row"><code>${esc(o.name)}</code></th><td>${o.who}</td><td>${o.what}</td><td>${o.keep}</td></tr>`)}</tbody>
      </table></div>
      <p>We use Google Consent Mode version 2. Before you choose, every consent signal (<code>ad_storage</code>, <code>ad_user_data</code>, <code>ad_personalization</code>, <code>analytics_storage</code>, <code>functionality_storage</code>, <code>personalization_storage</code> and <code>security_storage</code>) is set to "denied". Your choice is kept for 12 months.</p>`
      : html`<p>None. We don't use analytics, advertising or social media cookies, and the site makes no requests to other companies' servers. If we ever add them, they'll be off until you switch them on, and this page will list them.</p>`}
  </section>

  <section aria-labelledby="c3"><h2 id="c3">Links to other sites</h2>
    <p>Pages such as Responsible gaming link to support organisations. Those sites have their own cookie policies, which apply once you follow a link.</p>
  </section>

  <section aria-labelledby="c4"><h2 id="c4">How to remove it all</h2>
    <p>In your browser settings, find the site data for ${esc(ctx.cfg.domain)} and clear it. That resets your balance, settings and limits, and removes the offline copy. A break you've set will also be cleared, so please think about that first.</p>
  </section>
</div>`,
  };
}
