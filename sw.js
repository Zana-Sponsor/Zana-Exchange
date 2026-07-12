/* ══════════════════════════════════════════════════════════════
   Proxo App — Service Worker (adds real caching for every section)
   ------------------------------------------------------------------
   What this does:
   - On first visit, it pre-caches the app shell (this HTML page) plus
     the fonts/icon/library CDN files the whole app depends on.
   - After that, static files (CSS, fonts, icons, images, the CDN
     libraries) are served instantly from cache, then quietly
     refreshed in the background ("stale-while-revalidate") — so
     every section of the app (home, create, my ads, wallet, support,
     etc.) opens instantly on repeat visits instead of re-downloading
     the same files.
   - Live data (Supabase/Firebase calls, Telegram, dynamic API
     requests) is NEVER cached — it always goes straight to the
     network, so ads, balances, and chat messages stay accurate.
   - Bump CACHE_VERSION any time you deploy new static assets so old
     caches are cleared automatically.
   ══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'proxo-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('proxo-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Never cache API / realtime / backend traffic — these must always be live.
const NEVER_CACHE = [
  'supabase.co',
  'firebaseio.com',
  'firebasedatabase.app',
  'googleapis.com/identitytoolkit',
  'api.telegram.org',
  'facebook.com',
  'fbevents'
];

function isNeverCache(url) {
  return NEVER_CACHE.some((needle) => url.includes(needle));
}

// Static, cacheable asset types: fonts, styles, scripts (CDN libs), images, icons.
function isStaticAsset(url) {
  return /\.(css|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(url) ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('font-awesome') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('gstatic.com/firebasejs');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  if (isNeverCache(url)) {
    return; // let the browser handle it normally — always network, never cached
  }

  if (req.mode === 'navigate' || APP_SHELL.some((p) => url.endsWith(p))) {
    // App shell: try the network first (so users get the latest fixes),
    // fall back to cache when offline/slow.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (isStaticAsset(url)) {
    // Stale-while-revalidate: instant from cache, refreshed quietly in background.
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
