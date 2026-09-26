import { createHash } from 'node:crypto';
import { html, esc } from './html.mjs';
import { icons, icon } from './icons.mjs';
import { SPRITE } from './art.mjs';

const ASSET_VERSION = { value: 'dev' };
export const setAssetVersion = (v) => (ASSET_VERSION.value = v);

/**
 * Runs before the first paint, inline in <head> so it costs no request and
 * doesn't block rendering: applies a Day or Night theme chosen in Settings,
 * so the page doesn't flash the device theme first. lib/settings.js owns the
 * setting ("oql.settings" → theme) and keeps it in step after this. The CSP
 * allows it by its hash (see csp()).
 */
export const THEME_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem('oql.settings')||'null');if(s&&(s.theme==='light'||s.theme==='dark'))document.documentElement.setAttribute('data-theme',s.theme)}catch(e){}})();`;

export const SPECULATION = JSON.stringify({
  prerender: [{ where: { href_matches: '/games/*' }, eagerness: 'moderate' }],
  prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/games/*' } }] }, eagerness: 'conservative' }],
});

/** A CSP source for an inline script's exact text. */
export const scriptHash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

export function csp(ctx) {
  const ga = ctx.analyticsOn;
  const g = ga ? ' https://www.googletagmanager.com' : '';
  const gConnect = ga ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com' : '';
  const gImg = ga ? ' https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.google.co.uk' : '';
  let endpoint = '';
  try {
    if (ctx.cfg.contactEndpoint) endpoint = ' ' + new URL(ctx.cfg.contactEndpoint).origin;
  } catch {}
  return [
    "default-src 'self'",
    // The two inline scripts by hash: with a hash in script-src, Chromium
    // ignores 'inline-speculation-rules', so the speculation rules need theirs too.
    `script-src 'self' 'inline-speculation-rules' ${scriptHash(THEME_BOOT)} ${scriptHash(SPECULATION)}${g}`,
    "style-src 'self'",
    `img-src 'self' data: blob:${gImg}`,
    "font-src 'self'",
    `connect-src 'self'${gConnect}${endpoint}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    // Pragmatic Play demos, loaded only when the visitor presses "Play demo".
    `frame-src ${(ctx.pragmaticOn && ctx.cfg.pragmatic.frameHosts?.join(' ')) || "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' mailto:${endpoint}`,
  ].join('; ');
}

// ---------- structured data ----------

export function organizationLd(ctx) {
  const { op } = ctx;
  return {
    '@type': 'Organization',
    '@id': ctx.orgId,
    name: op.companyName,
    alternateName: ctx.brand,
    url: `${ctx.origin}/`,
    logo: `${ctx.origin}/assets/icons/icon-512.png`,
    email: op.email,
    identifier: { '@type': 'PropertyValue', propertyID: 'Companies House company number', value: op.companyNumber },
    address: { '@type': 'PostalAddress', streetAddress: op.address, addressCountry: 'GB' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: op.email,
      areaServed: 'GB',
      availableLanguage: 'en-GB',
    },
  };
}

export function websiteLd(ctx) {
  return {
    '@type': 'WebSite',
    '@id': ctx.websiteId,
    url: `${ctx.origin}/`,
    name: ctx.brand,
    inLanguage: 'en-GB',
    publisher: { '@id': ctx.orgId },
  };
}

export function breadcrumbLd(ctx, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: ctx.origin + c.path,
    })),
  };
}

export function videoGameLd(ctx, g) {
  return {
    '@type': 'VideoGame',
    '@id': `${g.url}#game`,
    name: g.name,
    url: g.url,
    description: g.short,
    image: ctx.origin + g.image,
    genre: g.genre,
    gamePlatform: 'Web browser',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any operating system with a modern web browser',
    playMode: 'SinglePlayer',
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    contentRating: '18+',
    audience: { '@type': 'PeopleAudience', suggestedMinAge: 18 },
    offers: {
      '@type': 'Offer',
      price: 0,
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: g.url,
      category: 'free',
    },
    publisher: { '@id': ctx.orgId },
    dateModified: ctx.updatedIso,
  };
}

const ldScript = (items) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(/</g, '\\u003c')}</script>`;

// ---------- page chrome ----------

/** Visible breadcrumbs. Pages that draw them inside their own title band set page.crumbsInBody and call this. */
export function breadcrumbs(crumbs) {
  if (!crumbs?.length) return '';
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>
    ${crumbs.map((c, i) =>
      i === crumbs.length - 1
        ? `<li><a href="${c.path}" aria-current="page">${esc(c.name)}</a></li>`
        : `<li><a href="${c.path}">${esc(c.name)}</a></li>`,
    )}
  </ol></nav>`;
}

/**
 * Which part of the site a page belongs to, for aria-current in the nav and
 * the dock: 'home', 'slots' (the lobby and every slot page), 'tables' (our
 * roulette and blackjack pages), 'safer' or 'about'.
 */
function sectionOf(ctx, page) {
  if (page.path === '/') return 'home';
  if (page.path === '/games/') return 'slots';
  const g = ctx.games.find((x) => x.path === page.path);
  if (g) return g.table ? 'tables' : 'slots';
  if (page.path.startsWith('/responsible-gaming/')) return 'safer';
  if (page.path.startsWith('/about/')) return 'about';
  return '';
}

/**
 * aria-current for a nav item: "page" when the link is this page's own
 * address, "true" when the page sits inside that part of the site (a game
 * page under Slots, for example).
 */
function current(page, sec, key, path) {
  if (sec !== key) return '';
  return page.path === path.replace(/#.*$/, '') ? ' aria-current="page"' : ' aria-current="true"';
}

function brand(ctx) {
  // "Opal Quest Lounge" → "Opal Quest" in the wordmark, "Lounge" on the magenta tag.
  const [name, tag] = ctx.brand.split(/ (?=\S+$)/);
  return html`<a class="brand" href="/" aria-label="${esc(ctx.brand)}, home">
      ${icon('opal', 'brand__opal')}
      <span class="brand__name" aria-hidden="true"><b>${esc(name)}</b>${tag ? `<span>${esc(tag)}</span>` : ''}</span>
    </a>`;
}

function ageNotice(ctx) {
  // The first sentence of the disclaimer leads in bold; the rest is verbatim.
  const [lead, ...rest] = ctx.disclaimer.split(/(?<=\.) /);
  // A labelled complementary landmark, so the ribbon isn't content outside every landmark.
  return html`<aside class="age-notice" aria-label="Important information">
  <div class="wrap age-notice__row">
    <span class="age-mark" aria-hidden="true">18+</span>
    <p><strong>${esc(lead)}</strong> ${esc(rest.join(' '))}</p>
    <a href="/responsible-gaming/">Safer play tools</a>
  </div>
</aside>`;
}

function masthead(ctx, page, sec) {
  const c = ctx.cur;
  const start = ctx.cfg.currency.startingBalance.toLocaleString('en-GB');
  return html`<header class="masthead">
  <div class="cmyk" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="wrap masthead__row">
    ${brand(ctx)}
    <nav class="nav" aria-label="Main">
      <ul>
        <li><a href="/games/#slots"${current(page, sec, 'slots', '/games/')}>Slots</a></li>
        <li><a href="/games/#tables"${current(page, sec, 'tables', '/games/')}>Table games</a></li>
        <li><a href="/responsible-gaming/"${current(page, sec, 'safer', '/responsible-gaming/')}>Responsible gaming</a></li>
        <li><a href="/about/"${current(page, sec, 'about', '/about/')}>About</a></li>
      </ul>
    </nav>
    <div class="status">
      <p class="status__balance" title="Your free virtual balance: ${start} ${esc(c.plural)}. ${esc(c.plural)} have no cash value." data-balance-pill>
        <span class="status__ico" aria-hidden="true">${icons.gem}</span>
        <span class="status__txt"><span class="visually-hidden">Balance: <span data-balance>${start}</span></span><b class="num" aria-hidden="true" data-balance-short>${start}</b><span class="status__unit">${esc(c.plural)}</span></span>
      </p>
      <p class="status__session" title="Time on the site this session">
        <span class="status__ico" aria-hidden="true">${icons.clockDisc}</span>
        <span class="status__txt"><span class="visually-hidden">Session time:</span><b class="num" data-session>0:00</b><span class="status__unit" aria-hidden="true">Session</span></span>
      </p>
      <button type="button" class="icon-btn" data-open="settings" aria-haspopup="dialog" aria-label="Settings">${icons.gear}</button>
    </div>
  </div>
</header>`;
}

/** Escape a name and keep hyphenated words ("Twenty-One") on one line. */
const keepHyphens = (name) => esc(name).replace(/(\S+-\S+)/g, '<span class="nobr">$1</span>');

const newTab = (href, text) =>
  `<a href="${href}" rel="noopener" target="_blank">${text}<span class="visually-hidden"> (opens in a new tab)</span></a>`;

function footer(ctx) {
  const { op } = ctx;
  const tables = ctx.houseGames.filter((g) => g.table);
  // Play: the lobby, the featured demo (or our own slot when the demos are off) and our two tables.
  const firstSlot = ctx.featured || ctx.games.find((g) => !g.table);
  const play = [
    { name: 'All games', path: '/games/' },
    ...(firstSlot ? [{ name: ctx.pragmaticOn ? `${firstSlot.name} demo` : firstSlot.name, path: firstSlot.path }] : []),
    ...tables.map((g) => ({ name: g.name, path: g.path })),
  ];
  const trademark = ctx.pragmaticOn
    ? 'Pragmatic Play and game names are trademarks of their owners; we are not affiliated. Megaways is a trademark of Big Time Gaming. Nobody named here endorses this site. Game covers on this site are our own artwork.'
    : 'The games and all the artwork on this site are our own.';
  return html`<footer class="colophon">
  <div class="wrap">
    <div class="colophon__grid">
      <section class="colophon__about" aria-label="About ${esc(ctx.brand)}">
        ${brand(ctx)}
        <p class="colophon__disclaimer"><span class="age-mark" aria-hidden="true">18+</span><span>${esc(ctx.disclaimer)}</span></p>
        <p class="colophon__blurb">You play with virtual ${esc(ctx.cur.plural)}. They can’t be bought, sold or exchanged, and nothing here pays out.</p>
      </section>
      <nav class="colophon__nav" aria-labelledby="f-play">
        <h2 id="f-play">Play</h2>
        <ul>${play.map((l) => `<li><a href="${l.path}">${keepHyphens(l.name)}</a></li>`)}</ul>
      </nav>
      <nav class="colophon__nav" aria-labelledby="f-help">
        <h2 id="f-help">Help</h2>
        <ul>
          <li><a href="/responsible-gaming/">Responsible gaming</a></li>
          <li><a href="/contact/">Contact</a></li>
          <li><a href="/about/">About us</a></li>
          <li><a class="colophon__tel" href="tel:+448088020133">GamCare <span class="num nobr">0808 8020 133</span></a></li>
          <li>${newTab('https://www.nhs.uk/live-well/addiction-support/gambling-addiction/', 'NHS gambling support')}</li>
        </ul>
      </nav>
      <nav class="colophon__nav" aria-labelledby="f-legal">
        <h2 id="f-legal">Legal</h2>
        <ul>
          <li><a href="/terms/">Terms of use</a></li>
          <li><a href="/privacy/">Privacy notice</a></li>
          <li><a href="/cookies/">Cookies and storage</a></li>
          ${ctx.analyticsOn ? '<li><button type="button" class="linkish" data-open="consent" aria-haspopup="dialog">Cookie settings</button></li>' : ''}
        </ul>
      </nav>
    </div>
    <div class="colophon__slug">
      <p>${esc(ctx.brand)} is operated by ${esc(op.companyName)}, company number <span class="num">${esc(op.companyNumber)}</span>, registered in ${esc(op.registeredIn)}. Registered office: ${esc(op.address)}. Contact: <a href="mailto:${esc(op.email)}">${esc(op.email)}</a></p>
      <p>${trademark}</p>
      <p>© ${ctx.year} ${esc(op.companyName)} · Page last updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time></p>
    </div>
  </div>
</footer>`;
}

function dock(ctx, page, sec) {
  return html`<nav class="dock" aria-label="Quick links">
  <a href="/"${current(page, sec, 'home', '/')}>${icons.home}<span>Home</span></a>
  <a href="/games/#slots"${current(page, sec, 'slots', '/games/')}>${icons.reels}<span>Slots</span></a>
  <a href="/games/#tables"${current(page, sec, 'tables', '/games/')}>${icons.cards}<span>Tables</span></a>
  <a href="/responsible-gaming/"${current(page, sec, 'safer', '/responsible-gaming/')}>${icons.shield}<span>Safer play</span></a>
  <button type="button" data-open="settings" aria-haspopup="dialog">${icons.gear}<span>Settings</span></button>
</nav>`;
}

// ---------- dialogs ----------
// Every dialog uses the same shell: .sheet-dialog > .dialog__head (yellow band,
// h2, optional close button) and .dialog__body. The ids and data-* hooks are
// what app.js and lib/*.js bind to; keep them.

function dialogs(ctx) {
  const c = ctx.cur;
  const pp = ctx.pragmaticOn;
  const close = (label) => `<button type="submit" class="icon-btn dialog__close" value="close" aria-label="${label}">${icons.close}</button>`;
  // A status line in every dialog, live from page load. While a modal is
  // open, the page's toast is inert, so lib/ui.js toast() and announce()
  // write here instead (screen readers only; the dialog shows the result).
  const status = '<p class="visually-hidden" role="status" data-dialog-status></p>';
  return html`
<dialog id="age-gate" class="sheet-dialog age" aria-labelledby="age-title" aria-describedby="age-desc">
  <header class="dialog__head">
    <h2 id="age-title" tabindex="-1" autofocus>Are you 18 or over?</h2>
    <span class="age-mark" aria-hidden="true">18+</span>
  </header>
  <div class="dialog__body">
    <p id="age-desc">${esc(ctx.brand)} is for adults only. <strong>${esc(ctx.disclaimer)}</strong></p>
    <div class="dialog__actions age__actions">
      <button type="button" class="btn btn--primary" data-age="yes">Yes, I’m 18 or over</button>
      <button type="button" class="btn btn--secondary" data-age="no">No, I’m under 18</button>
    </div>
    <div class="age__under callout" hidden>
      <p tabindex="-1"><strong>Sorry, you can’t use the games on this site.</strong> They’re locked on this device for 30 days.</p>
      <p>If you’re worried about gambling, including someone else’s, you can talk to GamCare in confidence on <a href="tel:+448088020133" class="nobr">0808 8020 133</a>.</p>
    </div>
    <p class="dialog__fine age__fine">We keep your answer on this device only. See <a href="/cookies/">cookies and storage</a>.</p>
    ${status}
  </div>
</dialog>

<dialog id="settings" class="sheet-dialog" aria-labelledby="settings-title">
  <form method="dialog">
    <header class="dialog__head">
      <h2 id="settings-title">Settings</h2>
      ${close('Close settings')}
    </header>
    <div class="dialog__body settings">
      <fieldset class="segmented" data-setting="theme">
        <legend>Theme</legend>
        <label><input type="radio" name="theme" value="system" checked><span>Match device</span></label>
        <label><input type="radio" name="theme" value="light"><span>Day</span></label>
        <label><input type="radio" name="theme" value="dark"><span>Night</span></label>
      </fieldset>
      <div class="settings__group">
        <label class="field">
          <span>Daily time limit <span class="settings__state" data-rg-state="limit">Off</span></span>
          <select name="limit" aria-describedby="settings-limit-help settings-limit-pending">
            <option value="0">No limit</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="240">4 hours</option>
          </select>
        </label>
        <button type="button" class="btn btn--secondary settings__save" data-action="save-limit" aria-disabled="true">Save limit</button>
        <small id="settings-limit-help">Choose a limit, then save it. At the limit, games pause until midnight. A lower limit applies at once; a higher one starts tomorrow.</small>
        <small class="settings__pending" id="settings-limit-pending" data-rg-state="limit-pending" hidden></small>
      </div>
      <div class="settings__group">
        <fieldset class="segmented" data-setting="reality" aria-describedby="settings-rc-help">
          <legend>Reality check <span class="settings__state" data-rg-state="reality">Every 30 min</span></legend>
          <label><input type="radio" name="rc" value="15"><span>15 min</span></label>
          <label><input type="radio" name="rc" value="30" checked><span>30 min</span></label>
          <label><input type="radio" name="rc" value="60"><span>60 min</span></label>
        </fieldset>
        <small id="settings-rc-help">A reminder of your time on the site and what you’ve staked${pp ? ' on our own tables' : ''}, with the option of a short break.</small>
      </div>
      <div class="settings__group" role="group" aria-labelledby="settings-break-label" aria-describedby="settings-break-help">
        <p class="field"><span id="settings-break-label">Take a break <span class="settings__state" data-rg-state="break">None set</span></span></p>
        <div class="settings__break">
          <button type="button" class="btn btn--secondary" data-action="break-5">Take a 5-minute break</button>
          <a href="/responsible-gaming/#break">24 hours, 7 or 30 days</a>
        </div>
        <small id="settings-break-help">Longer breaks can’t be cut short once they start.</small>
      </div>
      <div class="settings__group settings__switches">
        <label class="switch"><input type="checkbox" role="switch" name="sound"><span>Sound</span><small>Made in your browser. Off until you turn it on.</small></label>
        <label class="switch" data-needs="vibrate"><input type="checkbox" role="switch" name="haptics"><span>Vibration</span><small>A short tap when reels stop and cards land. Phones only.</small></label>
      </div>
      <div class="settings__group settings__carats">
        <p>Balance: <b class="num" data-balance></b> ${esc(c.plural)}</p>
        <button type="button" class="btn btn--secondary btn--sm" data-action="reset-balance"><span>Reset to <span class="num">${ctx.carats(c.startingBalance)}</span></span></button>
      </div>
      <p class="settings__more"><a href="/responsible-gaming/">All safer play tools</a></p>
      ${status}
    </div>
  </form>
</dialog>

<dialog id="reality-check-dialog" class="sheet-dialog" aria-labelledby="rc-title" aria-describedby="${pp ? 'rc-body rc-note' : 'rc-body'}">
  <header class="dialog__head">
    <div>
      <p class="dialog__eyebrow">Reality check</p>
      <h2 id="rc-title">You’ve been here <span data-rc-time>30 minutes</span></h2>
    </div>
  </header>
  <div class="dialog__body rc">
    <p id="rc-body">${pp ? 'On our own tables this session, you’ve' : 'This session you’ve'} staked <b class="num" data-rc-staked>0</b> ${esc(c.plural)} and had <b class="num" data-rc-returned>0</b> back. Your balance is <b class="num" data-balance></b>.</p>
    ${pp ? '<p id="rc-note" class="dialog__fine">We can’t see inside the Pragmatic Play demos, so demo credits aren’t counted. Your time is.</p>' : ''}
    <div class="dialog__actions rc__actions">
      <button type="button" class="btn btn--primary" data-rc="break">Take a 5-minute break</button>
      <button type="button" class="btn btn--secondary" data-rc="continue">Keep playing</button>
    </div>
    <p class="dialog__fine"><a href="/responsible-gaming/">Set a daily limit or take a longer break</a></p>
    ${status}
  </div>
</dialog>

<dialog id="confirm" class="sheet-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
  <form method="dialog">
    <header class="dialog__head">
      <h2 id="confirm-title"></h2>
    </header>
    <div class="dialog__body">
      <p id="confirm-body"></p>
      <div class="dialog__actions confirm__actions">
        <button class="btn btn--primary" value="yes"></button>
        <button class="btn btn--secondary" value="no" autofocus></button>
      </div>
      ${status}
    </div>
  </form>
</dialog>

<dialog id="consent" class="sheet-dialog" aria-labelledby="consent-title">
  <form method="dialog" class="consent-manage">
    <header class="dialog__head">
      <h2 id="consent-title">Cookie settings</h2>
      ${close('Close cookie settings')}
    </header>
    <div class="dialog__body">
      <p>We use storage on your device to run the games. That’s always on, because the site can’t work without it. Anything else is off until you switch it on.</p>
      <div class="settings__switches">
        <label class="switch is-locked"><input type="checkbox" role="switch" checked disabled><span>Strictly necessary</span><small>Your balance, age answer, settings, limits and this choice. Kept on your device.</small></label>
        ${ctx.cfg.analytics?.ga4
          ? '<label class="switch"><input type="checkbox" role="switch" name="analytics"><span>Analytics</span><small>Google Analytics 4 counts visits and which games are played. Sets _ga cookies.</small></label>'
          : '<p class="switch is-off"><span>Analytics</span><small>Not in use. We don’t run any analytics at the moment.</small></p>'}
        ${ctx.cfg.analytics?.adsConversionId
          ? '<label class="switch"><input type="checkbox" role="switch" name="ads"><span>Advertising measurement</span><small>Google Ads tells us whether an advert led to a visit. Sets Google Ads cookies.</small></label>'
          : ''}
      </div>
      <div class="dialog__actions dialog__actions--equal consent__actions">
        <button type="button" class="btn btn--secondary" data-consent="reject">Reject all</button>
        <button type="button" class="btn btn--secondary" data-consent="save">Save choices</button>
        <button type="button" class="btn btn--secondary" data-consent="accept">Accept all</button>
      </div>
      <p class="dialog__fine">Read the <a href="/cookies/">cookie policy</a>. You can change your mind at any time${ctx.analyticsOn ? ' from the footer' : ' from the cookies page'}.</p>
      ${status}
    </div>
  </form>
</dialog>

<div class="toast" popover="manual" id="toast" role="status">${icons.info}<span class="toast__msg"></span></div>
<p id="announcer" class="visually-hidden" aria-live="polite"></p>`;
}

/**
 * The cookie banner (only when analytics is configured). It is fixed to the
 * bottom of the screen but comes first in the markup, straight after the skip
 * link, so keyboard and screen-reader users meet it before the page it covers.
 * lib/consent.js shows it, keeps focused controls clear of it and hides it.
 */
function consentBanner(ctx) {
  if (!ctx.analyticsOn) return '';
  const ads = ctx.cfg.analytics.adsConversionId;
  return html`<section class="consent-banner" aria-labelledby="cb-title" hidden>
  <h2 id="cb-title">Cookie choices</h2>
  <p>We’d like to use ${ads ? 'Google Analytics and Google Ads measurement' : 'Google Analytics'} to see how the site is used. ${ads ? 'They set' : 'It sets'} cookies, and nothing loads unless you say yes. <a href="/cookies/">Cookie policy</a></p>
  <div class="dialog__actions dialog__actions--equal consent__actions">
    <button type="button" class="btn btn--secondary btn--sm" data-consent="reject">Reject all</button>
    <button type="button" class="btn btn--secondary btn--sm" data-open="consent" aria-haspopup="dialog">Manage</button>
    <button type="button" class="btn btn--secondary btn--sm" data-consent="accept">Accept all</button>
  </div>
</section>`;
}

/**
 * Add the site-wide JSON-LD nodes this page points at by @id but doesn't
 * carry, so each page's graph resolves on its own (validators don't follow
 * an @id to another page). The WebSite goes first: it points at the
 * Organization itself.
 */
function resolveLd(ctx, ld) {
  const has = (id) => ld.some((n) => n['@id'] === id);
  const refers = (id) => JSON.stringify(ld).includes(`"${id}"`);
  if (refers(ctx.websiteId) && !has(ctx.websiteId)) ld.push(websiteLd(ctx));
  if (refers(ctx.orgId) && !has(ctx.orgId)) ld.push(organizationLd(ctx));
  return ld;
}

export function layout(ctx, page) {
  const v = ASSET_VERSION.value;
  const url = ctx.origin + page.path;
  const ogImage = ctx.origin + (page.ogImage || (ctx.pragmaticOn ? '/assets/img/og-home.png' : '/assets/img/og-home-house.png'));
  const ld = [...(page.jsonld || [])];
  if (page.breadcrumbs?.length) ld.push(breadcrumbLd(ctx, page.breadcrumbs));
  resolveLd(ctx, ld);
  const modules = page.modules || [];
  const robots = page.noindex ? '<meta name="robots" content="noindex">' : '';
  const sec = sectionOf(ctx, page);

  return html`<!doctype html>
<html lang="en-GB" data-page="${page.id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp(ctx)}">
<script>${THEME_BOOT}</script>
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.canonical === false ? '' : `<link rel="canonical" href="${url}">`}
${robots}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="${ctx.cfg.themeColor.light}">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${ctx.cfg.themeColor.dark}">
${(page.preloadFonts || ['archivo', 'radio-canada']).map((f) => `<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`)}
<link rel="stylesheet" href="/assets/css/site.css?v=${v}">
<script src="/assets/js/age-boot.js?v=${v}" defer></script>
<link rel="modulepreload" href="/assets/js/app.js?v=${v}">
${modules.map((m) => `<link rel="modulepreload" href="${m}">`)}
<script type="module" src="/assets/js/app.js?v=${v}"></script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${esc(ctx.brand)}">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(page.ogTitle || page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.ogAlt || `${ctx.brand}: free-to-play games with virtual ${ctx.cur.plural}. 18+.`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.ogTitle || page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${esc(page.ogAlt || `${ctx.brand}: free-to-play games with virtual ${ctx.cur.plural}. 18+.`)}">
${ld.length ? ldScript(ld) : ''}
<script type="speculationrules">${SPECULATION}</script>
</head>
<body class="${page.bodyClass || ''}">
${SPRITE}
<a class="skip" href="#main">Skip to main content</a>
${consentBanner(ctx)}
${ageNotice(ctx)}
${masthead(ctx, page, sec)}
<main id="main" tabindex="-1">
<noscript><p class="noscript">The games and the safer play tools need JavaScript. The rules, paytables and policies on this site all work without it.</p></noscript>
${page.crumbsInBody || !page.breadcrumbs?.length ? '' : `<div class="wrap">${breadcrumbs(page.breadcrumbs)}</div>`}
${page.body}
</main>
${footer(ctx)}
${dock(ctx, page, sec)}
${dialogs(ctx)}
</body>
</html>
`;
}
