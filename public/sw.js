const CACHE_NAME = 'ficup-static-v1';

const STATIC_ICON_URLS = [
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './apple-touch-icon.png',
];

const IMMUTABLE_ASSET_EXT = /\.(js|css|woff|woff2|svg|png|jpg|jpeg|webp)$/i;
const ICON_FILE_PATTERN = /\/(pwa-192x192\.png|pwa-512x512\.png|pwa-maskable-512x512\.png|apple-touch-icon\.png|favicon\.ico)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          STATIC_ICON_URLS.map((assetUrl) =>
            cache.add(new Request(assetUrl, { cache: 'reload' }))
          )
        )
      )
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((obsoleteKey) => caches.delete(obsoleteKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET requests (POST/PUT/DELETE/etc.)
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle HTTP(S)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // SECURITY: Never intercept cross-origin traffic (Firebase Auth, Firestore,
  // Google Sign-In, Apps Script, Google APIs, external images, fonts).
  if (url.origin !== self.location.origin) {
    return;
  }

  // SECURITY: Never intercept Firebase Auth reserved handlers, API routes,
  // authenticated requests, Service Worker script, or Web App Manifest.
  if (
    url.pathname.startsWith('/__/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api/') ||
    request.headers.has('authorization') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.endsWith('/manifest.webmanifest')
  ) {
    return;
  }

  // FRESHNESS & SAFETY: Never cache HTML documents or navigations.
  // Always let the network serve the latest index.html without fake offline data.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.endsWith('.html')
  ) {
    return;
  }

  // Cache-First ONLY for Vite content-hashed static assets (excluding large media/JSON)
  if (url.pathname.includes('/assets/') && IMMUTABLE_ASSET_EXT.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone()).catch(() => undefined);
        }
        return networkResponse;
      })
    );
    return;
  }

  // Network-First for unhashed static PWA icon assets only
  if (ICON_FILE_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone()).catch(() => undefined);
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          throw new Error('Network unavailable for icon');
        }
      })
    );
  }
});
