// 996 Farms — service worker
// Strategy: cache-first for the shell; network-first for HTML so updates land fast.

const VERSION = 'v1.0.2';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

const SHELL = [
    '/',
    '/index.html',
    '/main.css',
    '/scripts.js',
    '/lang/en.json',
    '/lang/fr.json',
    '/manifest.json',
    '/images/blue-skies-logo.png',
    '/images/hero_pine.jpg',
    '/assets/favicon_io/favicon.ico',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL).catch(() => {/* ignore missing */})).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Don't cache cross-origin requests (CDN, fonts, Worker API)
    if (url.origin !== location.origin) return;

    // Network-first for HTML and JSON — keeps translations + content fresh
    const isHtml = req.headers.get('accept')?.includes('text/html');
    const isJson = url.pathname.endsWith('.json');
    if (isHtml || isJson) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('/')))
        );
        return;
    }

    // Cache-first for everything else (CSS, JS, images, video) — these rarely change
    event.respondWith(
        caches.match(req).then((cached) =>
            cached ||
            fetch(req).then((res) => {
                if (!res.ok || res.type === 'opaque') return res;
                const copy = res.clone();
                caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
                return res;
            }).catch(() => cached)
        )
    );
});
