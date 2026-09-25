// Cookie consent and Google Consent Mode v2.
// Every consent signal starts as "denied". No Google script is requested
// until the visitor says yes, and nothing optional exists unless it's
// configured in site.config.json.
import config from '../config.js';
import { store } from './store.js';
import { toast } from './ui.js';

const { ga4, adsConversionId } = config.analytics || {};
const configured = Boolean(ga4 || adsConversionId);
const MAX_AGE = 365 * 24 * 3600 * 1000;
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

function apply(choice, { fromUser = false } = {}) {
  const wasOn = current.analytics || current.ads;
  current = { analytics: Boolean(ga4 && choice.analytics), ads: Boolean(adsConversionId && choice.ads) };
  if (!configured) return;
  gtag('consent', 'update', {
    analytics_storage: current.analytics ? 'granted' : 'denied',
    ad_storage: current.ads ? 'granted' : 'denied',
    ad_user_data: current.ads ? 'granted' : 'denied',
    ad_personalization: 'denied',
  });
  if (current.analytics || current.ads) loadTag();
  else if (wasOn && fromUser) {
    clearGoogleCookies();
    toast('Done. Analytics are off and their cookies have been removed.');
  }
}

function save(choice) {
  store.set('consent', { v: 1, analytics: Boolean(choice.analytics), ads: Boolean(choice.ads), at: Date.now() });
  apply(choice, { fromUser: true });
  document.querySelector('.consent-banner')?.setAttribute('hidden', '');
}

/** Send a game event, only ever after consent. */
export function track(name, params = {}) {
  if (current.analytics && loaded) gtag('event', name, params);
}

export function startConsent() {
  const dialog = document.getElementById('consent');
  const banner = document.querySelector('.consent-banner');
  const saved = store.get('consent', null);
  const valid = saved && saved.v === 1 && Date.now() - saved.at < MAX_AGE;
  if (valid) apply(saved);
  else if (configured && banner) banner.hidden = false;

  const syncSwitches = () => {
    const s = store.get('consent', null) || {};
    dialog?.querySelectorAll('input[name]').forEach((i) => (i.checked = Boolean(s[i.name])));
  };

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open="consent"]');
    if (opener && dialog) {
      syncSwitches();
      dialog.showModal();
      return;
    }
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const kind = b.dataset.consent;
    if (kind === 'accept') save({ analytics: true, ads: true });
    if (kind === 'reject') save({ analytics: false, ads: false });
    if (kind === 'save') {
      const read = (n) => Boolean(dialog?.querySelector(`input[name="${n}"]`)?.checked);
      save({ analytics: read('analytics'), ads: read('ads') });
    }
    if (dialog?.open) dialog.close();
    if (!configured) toast('Saved. There’s nothing optional to switch on at the moment.');
  });
}
