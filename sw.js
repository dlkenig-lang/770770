// =============================================
// Service Worker — offline-tolerant app shell
// Strategy:
//  - Supabase / HIBP API calls: network only (never cached — live data).
//  - Navigations (index.html): network first, cached shell as offline fallback.
//  - Static assets (same-origin js/css/images + jsdelivr CDN):
//    stale-while-revalidate — served instantly from cache, refreshed in
//    the background. Files are cache-busted with ?v= so updates propagate.
// =============================================

const CACHE = 'qc-pods-v1';
const SHELL_KEY = 'app-shell';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Live data — always straight to the network
  if (url.hostname.endsWith('.supabase.co') || url.hostname === 'api.pwnedpasswords.com') return;

  // Page navigations: network first, offline fallback to the cached shell
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        cache.put(SHELL_KEY, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await cache.match(SHELL_KEY);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // Static assets: same origin or the pinned CDN only
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !isCdn) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
