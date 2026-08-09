/* SIAPTAH service worker.
 * Deliberately conservative: this is an authenticated, data-heavy app, so API
 * responses are never cached. Only static assets are cached, plus an offline
 * fallback page for navigations.
 */
// Bump this whenever cached assets must be discarded — `activate` deletes every
// cache whose key is not the current one.
const CACHE = 'siaptah-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/* ------------------------------------------------------------------ *
 * Web Push — notifications for new/updated pengajuan.
 * The payload is JSON produced by `src/server/push/notify.ts`.
 * ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // A push service test payload, or a future sender that posts plain text.
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'SIAPTAH';
  const url = payload.url || '/app';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Repeated events about the same pengajuan replace each other instead of
      // stacking up on the lock screen.
      tag: payload.tag || 'siaptah',
      renotify: Boolean(payload.tag),
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || '/app',
    self.location.origin
  ).href;

  // Focus an open tab of the app if there is one — opening a second window for
  // an app people keep open all day is the wrong behaviour.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ('focus' in client) {
            if ('navigate' in client && client.url !== targetUrl) {
              return client.navigate(targetUrl).then((navigated) =>
                navigated ? navigated.focus() : client.focus()
              );
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API / auth traffic — it is user-scoped and changes constantly.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: always go to the network, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static assets: serve from cache, refresh in the background.
  //
  // The refresh is the point. Cache-first *without* it pins the first copy of
  // every icon and logo forever — replacing public/icon-192.png or a logo would
  // never reach anyone who had already loaded the old one, because the filename
  // never changes. So always re-fetch, and update the cache for the next load.
  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fresh = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            // Offline: the cached copy is better than nothing.
            .catch(() => cached);

          return cached || fresh;
        })
      )
    );
  }
});
