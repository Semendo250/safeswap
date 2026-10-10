// This file must be plain JS at the site root (not bundled by Vite), since
// Firebase's push system fetches it directly as a browser Service Worker.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Public config — safe to hardcode here, same values already visible in the
// frontend bundle. A service worker cannot read Vite's import.meta.env.
firebase.initializeApp({
  apiKey: 'AIzaSyDCnEi_RIX8gob-2psm3JE3nnnybm0uVW8',
  authDomain: 'safeswap-a703f.firebaseapp.com',
  projectId: 'safeswap-a703f',
  storageBucket: 'safeswap-a703f.firebasestorage.app',
  messagingSenderId: '551763885355',
  appId: '1:551763885355:web:111208435cb4cac0a2596e',
});

const messaging = firebase.messaging();

// Background message handler: shows the OS-level notification when the app
// isn't the focused tab. Foreground messages are handled separately in app.js.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'SafeSwap';
  const body = payload.notification?.body || '';
  const link = payload.data?.link || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon-s.svg',
    data: { link },
  });
});

// Tapping the OS notification opens (or focuses) the app at the right page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});