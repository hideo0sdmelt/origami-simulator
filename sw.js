/* Offline support.
   - The page itself: network first, so a new version on GitHub Pages shows up on the next open.
     Falls back to the cached copy when offline.
   - Other files of this site (icons, manifest): cache first.
   - Google Fonts: served from cache, refreshed in the background.
   Bump VERSION when icons or the list below change. */
const VERSION = 'v1';
const CACHE = 'origami-' + VERSION;
const FONTS = 'origami-fonts';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {}); return res; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await withTimeout(fetch(req), 5000);
        if (res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
