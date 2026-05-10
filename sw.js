/* ══════════════════════════════════════════════
   Proxo App — Service Worker
   Cache Strategy: Cache First + Network Fallback
   ══════════════════════════════════════════════ */

var CACHE_NAME = 'proxo-cache-v1';
var STATIC_ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://raw.githubusercontent.com/Zana-Sponsor/Zana-Sponsor/main/Rabar_021.woff2'
];

// ════ Install — پاشەکەوتکردنی فایلە ئیستاتیکەکان ════
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.filter(function(u) {
        return !u.startsWith('http'); // تەنها فایلە لۆکاڵەکان پاشەکەوت بکە
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ════ Activate — پاکردنەوەی کاچی کۆن ════
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ════ Fetch Strategy ════
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  var method = e.request.method;

  // تەنها GET requests
  if (method !== 'GET') return;

  // Supabase / Firebase / Telegram — هەرگیز cache ناکرێن
  if (url.includes('supabase.co') ||
      url.includes('firebaseio.com') ||
      url.includes('api.telegram.org') ||
      url.includes('firebasedatabase.app') ||
      url.includes('fbevents.js') ||
      url.includes('connect.facebook.net')) {
    return;
  }

  // فۆنتەکان — Cache First (نادەگۆڕێن)
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('Rabar_021.woff2')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          return res;
        }).catch(function() { return new Response('', {status: 503}); });
      })
    );
    return;
  }

  // Font Awesome / CDN static assets — Cache First
  if (url.includes('cdnjs.cloudflare.com') ||
      url.includes('cdn.jsdelivr.net') ||
      url.includes('gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          }
          return res;
        }).catch(function() { return cached || new Response('', {status: 503}); });
      })
    );
    return;
  }

  // وێنەی image2url.com — Cache First (بانەرەکان)
  if (url.includes('image2url.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          }
          return res;
        }).catch(function() { return new Response('', {status: 503}); });
      })
    );
    return;
  }

  // هەموو ئەوانی دیکە — Network First
  e.respondWith(
    fetch(e.request).then(function(res) {
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('بێ ئینتەرنێت', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
