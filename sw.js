const CACHE_NAME = 'stationery-app-v1.1.5';
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
  const reqUrl = event.request.url;
  // Bypass Service Worker for Google Apps Script, Firebase, and external APIs
  if (reqUrl.includes('script.google.com') || reqUrl.includes('firebaseio.com') || reqUrl.includes('googleapis.com')) {
    return; // Let the browser make a direct network request
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => fetch(event.request))
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
