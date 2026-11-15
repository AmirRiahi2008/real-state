/* Only this public offline shell is cached. API, HTML and RSC responses remain network-only. */
const CACHE_PREFIX = 'oriva-pwa-';
// Bump this version when changing the offline shell or its icons.
const SHELL_CACHE = `${CACHE_PREFIX}v1`;
const SHELL_FILES = [
  '/offline/en.html',
  '/offline/ar.html',
  '/offline/offline.css',
  '/offline/offline.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(
          SHELL_FILES.map((path) => new Request(path, { cache: 'reload', credentials: 'omit' })),
        ),
      ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  // A new worker takes over only after a visitor explicitly accepts the update.
  if (
    event.data?.type === 'SKIP_WAITING' &&
    event.source?.type === 'window' &&
    new URL(event.source.url).origin === self.location.origin
  ) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never turn a failed API request into a successful offline HTML response.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const locale = /^\/ar(?:\/|$)/.test(url.pathname) ? 'ar' : 'en';
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(`/offline/${locale}.html`)) || Response.error();
      }),
    );
    return;
  }

  // An explicit allowlist prevents caching uploads, private images, or session data.
  if (url.search || !SHELL_FILES.includes(url.pathname)) return;
  event.respondWith(
    caches
      .open(SHELL_CACHE)
      .then(async (cache) => (await cache.match(url.pathname)) || fetch(request)),
  );
});
