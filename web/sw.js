// Development service worker: fetch from the network, never cache.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network only: do not store any response in the cache.
  event.respondWith(fetch(event.request));
});
