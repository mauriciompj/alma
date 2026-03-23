/**
 * ALMA Service Worker — Offline support + caching
 * Caches static assets (HTML, CSS, JS) for offline access.
 * API calls always go to network (never cached).
 */

const CACHE_NAME = 'alma-v4';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/chat.html',
  '/index.html',
  '/sobre.html',
  '/css/style.css',
  '/js/alma.js',
  '/js/i18n.js',
  '/locales/pt-BR.json',
  '/locales/en.json',
  '/locales/es.json',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API calls: always network (never cache)
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) {
    return; // Let browser handle normally
  }

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful GET responses
        if (response.ok && event.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback: return login page
      if (event.request.mode === 'navigate') {
        return caches.match('/login.html');
      }
    })
  );
});
