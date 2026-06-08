// ══════════════════════════════════════════════════════
//  SOS Prando – Service Worker  v2.0
//  Estratégia: Cache-First para assets, Network-First
//  para requisições ao Google Apps Script (GAS)
// ══════════════════════════════════════════════════════

const CACHE_NAME    = 'sos-prando-v2';
const OFFLINE_PAGE  = '/offline.html';

// Assets que serão cacheados no install
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
  // Fonts (cacheadas em runtime via fetch handler)
];

// ── INSTALL ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Requisições ao GAS → sempre Network, sem cache
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, erro: 'Sem conexão' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // 2. Navegação (HTML) → Network-First, fallback offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match(OFFLINE_PAGE)
          )
        )
    );
    return;
  }

  // 3. Fontes Google → Cache-First (evita re-download)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        });
      })
    );
    return;
  }

  // 4. Outros assets (js, css, png, etc.) → Cache-First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return res;
      });
    })
  );
});

// ── BACKGROUND SYNC (para envio offline) ─────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-os') {
    event.waitUntil(syncPendingOS());
  }
});

async function syncPendingOS() {
  // Implementar se quiser fila offline
  // Por ora apenas notifica clientes
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' }));
}

// ── PUSH NOTIFICATIONS (preparado para TWA) ──────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOS Prando', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/')
  );
});
