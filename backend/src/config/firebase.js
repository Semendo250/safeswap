const admin = require('firebase-admin');

let initialized = false;

// Returns the initialised Firebase Admin app, or null when Firebase isn't configured.
// Push notifications are optional: a missing or invalid key must never stop the server.
function getFirebaseAdmin() {
  if (initialized) return admin.apps.length ? admin.app() : null;
  initialized = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT is not set: push notifications are disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    // Keys pasted into env vars often have escaped newlines; turn them back into real ones
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    return admin.app();
  } catch (err) {
    console.error('Firebase Admin setup failed: push notifications are disabled:', err.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin, admin };