/* Pixel Crown Club: integrations. Installable app (PWA), consent-gated analytics and social links. */
(function () {
  'use strict';

  const cfg = window.PCC_CONFIG || {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  // ---------- Installable app ----------
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure && window.top === window) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    });
  }

  let deferred = null;
  const installButtons = [...document.querySelectorAll('[data-install]')];
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    installButtons.forEach((b) => { b.hidden = false; });
  });
  installButtons.forEach((b) => b.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    if (choice && choice.outcome === 'accepted') Lounge.toast('Pixel Crown Club is on your home screen.');
    deferred = null;
    installButtons.forEach((x) => { x.hidden = true; });
  }));
  window.addEventListener('appinstalled', () => installButtons.forEach((x) => { x.hidden = true; }));

  // ---------- Analytics, only with consent ----------
  const wantsAnalytics = Boolean(cfg.ga4 || cfg.metrika);
  const banner = document.getElementById('consent');

  function loadScript(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function startAnalytics() {
    if (cfg.ga4) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4, { anonymize_ip: true });
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`);
    }
    if (cfg.metrika) {
      const id = Number(cfg.metrika);
      window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
      loadScript('https://mc.yandex.ru/metrika/tag.js');
      window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    }
    // Game events become analytics events.
    Lounge.on('result', (r) => track('game_result', { game: r.game, bet: r.bet, win: r.win }));
  }

  function track(name, params) {
    if (window.gtag && cfg.ga4) window.gtag('event', name, params);
    if (window.ym && cfg.metrika) window.ym(Number(cfg.metrika), 'reachGoal', name, params);
  }

  if (wantsAnalytics && banner) {
    const choice = store.get('pcc.consent');
    if (choice === 'yes') startAnalytics();
    else if (!choice) banner.hidden = false;
    document.getElementById('consent-yes').addEventListener('click', () => {
      store.set('pcc.consent', 'yes'); banner.hidden = true; startAnalytics();
    });
    document.getElementById('consent-no').addEventListener('click', () => {
      store.set('pcc.consent', 'no'); banner.hidden = true;
    });
  }
  document.querySelectorAll('[data-analytics-only]').forEach((el) => { el.hidden = !wantsAnalytics; });

  // ---------- Social links ----------
  const socials = document.getElementById('socials');
  if (socials) {
    const links = [['telegram', 'Telegram'], ['instagram', 'Instagram'], ['x', 'X']].filter(([k]) => cfg[k]);
    socials.innerHTML = links.map(([k, label]) => `<a href="${encodeURI(cfg[k])}" target="_blank" rel="noopener">${label}</a>`).join('');
    socials.hidden = !links.length;
  }
})();
