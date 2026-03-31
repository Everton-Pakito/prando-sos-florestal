// SOS Prando – Service Worker v3
const CACHE = 'sos-prando-v3';
const PRECACHE = [
  '/index.html',
  '/adm.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Não intercepta chamadas externas (Apps Script, Fonts, Nominatim)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (e.request.mode === 'navigate') {
    // Navegação: tenta rede primeiro, fallback no cache
    e.respondWith(
      fetch(e.request)
        .then(r => { const c=r.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,c)); return r; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets: cache primeiro
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.status === 200) { const c=r.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,c)); }
        return r;
      });
    })
  );
});
