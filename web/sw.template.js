// Production service worker with build-hash cache busting.
// The BUILD_HASH placeholder is replaced by the GitHub Actions deploy workflow.
const CACHE_PREFIX = 'app-cache-'; // unique to this app (origin may be shared)
const CACHE_NAME = CACHE_PREFIX + 'BUILD_HASH';

self.addEventListener('install', () => {
  self.skipWaiting();
});

// Cache write: caller must pass it to event.waitUntil so the worker is not
// stopped before the store completes. Failures (quota...) are swallowed.
function cacheCopy(request, response) {
  return caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, response))
    .catch(() => {});
}

self.addEventListener('fetch', (event) => {
  // Only same-origin GETs are handled: the Cache API cannot store POST
  // requests, and cross-origin responses (cloud provider APIs) carry user
  // data that must not be persisted.
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          event.waitUntil(cacheCopy(event.request, networkResponse.clone()));
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline fallback: serve the cached copy when there is one, else a
        // real error response — never undefined (respondWith would throw).
        return (await caches.match(event.request)) ?? Response.error();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});