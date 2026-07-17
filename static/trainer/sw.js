/* The Trainer — service worker: the plan in your pocket.
   Served from /trainer-sw.js (root path) so its scope can cover /trainer.
   Strategy: network-first navigations (always fresh online, cached shell
   offline), stale-while-revalidate statics, /api/ untouched. */
const CACHE = 'trainer-v1';
const SHELL = ['/trainer', '/static/os.css', '/static/os.js',
               '/static/trainer/manifest.json',
               '/static/trainer/icon-192.png', '/static/trainer/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put('/trainer', copy));
      return r;
    }).catch(() => caches.match('/trainer')));
    return;
  }

  if (url.pathname.startsWith('/static/')) {
    e.respondWith(caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});
