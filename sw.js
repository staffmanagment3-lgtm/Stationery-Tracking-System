const CACHE_NAME = 'stationery-app-v1.7.6';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'school.png',
  'https://unpkg.com/html5-qrcode',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Deleting old Service Worker Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 1. Bypass non-GET requests and all external domains (Google Drive, Firebase, etc.)
    if (event.request.method !== 'GET' ||
        requestUrl.origin !== location.origin ||
        requestUrl.hostname.includes('google') ||
        requestUrl.hostname.includes('firebase') ||
        requestUrl.hostname.includes('via.placeholder.com')) {
        return; // Allow native browser fetch without SW interception
    }

    // 2. Handle local assets with Network-First, Cache-Fallback strategy
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: 'school.png',
    badge: 'school.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
