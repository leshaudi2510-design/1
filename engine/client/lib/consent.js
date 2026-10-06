// Cookie consent and Google Consent Mode v2.
// Every consent signal starts as "denied". No Google script is requested
// until the visitor says yes, and nothing optional exists unless it's
// configured in site.config.json.
//
// The Pragmatic Play demos set cookies of their own once they load. Pressing
// Play loads one (the caption beside the button says so). The stored choice
// also records `demos`: false after "Reject all", true after "Accept all",
// and "Save choices" keeps what it was. After "Reject all", each Play button
// asks before it loads a demo (assets/js/games/pragmatic.js).
import config from '../config.js';
import { store } from './store.js';
import { toast } from './ui.js';

const { ga4, adsConversionId } = config.analytics || {};
const configured = Boolean(ga4 || adsConversionId);
const demosOn = Boolean(config.pragmatic?.enabled);
const MAX_AGE = 365 * 24 * 3600 * 1000;
const validChoice = (saved) => Boolean(saved && saved.v === 1 && Date.now() - saved.at < MAX_AGE);
let loaded = false;
let current = { analytics: false, ads: false };

window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}

if (configured) {
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'denied',
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
}

function loadTag() {
  if (loaded) return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4 || adsConversionId)}`;
  document.head.append(s);
  gtag('js', new Date());
  if (ga4) gtag('config', ga4);
  if (adsConversionId) gtag('config', adsConversionId);
}

function clearGoogleCookies() {
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (!/^(_ga|_gid|_gcl_)/.test(name)) continue;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}

/** Apply a choice. True if analytics were switched off and their cookies removed. */
function apply(choice, { fromUser = false } = {}) {
  const wasOn = current.analytics || current.ads;
  current = { analytics: Boolean(ga4 && choice.analytics), ads: Boolean(adsConversionId && choice.ads) };
  if (!configured) return false;
  gtag('consent', 'update', {
    analytics_storage: current.analytics ? 'granted' : 'denied',
    ad_storage: current.ads ? 'granted' : 'denied',
    ad_user_data: current.ads ? 'granted' : 'denied',
    ad_personalization: 'denied',
  });
  if (current.analytics || current.ads) loadTag();
  else if (wasOn && fromUser) {
    clearGoogleCookies();
    return true;
  }
  return false;
}

/** The choice now in force, in words: "Saved. Analytics are off." */
function describe() {
  const parts = [];
  if (ga4) parts.push({ name: 'analytics', on: current.analytics, verb: 'are' });
  if (adsConversionId) parts.push({ name: 'advertising measurement', on: current.ads, verb: 'is' });
  if (!parts.length) return 'Saved.';
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  const state = (on) => (on ? 'on' : 'off');
  if (parts.every((p) => p.on === parts[0].on)) {
    const verb = parts.length > 1 ? 'are' : parts[0].verb;
    return `Saved. ${cap(parts.map((p) => p.name).join(' and '))} ${verb} ${state(parts[0].on)}.`;
  }
  return `Saved. ${parts.map((p, i) => `${i ? p.name : cap(p.name)} ${p.verb} ${state(p.on)}`).join('; ')}.`;
}

/** Store a choice, apply it and hide the banner. True if analytics cookies were removed. */
function save(choice) {
  const before = store.get('consent', null);
  const demos = typeof choice.demos === 'boolean' ? choice.demos : before?.demos;
  store.set('consent', { v: 1, analytics: Boolean(choice.analytics), ads: Boolean(choice.ads), ...(typeof demos === 'boolean' ? { demos } : {}), at: Date.now() });
  const cleared = apply(choice, { fromUser: true });
  const banner = document.querySelector('.consent-banner');
  if (banner) banner.hidden = true;
  syncClearance();
  return cleared;
}

// The banner is fixed to the bottom of the screen. While it shows, the page
// keeps focused controls clear of it (scroll-padding-bottom) and has room to
// scroll its last lines above it (extra padding under the footer), through
// html.has-cb and --cb-clear (40-dialogs.css). The clearance is measured
// from the banner's top edge: on phones the banner sits above the dock.
function syncClearance() {
  const root = document.documentElement;
  const banner = document.querySelector('.consent-banner');
  const shown = Boolean(banner && !banner.hidden);
  root.classList.toggle('has-cb', shown);
  if (!shown) return void root.style.removeProperty('--cb-clear');
  const clear = Math.ceil(innerHeight - banner.getBoundingClientRect().top + 12);
  root.style.setProperty('--cb-clear', `${Math.max(0, clear)}px`);
}

/** Send a game event, only ever after consent. */
export function track(name, params = {}) {
  if (current.analytics && loaded) gtag('event', name, params);
}

/** Did the visitor choose "Reject all" (within the last 12 months)? Then a demo asks before it loads. */
export function demosRefused() {
  const saved = store.get('consent', null);
  return validChoice(saved) && saved.demos === false;
}

export function startConsent() {
  const dialog = document.getElementById('consent');
  const banner = document.querySelector('.consent-banner');
  const saved = store.get('consent', null);
  const valid = validChoice(saved);
  if (valid) apply(saved);
  else if (configured && banner) banner.hidden = false;
  if (banner) {
    syncClearance();
    new ResizeObserver(() => syncClearance()).observe(banner);
    addEventListener('resize', () => syncClearance());
  }

  const syncSwitches = () => {
    const s = store.get('consent', null) || {};
    dialog?.querySelectorAll('input[name]').forEach((i) => (i.checked = Boolean(s[i.name])));
  };

  // Whether Cookie settings was last opened from the banner's Manage button.
  let fromBanner = false;
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open="consent"]');
    if (opener && dialog) {
      fromBanner = Boolean(banner?.contains(opener));
      syncSwitches();
      dialog.showModal();
      return;
    }
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const kind = b.dataset.consent;
    const read = (n) => Boolean(dialog?.querySelector(`input[name="${n}"]`)?.checked);
    const choice =
      kind === 'accept' ? { analytics: true, ads: true, demos: true } : kind === 'reject' ? { analytics: false, ads: false, demos: false } : { analytics: read('analytics'), ads: read('ads') };
    const inBanner = Boolean(banner?.contains(b)) || (fromBanner && Boolean(dialog?.contains(b)));
    // Close first, so focus and the confirmation land on the page.
    if (dialog?.open) dialog.close();
    const cleared = save(choice);
    // The banner and its buttons have gone, so focus moves to the start of
    // the content instead of falling to <body>. (Opened from the footer's
    // "Cookie settings", the dialog has put focus back on that button.)
    if (inBanner) document.getElementById('main')?.focus({ preventScroll: true });
    // With the demos on, "Reject all" and "Accept all" change whether a demo asks first.
    if (!configured) toast(demosOn ? 'Saved.' : 'Saved. There’s nothing optional to switch on at the moment.');
    else toast(cleared ? 'Done. Analytics are off and their cookies have been removed.' : describe());
  });
}
