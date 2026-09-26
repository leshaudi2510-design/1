import { html, esc } from './html.mjs';
import { icons } from './icons.mjs';

const ASSET_VERSION = { value: 'dev' };
export const setAssetVersion = (v) => (ASSET_VERSION.value = v);

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
    `script-src 'self' 'inline-speculation-rules'${g}`,
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

function breadcrumbs(crumbs) {
  if (!crumbs?.length) return '';
  return html`<nav class="crumbs" aria-label="Breadcrumb"><ol>
    ${crumbs.map((c, i) =>
      i === crumbs.length - 1
        ? `<li><a href="${c.path}" aria-current="page">${esc(c.name)}</a></li>`
        : `<li><a href="${c.path}">${esc(c.name)}</a></li>`,
    )}
  </ol></nav>`;
}

function gamesMenuList(ctx, current) {
  return ctx.games
    .map(
      (g) => html`<li><a href="${g.path}"${current === g.path ? ' aria-current="page"' : ''}>
        <span class="menu__no">No. ${g.no}</span>
        <span class="menu__name">${esc(g.name)}</span>
        <span class="menu__kind">${esc(g.kind)} · RTP ${g.rtpLabel}</span>
      </a></li>`,
    )
    .join('');
}

function masthead(ctx, page) {
  const cur = (p) => (page.path === p ? ' aria-current="page"' : '');
  return html`<header class="masthead">
  <a class="brand" href="/" aria-label="${esc(ctx.brand)}, home">
    <canvas class="brand__opal" data-opal="mark" width="36" height="28" aria-hidden="true"></canvas>
    <span class="brand__name">${esc(ctx.brand)}</span>
  </a>
  <nav class="nav" aria-label="Main">
    <ul>
      <li><button type="button" class="nav__games" popovertarget="games-menu" aria-haspopup="true">Games</button></li>
      <li><a href="/responsible-gaming/"${cur('/responsible-gaming/')}>Responsible gaming</a></li>
      <li><a href="/about/"${cur('/about/')}>About</a></li>
    </ul>
  </nav>
  <div id="games-menu" class="menu" popover>
    <p class="menu__head">The cabinet</p>
    <ul>${gamesMenuList(ctx, page.path)}</ul>
    <a class="menu__all" href="/games/">All games and rules</a>
  </div>
  <div class="status">
    <p class="status__balance" title="Your balance of virtual ${esc(ctx.cur.plural)}">
      <span class="visually-hidden">Balance:</span>
      <span class="num" data-balance>${ctx.cfg.currency.startingBalance.toLocaleString('en-GB')}</span>
      <abbr title="${esc(ctx.cur.plural)}">${esc(ctx.cur.abbr)}</abbr>
    </p>
    <p class="status__session" title="Time on the site this session">
      ${icons.clock}<span class="visually-hidden">Session time:</span>
      <span class="num" data-session>0:00</span>
    </p>
    <button type="button" class="icon-btn" data-open="settings" aria-label="Settings">${icons.sliders}</button>
  </div>
</header>`;
}

function footer(ctx) {
  const { op } = ctx;
  return html`<footer class="colophon">
  <div class="colophon__inner">
    <p class="colophon__disclaimer"><strong>${esc(ctx.disclaimer)}</strong></p>
    <div class="colophon__grid">
      <section class="colophon__about" aria-labelledby="f-brand">
        <h2 id="f-brand" class="colophon__brand">${esc(ctx.brand)}</h2>
        <p>A free games room in the style of a Victorian mineral cabinet. You play with virtual ${esc(ctx.cur.plural)}. Nothing here can be bought, sold or exchanged.${ctx.cfg.purchases ? '' : ' There are no in-game purchases.'}</p>
      </section>
      <nav aria-labelledby="f-games">
        <h2 id="f-games">Games</h2>
        <ul>${ctx.games.map((g) => `<li><a href="${g.path}">${esc(g.name)}</a></li>`)}
          <li><a href="/games/">All games</a></li></ul>
      </nav>
      <nav aria-labelledby="f-help">
        <h2 id="f-help">Help and policies</h2>
        <ul>
          <li><a href="/responsible-gaming/">Responsible gaming</a></li>
          <li><a href="/terms/">Terms of use</a></li>
          <li><a href="/privacy/">Privacy notice</a></li>
          <li><a href="/cookies/">Cookies and storage</a></li>
          <li><button type="button" class="linkish" data-open="consent">Cookie settings</button></li>
          <li><a href="/about/">About us</a></li>
          <li><a href="/contact/">Contact</a></li>
        </ul>
      </nav>
      <section aria-labelledby="f-operator" class="colophon__operator">
        <h2 id="f-operator">Operator</h2>
        <address>
          ${esc(op.companyName)}<br>
          Company number ${esc(op.companyNumber)}, registered in ${esc(op.registeredIn)}<br>
          ${esc(op.address)}<br>
          <a href="mailto:${esc(op.email)}">${esc(op.email)}</a>
        </address>
      </section>
      <section aria-labelledby="f-support" class="colophon__support">
        <h2 id="f-support">Need to talk?</h2>
        <p>If gambling of any kind is causing you worry, call the National Gambling Helpline on <a class="tel" href="tel:+448088020133">0808 8020 133</a>. It's free, confidential and open 24 hours a day.</p>
        <p><a href="https://www.gamcare.org.uk/" rel="noopener" target="_blank">GamCare<span class="visually-hidden"> (opens in a new tab)</span></a> · <a href="https://www.begambleaware.org/" rel="noopener" target="_blank">BeGambleAware<span class="visually-hidden"> (opens in a new tab)</span></a></p>
      </section>
    </div>
    <p class="colophon__slug">
      <span class="age-mark" aria-label="Adults only, 18 plus">18+</span>
      <span>© ${ctx.year} ${esc(op.companyName)}</span>
      <span>Page last updated <time datetime="${ctx.updatedIso}">${ctx.updated}</time></span>
    </p>
  </div>
</footer>`;
}

function dock(ctx, page) {
  const cur = (p) => (page.path === p ? ' aria-current="page"' : '');
  return html`<nav class="dock" aria-label="Quick links">
  <a href="/"${cur('/')}>${icons.lounge}<span>Lounge</span></a>
  <button type="button" popovertarget="games-sheet">${icons.cabinet}<span>Games</span></button>
  <a href="/responsible-gaming/"${cur('/responsible-gaming/')}>${icons.pause}<span>Limits</span></a>
  <button type="button" data-open="settings">${icons.sliders}<span>Settings</span></button>
</nav>
<div id="games-sheet" class="sheet" popover>
  <p class="menu__head">The cabinet</p>
  <ul class="menu">${gamesMenuList(ctx, page.path)}</ul>
  <a class="menu__all" href="/games/">All games and rules</a>
</div>`;
}

function dialogs(ctx) {
  const c = ctx.cur;
  return html`
<dialog id="age-gate" class="sheet-dialog age" aria-labelledby="age-title" aria-describedby="age-desc">
  <div class="age__inner">
    <p class="eyebrow">Before you enter</p>
    <h2 id="age-title">Are you 18 or over?</h2>
    <p id="age-desc">${esc(ctx.brand)} is for adults only. ${esc(ctx.disclaimer)}</p>
    <div class="age__actions">
      <button type="button" class="btn btn--primary" data-age="yes">Yes, I'm 18 or over</button>
      <button type="button" class="btn btn--secondary" data-age="no">No, I'm under 18</button>
    </div>
    <div class="age__under" hidden>
      <p><strong>Sorry, you can't use the games on this site.</strong> They're locked on this device for 30 days.</p>
      <p>If you're worried about gambling, including someone else's, you can talk to GamCare in confidence on <a href="tel:+448088020133">0808 8020 133</a>.</p>
    </div>
    <p class="age__fine">We keep your answer on this device only. See <a href="/cookies/">cookies and storage</a>.</p>
  </div>
</dialog>

<dialog id="settings" class="sheet-dialog" aria-labelledby="settings-title">
  <form method="dialog" class="settings">
    <header class="dialog__head">
      <h2 id="settings-title">Settings</h2>
      <button class="icon-btn" value="close" aria-label="Close settings">${icons.close}</button>
    </header>
    <fieldset class="segmented" data-setting="theme">
      <legend>Theme</legend>
      <label><input type="radio" name="theme" value="system"><span>Match device</span></label>
      <label><input type="radio" name="theme" value="light"><span>Daylight label</span></label>
      <label><input type="radio" name="theme" value="dark"><span>Velvet tray</span></label>
    </fieldset>
    <div class="switches">
      <label class="switch"><input type="checkbox" role="switch" name="sound"><span>Sound</span><small>Synthesised in your browser. Off until you turn it on.</small></label>
      <label class="switch" data-needs="vibrate"><input type="checkbox" role="switch" name="haptics"><span>Vibration</span><small>A short tap when reels stop and cards land. Phones only.</small></label>
    </div>
    <label class="field">
      <span>Daily time limit</span>
      <select name="limit">
        <option value="0">No limit</option>
        <option value="30">30 minutes</option>
        <option value="60">1 hour</option>
        <option value="120">2 hours</option>
        <option value="240">4 hours</option>
      </select>
      <small>When you reach it, games pause until midnight. You can lower a limit at once. A higher limit starts tomorrow.</small>
    </label>
    <p class="settings__note">A break reminder appears every 30 minutes you're here.</p>
    <div class="settings__carats">
      <p>Balance: <span class="num" data-balance></span> ${esc(c.plural)}</p>
      <button type="button" class="btn btn--secondary" data-action="reset-balance">Reset to ${ctx.carats(c.startingBalance)}</button>
    </div>
    <p class="settings__more"><a href="/responsible-gaming/">More tools: take a break for a day, a week or a month</a></p>
  </form>
</dialog>

<dialog id="reality-check" class="sheet-dialog" aria-labelledby="rc-title" aria-describedby="rc-body">
  <div class="rc">
    <p class="eyebrow">Break reminder</p>
    <h2 id="rc-title">You've been here <span data-rc-time>30 minutes</span></h2>
    <p id="rc-body">This session you've staked <span class="num" data-rc-staked>0</span> ${esc(c.plural)} and had <span class="num" data-rc-returned>0</span> back. Your balance is <span class="num" data-balance></span>.</p>
    <div class="rc__actions">
      <button type="button" class="btn btn--primary" data-rc="break">Take a 5-minute break</button>
      <button type="button" class="btn btn--secondary" data-rc="continue">Keep playing</button>
    </div>
    <p><a href="/responsible-gaming/">Set a daily limit or take a longer break</a></p>
  </div>
</dialog>

<dialog id="confirm" class="sheet-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
  <form method="dialog">
    <h2 id="confirm-title"></h2>
    <p id="confirm-body"></p>
    <div class="confirm__actions">
      <button class="btn btn--primary" value="yes"></button>
      <button class="btn btn--secondary" value="no" autofocus></button>
    </div>
  </form>
</dialog>

<dialog id="consent" class="sheet-dialog" aria-labelledby="consent-title">
  <form method="dialog" class="consent-manage">
    <header class="dialog__head">
      <h2 id="consent-title">Cookie settings</h2>
      <button class="icon-btn" value="close" aria-label="Close cookie settings">${icons.close}</button>
    </header>
    <p>We use storage on your device to run the games. That's always on, because the site can't work without it. Anything else is off until you switch it on.</p>
    <div class="switches">
      <label class="switch is-locked"><input type="checkbox" role="switch" checked disabled><span>Strictly necessary</span><small>Your balance, age answer, settings, limits and this choice. Kept on your device.</small></label>
      ${ctx.cfg.analytics?.ga4
        ? '<label class="switch"><input type="checkbox" role="switch" name="analytics"><span>Analytics</span><small>Google Analytics 4 counts visits and which games are played. Sets _ga cookies.</small></label>'
        : '<p class="switch is-off"><span>Analytics</span><small>Not in use. We don\'t run any analytics at the moment.</small></p>'}
      ${ctx.cfg.analytics?.adsConversionId
        ? '<label class="switch"><input type="checkbox" role="switch" name="ads"><span>Advertising measurement</span><small>Google Ads tells us whether an advert led to a visit. Sets Google Ads cookies.</small></label>'
        : ''}
    </div>
    <div class="consent__actions">
      <button type="button" class="btn btn--secondary" data-consent="reject">Reject all</button>
      <button type="button" class="btn btn--secondary" data-consent="save">Save choices</button>
      <button type="button" class="btn btn--secondary" data-consent="accept">Accept all</button>
    </div>
    <p class="fine">Read the <a href="/cookies/">cookie policy</a>. You can change your mind at any time from the footer.</p>
  </form>
</dialog>

${ctx.analyticsOn
    ? html`<section class="consent-banner" aria-labelledby="cb-title" hidden>
  <h2 id="cb-title" class="visually-hidden">Cookie choices</h2>
  <p>We'd like to use ${ctx.cfg.analytics.adsConversionId ? 'Google Analytics and Google Ads measurement' : 'Google Analytics'} to see how the site is used. ${ctx.cfg.analytics.adsConversionId ? 'They set' : 'It sets'} cookies, and nothing loads unless you say yes. <a href="/cookies/">Cookie policy</a></p>
  <div class="consent__actions">
    <button type="button" class="btn btn--secondary" data-consent="reject">Reject all</button>
    <button type="button" class="btn btn--secondary" data-open="consent">Manage</button>
    <button type="button" class="btn btn--secondary" data-consent="accept">Accept all</button>
  </div>
</section>`
    : ''}

<div class="toast" popover="manual" id="toast" role="status"></div>
<p id="announcer" class="visually-hidden" aria-live="polite"></p>`;
}

const SPECULATION = JSON.stringify({
  prerender: [{ where: { href_matches: '/games/*' }, eagerness: 'moderate' }],
  prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/games/*' } }] }, eagerness: 'conservative' }],
});

export function layout(ctx, page) {
  const v = ASSET_VERSION.value;
  const url = ctx.origin + page.path;
  const ogImage = ctx.origin + (page.ogImage || '/assets/img/og-home.png');
  const ld = [...(page.jsonld || [])];
  if (page.breadcrumbs?.length) ld.push(breadcrumbLd(ctx, page.breadcrumbs));
  const modules = page.modules || [];
  const robots = page.noindex ? '<meta name="robots" content="noindex">' : '';

  return html`<!doctype html>
<html lang="en-GB" data-page="${page.id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp(ctx)}">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.canonical === false ? '' : `<link rel="canonical" href="${url}">`}
${robots}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="${ctx.cfg.themeColor.light}">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${ctx.cfg.themeColor.dark}">
${(page.preloadFonts || ['archivo', 'radio-canada']).map((f) => `<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`)}
<link rel="stylesheet" href="/assets/css/site.css?v=${v}">
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
<a class="skip" href="#main">Skip to content</a>
${masthead(ctx, page)}
<main id="main" tabindex="-1">
${breadcrumbs(page.breadcrumbs)}
${page.body}
</main>
${footer(ctx)}
${dock(ctx, page)}
${dialogs(ctx)}
<noscript><p class="noscript">The games need JavaScript. The rules, paytables and policies on this site all work without it.</p></noscript>
</body>
</html>
`;
}
