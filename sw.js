/* ══════════════════════════════════════
   GreenBee Service Worker
   Offline-first: cache-first for shell,
   network-first for fonts/external
══════════════════════════════════════ */

const CACHE   = 'greenbee-v1';
const SHELL   = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/storage.js',
  '/js/app.js',
  '/js/html-notes.js',
  '/js/notes.js',
  '/js/voice.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache cross-origin requests (fonts etc) – network only
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for shell assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
