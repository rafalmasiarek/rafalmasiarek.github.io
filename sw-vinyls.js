// sw-vinyls.js
// Cache-first for cover images, stale-while-revalidate for API JSON.

const SW_VERSION = 'v1.0.0';
const IMG_CACHE = 'vinyl-img-' + SW_VERSION;
const API_CACHE = 'vinyl-api-' + SW_VERSION;

const isImage = (url) =>
    /\.(png|jpe?g|webp|avif|gif)(\?.*)?$/i.test(url) || url.includes('i.discogs.com');
const isVinylApi = (url) =>
    /\/api\/v1\/vinyls(\/|$)/.test(new URL(url, self.location).pathname);

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names.filter(n => ![IMG_CACHE, API_CACHE].includes(n))
                .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET') return;

    if (isImage(url.href)) {
        event.respondWith((async () => {
            const cache = await caches.open(IMG_CACHE);
            const cached = await cache.match(req, { ignoreVary: true });
            if (cached) {
                event.waitUntil((async () => {
                    try {
                        const fresh = await fetch(req, { mode: 'no-cors' });
                        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
                    } catch { }
                })());
                return cached;
            }
            try {
                const net = await fetch(req);
                if (net && net.ok) cache.put(req, net.clone());
                return net;
            } catch {
                return caches.match(req) || Response.error();
            }
        })());
        return;
    }

    if (isVinylApi(url.href)) {
        event.respondWith((async () => {
            const cache = await caches.open(API_CACHE);
            const cached = await cache.match(req);
            const networkFetch = fetch(req).then(res => {
                if (res && res.ok) cache.put(req, res.clone());
                return res;
            }).catch(() => null);
            return cached || networkFetch || Response.error();
        })());
        return;
    }
});