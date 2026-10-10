const admin = require('firebase-admin');

// The service account JSON goes in FIREBASE_SERVICE_ACCOUNT as a single-line
// environment variable (paste the whole JSON file's contents as the value).
// Never commit the JSON file itself, and never expose it to the frontend.
let app = null;

function getFirebaseAdmin() {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT is not set: push notifications are disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return app;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
    return null;
  }
}

module.exports = { getFirebaseAdmin, admin };