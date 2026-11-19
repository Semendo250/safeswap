const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Firebase is large, so it is only downloaded when push notifications are actually needed
// (after the person has allowed notifications, or when they tap the button to turn them on).
let firebasePromise = null;
function loadFirebase() {
  if (!firebasePromise) {
    firebasePromise = Promise.all([import('firebase/app'), import('firebase/messaging')])
      .then(([appModule, messagingModule]) => ({
        app: appModule.initializeApp(firebaseConfig),
        getMessaging: messagingModule.getMessaging,
        getToken: messagingModule.getToken,
        onMessage: messagingModule.onMessage,
        isSupported: messagingModule.isSupported,
      }))
      .catch((err) => {
        firebasePromise = null; // allow another try, e.g. after the connection comes back
        throw err;
      });
  }
  return firebasePromise;
}

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

// In production the PWA service worker (which includes the Firebase push handlers)
// is the one registration for the site, so reuse it. In dev there is no PWA worker,
// and if it isn't ready in time, fall back to registering the Firebase worker directly.
async function getServiceWorkerRegistration() {
  if (import.meta.env.PROD) {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (ready) return ready;
  }
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
}

// Foreground messages (app open and focused) don't trigger the service worker's
// background handler, so the bell count is bumped directly instead of showing
// an OS notification, because the person is already looking at the app.
// Listeners can be added before notifications are allowed; they start receiving as soon as
// Firebase is loaded, which happens once permission is granted.
const foregroundListeners = new Set();
let foregroundStarted = false;

async function startForeground() {
  if (foregroundStarted) return;
  foregroundStarted = true;
  try {
    const { app, getMessaging, onMessage, isSupported } = await loadFirebase();
    if (!(await isSupported())) return;
    onMessage(getMessaging(app), (payload) => {
      foregroundListeners.forEach((callback) => {
        try {
          callback(payload);
        } catch (err) {
          console.error('Foreground message handler failed:', err.message);
        }
      });
    });
  } catch (err) {
    foregroundStarted = false;
    console.error('Foreground notifications setup failed:', err.message);
  }
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

    const { app, getMessaging, getToken, isSupported } = await loadFirebase();
    const supported = await isSupported();
    if (!supported) return null;

    const registration = await getServiceWorkerRegistration();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (token) startForeground();
    return token || null;
  } catch (err) {
    console.error('Push notification setup failed:', err.message);
    return null;
  }
}

// Calls callback for every message that arrives while the app is open. Returns a function that stops it.
export async function onForegroundMessage(callback) {
  foregroundListeners.add(callback);
  if (getNotificationPermission() === 'granted') startForeground();
  return () => {
    foregroundListeners.delete(callback);
  };
}