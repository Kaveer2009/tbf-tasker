// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Use same config as frontend
firebase.initializeApp({
  apiKey: "AIzaSyCUVdzmmeLUyVICm36khJVF38lMpMPk1qE",
  authDomain: "employee-track-1.firebaseapp.com",
  projectId: "employee-track-1",
  storageBucket: "employee-track-1.firebasestorage.app",
  messagingSenderId: "1055796115720",
  appId: "1:1055796115720:web:00c66aef9af126b83b94bd"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'Notification';
  const options = {
    body: payload.notification?.body,
    data: payload.data || {},
    requireInteraction: false
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification?.data?.click_action || '/'));
});
