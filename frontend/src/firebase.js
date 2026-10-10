import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const app = initializeApp(firebaseConfig);

// Asks the browser for notification permission (if not already decided) and,
// if granted, returns a device token to register with the backend.
// Returns null on unsupported browsers (e.g. iOS Safari not installed as a
// PWA) or if the person denies/ignores the permission prompt.
export async function requestPushToken() {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    return token || null;
  } catch (err) {
    console.error('Push notification setup failed:', err.message);
    return null;
  }
}

// Foreground messages (app open and focused) don't trigger the service worker's
// background handler, so the bell count is bumped directly instead of showing
// an OS notification — the person is already looking at the app.
export async function onForegroundMessage(callback) {
  const supported = await isSupported();
  if (!supported) return () => {};
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}