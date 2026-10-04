/* Stationery Tracker - offline cache. Loaded by OneSignalSDKWorker.js (the ONE worker for this scope). */
const CACHE_NAME = 'stationery-app-v2.6.0';

/* Push notifications are handled by OneSignal (OneSignalSDKWorker.js loads the OneSignal SDK and then this file). */

const ASSETS = [
  'index.html',
  'style.css',
  'login-waterdrop.css',
  'app.js',
  'school.png',
  'school-logo.png',
  'manifest.json',
  'https://unpkg.com/html5-qrcode',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(ASSETS.map((u) => cache.add(u).catch(() => {})));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET' ||
      requestUrl.origin !== location.origin ||
      requestUrl.hostname.includes('google') ||
      requestUrl.hostname.includes('firebase') ||
      requestUrl.hostname.includes('via.placeholder.com')) {
    return;
  }

  // Network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('index.html').then((r) => r || Response.error());
        return Response.error();
      }))
  );
});
