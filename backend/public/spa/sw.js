const CACHE_NAME = 'higo-pondok-v1';

const APP_SHELL_ASSETS = [
    '/',
    '/favicon.svg',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                APP_SHELL_ASSETS.map((url) =>
                    cache.add(new Request(url, { cache: 'reload' })).catch(() => {
                        console.warn(`[SW] Gagal cache: ${url}`);
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;
    if (request.method !== 'GET') return;

    // Network First Strategy
    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});
