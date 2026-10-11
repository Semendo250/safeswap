let firebaseApp = null;
let warned = false;

function warnOnce(message) {
  if (warned) return;
  warned = true;
  console.warn(message);
}

// Accepts the service account as raw JSON, JSON wrapped in quotes, or base64-encoded JSON
function parseServiceAccount(raw) {
  let text = String(raw).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  if (!text.startsWith('{')) {
    text = Buffer.from(text, 'base64').toString('utf8');
  }
  const serviceAccount = JSON.parse(text);
  // Keys pasted into env vars often have escaped newlines; turn them back into real ones
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return serviceAccount;
}

// Returns the initialised Firebase Admin app, or null when Firebase isn't configured.
// Push notifications are optional: a missing or invalid key must never stop the server
// or break the action that triggered a notification.
function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    warnOnce('FIREBASE_SERVICE_ACCOUNT is not set: push notifications are disabled');
    return null;
  }

  try {
    // Loaded here (not at the top of the file) so a missing package can't crash the server
    const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
    const serviceAccount = parseServiceAccount(raw);
    firebaseApp = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount) });
    console.log('Firebase Admin initialised for project:', serviceAccount.project_id);
    return firebaseApp;
  } catch (err) {
    warnOnce('Firebase Admin setup failed: push notifications are disabled: ' + err.message);
    return null;
  }
}

// Returns the Firebase Messaging client, or null when Firebase isn't configured
function getFirebaseMessaging() {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    const { getMessaging } = require('firebase-admin/messaging');
    return getMessaging(app);
  } catch (err) {
    warnOnce('Firebase Messaging unavailable: ' + err.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin, getFirebaseMessaging };