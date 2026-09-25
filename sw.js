/* Pixel Crown Club service worker: the club keeps working offline. */
const VERSION = 'pcc-v2';
const CORE = [
  './', 'index.html', 'terms.html', 'privacy.html', 'manifest.webmanifest', 'favicon.svg',
  'assets/css/site.css',
  'assets/js/config.js', 'assets/js/core.js', 'assets/js/fx.js', 'assets/js/app.js', 'assets/js/club.js',
  'assets/js/integrations.js', 'assets/js/crown.js', 'assets/js/reels.js', 'assets/js/wheel.js', 'assets/js/blackjack.js',
  'assets/fonts/instrument-sans-latin.woff2', 'assets/fonts/pixelify-sans-latin.woff2', 'assets/fonts/silkscreen-latin.woff2',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Pages: network first so updates show up, cache as the offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Assets: cache first, refreshed in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
