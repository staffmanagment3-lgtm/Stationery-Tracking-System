/* Stationery Tracker - single Service Worker (offline cache + background push).
   IMPORTANT: only ONE service worker may control this scope. The old setup registered
   both sw.js and firebase-messaging-sw.js on the same scope, so they replaced each other. */
const CACHE_NAME = 'stationery-app-v2.4.2';

try {
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyC34JvIlqAC0Rqb9wBIed3kNdvrEpy16P8",
    authDomain: "stationery-control-system.firebaseapp.com",
    databaseURL: "https://stationery-control-system-default-rtdb.firebaseio.com",
    projectId: "stationery-control-system",
    storageBucket: "stationery-control-system.firebasestorage.app",
    messagingSenderId: "342613102896",
    appId: "1:342613102896:web:5ddd185f3d2085661278f5"
  });

  const messaging = firebase.messaging();

  // Server sends DATA-ONLY messages, so we build the notification here (shown even if app is closed).
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return; // browser already displays notification-type messages
    const d = payload.data || {};
    return self.registration.showNotification(d.title || 'Stationery Tracker', {
      body: d.body || 'You have a new update.',
      icon: 'school.png',
      badge: 'school.png',
      tag: d.eventKey || undefined,
      renotify: !!d.eventKey,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: d.url || './index.html', eventKey: d.eventKey || '' }
    });
  });
} catch (e) {
  console.warn('[sw] Firebase messaging not available (offline?):', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './index.html', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

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
      .catch(() => caches.match(event.request))
  );
});
