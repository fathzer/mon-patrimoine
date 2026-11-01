// Development service worker: fetch from the network, never cache.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Cross-origin calls (cloud provider APIs...) are left to the browser:
  // re-dispatching them here would only add console noise on failure.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // Network only: do not store any response in the cache. The catch turns a
  // rejected fetch into a proper error response for the page.
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
