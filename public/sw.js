/* ============================================================
   Service Worker – TikTok Live TTS PWA
   Handles caching, offline support, and background operation
   ============================================================ */
const CACHE_NAME = 'live-tts-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json'
];

/* ---------- Install: precache core assets ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/* ---------- Activate: clean old caches ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ---------- Fetch: network-first with cache fallback ---------- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Don't cache API calls or WebSocket upgrades */
  if (url.pathname.startsWith('/api/') || event.request.headers.get('upgrade') === 'websocket') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
  );
});

/* ---------- Push Notifications ---------- */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'TikTok Live TTS';
  const options = {
    body: data.body || 'New activity on your live stream',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: data.actions || []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- Notification click ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

/* ---------- Background sync (keep alive) ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'keepalive') {
    /* Acknowledge to keep the SW active */
    event.source.postMessage('alive');
  }
});
