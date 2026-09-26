import { html, esc } from '../lib/html.mjs';
import { pageHero, updatedPill, legalBody, ext, pageIcons } from './misc.mjs';
import { PRAGMATIC_TERMS } from './terms.mjs';

// Every item the site keeps in the browser. The client code uses exactly
// these keys (see assets/js/lib/store.js); keep the two in step.
export const STORAGE = [
  { key: 'oql.age', where: 'Local storage', what: 'Your answer to “Are you 18 or over?” and when you gave it.', keep: 'Until you clear site data. A “no” locks the games for 30 days.' },
  { key: 'oql.wallet', where: 'Local storage', what: 'Your balance of Carats.', keep: 'Until you clear site data or reset it.' },
  { key: 'oql.settings', where: 'Local storage', what: 'Theme, sound and vibration choices.', keep: 'Until you clear site data.' },
  { key: 'oql.limits', where: 'Local storage', what: 'Your daily time limit, any change waiting to start tomorrow, and how often the reality check appears.', keep: 'Until you clear site data.' },
  { key: 'oql.playtime', where: 'Local storage', what: 'Time played today, to apply your daily limit.', keep: 'Replaced each day.' },
  { key: 'oql.pause', where: 'Local storage', what: 'The end time of a break you’ve chosen.', keep: 'Until the break ends.' },
  { key: 'oql.consent', where: 'Local storage', what: 'Your cookie choices, so we don’t ask again.', keep: '12 months, then we ask again.' },
  { key: 'oql.session', where: 'Session storage', what: 'When this session started, what you’ve staked and had back on our own games, and when the last reality check was due.', keep: 'Until you close the tab.' },
  { key: 'oql-v…', where: 'Cache storage', what: 'Copies of the site’s pages, styles, scripts and fonts, so our own games work offline.', keep: 'Replaced when the site updates.' },
];

/**
 * A storage or cookie table. On phones the CSS lays each row out as a card,
 * so the table, row and cell roles are written out: browsers drop a table's
 * semantics when its display changes.
 */
function listTable(caption, cols, rows) {
  return html`<div class="table-wrap"><table class="paytable storage" role="table">
    <caption>${caption}</caption>
    <thead role="rowgroup"><tr role="row">${cols.map((c) => `<th scope="col" role="columnheader">${c}</th>`)}</tr></thead>
    <tbody role="rowgroup">${rows.map(
      ([head, ...cells]) =>
        `<tr role="row"><th scope="row" role="rowheader"><code>${head}</code></th>${cells.map((c, i) => `<td role="cell" data-label="${cols[i + 1]}">${c}</td>`).join('')}</tr>`,
    )}</tbody>
  </table></div>`;
}

export function storageTable(ctx) {
  return listTable('What the site stores in your browser', ['Name', 'Type', 'What it holds', 'How long'], STORAGE.map((s) => [s.key, s.where, s.what, s.keep]));
}

export default function cookies(ctx) {
  const a = ctx.cfg.analytics || {};
  const pp = ctx.pragmaticOn;
  const tables = ctx.houseGames.filter((g) => g.table).map((g) => `<span class="nobr">${esc(g.name)}</span>`);
  const optional = [];
  if (a.ga4) {
    optional.push({ name: '_ga', who: 'Google Analytics', what: 'Tells visits apart.', keep: '2 years' });
    optional.push({ name: `_ga_${a.ga4.replace(/^G-/, '')}`, who: 'Google Analytics', what: 'Keeps session state for this site’s analytics.', keep: '2 years' });
  }
  if (a.adsConversionId) {
    optional.push({ name: '_gcl_au', who: 'Google Ads', what: 'Links a visit to the advert that led to it.', keep: '90 days' });
  }

  const page = {
    id: 'cookies',
    path: '/cookies/',
    title: `Cookies and Storage · ${ctx.brand}`,
    description: `Every item ${ctx.brand} stores in your browser, what each is for and how long it lasts${pp ? ', and what a Pragmatic Play demo may set' : ''}. ${ctx.analyticsOn ? 'Analytics are opt-in.' : 'No tracking cookies.'}`,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Cookies and storage', path: '/cookies/' },
    ],
    crumbsInBody: true,
    bodyClass: 'is-legal',
  };

  const sections = [
    {
      id: 'necessary',
      title: 'Strictly necessary storage',
      body: html`<p>The site doesn’t set any cookies of its own. It uses your browser’s local storage, session storage and cache storage to run the games. This is strictly necessary for the service you ask for, so under the Privacy and Electronic Communications Regulations (PECR) it doesn’t need consent. It stays on your device and isn’t sent to us.</p>
    ${storageTable(ctx)}`,
    },
    {
      id: 'optional',
      title: 'Optional cookies',
      body: optional.length
        ? html`<p>These are only set if you choose “Accept all” or switch them on in Cookie settings. Until then no script from Google loads at all.</p>
      ${listTable('Optional cookies, set only with your consent', ['Name', 'Set by', 'Purpose', 'How long'], optional.map((o) => [esc(o.name), o.who, o.what, o.keep]))}
      <p>We use Google Consent Mode version 2. Before you choose, every consent signal (<code>ad_storage</code>, <code>ad_user_data</code>, <code>ad_personalization</code>, <code>analytics_storage</code>, <code>functionality_storage</code>, <code>personalization_storage</code> and <code>security_storage</code>) is set to “denied”. Your choice is kept for 12 months.</p>`
        : html`<p>None. We don’t use analytics, advertising or social media cookies${pp ? '' : ', and the site makes no requests to other companies’ servers'}. If we ever add them, they’ll be off until you switch them on, and this page will list them.</p>`,
    },
    {
      id: 'third-party',
      title: pp ? 'Third-party content: Pragmatic Play demos' : 'Third-party content',
      body: pp
        ? html`<p><strong>Nothing from Pragmatic Play loads until you press a Play button.</strong> Until then, the demo is our own cover picture and your browser makes no request to Pragmatic Play.</p>
      <p>When you press Play, the demo loads from Pragmatic Play’s servers in a frame on our page. From then on:</p>
      <ul>
        <li>Pragmatic Play may set cookies, or read and write other storage on your device, under its own domain (<code>pragmaticplay.net</code>).</li>
        <li>Google Analytics, running inside the demo, may also set cookies or use storage on your device under Pragmatic Play’s domain.</li>
      </ul>
      <p>Pragmatic Play decides what its demos store, so we can’t list every item or say how long each lasts. Its ${ext(PRAGMATIC_TERMS, 'terms of use')} apply inside the demo. Some browsers block storage set inside frames like this, or keep it apart from other sites.</p>
      <div class="callout callout--note">
        <p><strong>How to avoid it:</strong> don’t press Play on a slot demo. If you choose “Reject all” in Cookie settings, each Play button asks before it loads a demo. Our own tables, ${tables.join(' and ')}, work without it and load nothing from anyone else. To remove anything a demo has already stored, clear the site data for <code>pragmaticplay.net</code> in your browser settings.</p>
      </div>`
        : html`<p>None. Every game on the site is our own, and nothing loads from another company’s servers.</p>`,
    },
    {
      id: 'links',
      title: 'Links to other sites',
      body: html`<p>Pages such as Responsible gaming link to support organisations. Those sites have their own cookie policies, which apply once you follow a link.</p>`,
    },
    {
      id: 'remove',
      title: 'How to remove it all',
      body: html`<p>In your browser settings, find the site data for ${esc(ctx.cfg.domain)} and clear it. That resets your balance, settings and limits, and removes the offline copy. A break you’ve set will also be cleared, so please think about that first.${pp ? ` Anything a demo stored is kept under <code>pragmaticplay.net</code>; clear that separately.` : ''}</p>`,
    },
  ];

  page.body = html`
${pageHero(page, {
  eyebrow: 'Legal',
  title: 'Cookies and storage',
  lede: pp
    ? 'Everything the site keeps in your browser, not just cookies, and what a slot demo may store once you press Play.'
    : 'Everything the site keeps in your browser, not just cookies.',
  meta: [updatedPill(ctx)],
  actions: '<button type="button" class="btn btn--secondary" data-open="consent" aria-haspopup="dialog">Open cookie settings</button>',
  art: { icon: pageIcons.stack, tone: 'y' },
})}
${legalBody(sections, {
  summary: [
    'We set no cookies of our own.',
    'Your balance, settings and limits stay in your browser and never reach us.',
    ctx.analyticsOn ? 'Analytics cookies are off until you switch them on.' : 'There are no analytics or advertising cookies.',
    pp ? 'A Pragmatic Play demo may store things on your device, but only after you press Play.' : 'Nothing loads from another company’s servers.',
  ],
})}`;
  return page;
}
