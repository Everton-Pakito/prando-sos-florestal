// SOS Prando Florestal, Service Worker PWA PRO
const CACHE_NAME = 'sos-prando-pwa-v4';
const BASE = new URL('./', self.registration.scope);
const APP_SHELL = [
  './',
  './index.html',
  './adm.html',
  './manifest.json',
  './offline.html',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-512.png'
].map(p => new URL(p, BASE).toString());
const OFFLINE_URL = new URL('./offline.html', BASE).toString();

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ ok:false, erro:'Sem conexão. Tente novamente quando a internet voltar.' }), { headers:{ 'Content-Type':'application/json' } })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return res;
    }).catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL))));
    return;
  }

  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => { const copy=res.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(request, copy)); return res; })));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(res => {
    if (!res || res.status !== 200 || res.type === 'opaque') return res;
    const copy = res.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    return res;
  }).catch(() => caches.match(OFFLINE_URL))));
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title:'SOS Prando', body:event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SOS Prando', {
    body: data.body || '',
    icon: new URL('./icons/icon-192.png', BASE).toString(),
    badge: new URL('./icons/icon-96.png', BASE).toString(),
    vibrate: [200,100,200],
    data
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL('./index.html', BASE).toString()));
});
