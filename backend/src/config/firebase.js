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

// Reads the current permission without asking for anything.
// Returns 'unsupported' | 'default' | 'granted' | 'denied'
export function getNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
}

// iPhone/iPad Safari only supports push for sites added to the Home Screen
export function needsHomeScreenInstall() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  return ios && !standalone;
}

// Gets a device token to register with the backend.
//
// By default this is SILENT: it only returns a token if the person has already allowed
// notifications, and never shows a prompt. Phones (Android Chrome in particular) ignore
// permission prompts that don't come from a tap, so the prompt is only shown when this is
// called with { prompt: true } from a button press.
//
// Returns null when unsupported, not allowed, or on any error.
export async function requestPushToken({ prompt = false } = {}) {
  try {
    if (getNotificationPermission() === 'unsupported') return null;

    let permission = Notification.permission;
    if (permission === 'default' && prompt) {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return null;

    const supported = await isSupported();
    if (!supported) return null;

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