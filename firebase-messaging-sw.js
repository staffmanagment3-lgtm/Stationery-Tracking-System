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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background notification:', payload);
  const notificationTitle = payload.notification?.title || 'Stationery Tracker System';
  const notificationOptions = {
    body: payload.notification?.body || 'New notification update',
    icon: 'school.png',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
