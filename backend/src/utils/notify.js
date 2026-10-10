const Notification = require('../models/Notification');
const FcmToken = require('../models/FcmToken');
const { getFirebaseAdmin, admin } = require('../config/firebase');

// Creates the bell notification and sends a push, best-effort. Never throws:
// a failed push should never break the action that triggered it (e.g. approving
// a listing must succeed even if Firebase is down or the user has no device token).
async function notify({ userId, type, title, body, link, meta }) {
  try {
    await Notification.create({ user: userId, type, title, body, link, meta });
  } catch (err) {
    console.error('notify: failed to save notification row:', err.message);
  }

  try {
    const app = getFirebaseAdmin();
    if (!app) return; // Firebase not configured; the bell still works, push just doesn't fire

    const tokens = await FcmToken.find({ user: userId }).select('token').lean();
    if (tokens.length === 0) return;

    const message = {
      notification: { title, body: body || '' },
      data: { link: link || '/', type },
      tokens: tokens.map((t) => t.token),
    };

    const result = await admin.messaging().sendEachForMulticast(message);

    // Clean up tokens Firebase says are no longer valid (uninstalled, revoked, etc.)
    const deadTokens = [];
    result.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          deadTokens.push(tokens[i].token);
        }
      }
    });
    if (deadTokens.length) {
      await FcmToken.deleteMany({ token: { $in: deadTokens } });
    }
  } catch (err) {
    console.error('notify: push send failed:', err.message);
  }
}

// Same as notify, but to every admin at once (used for "new listing needs review")
async function notifyAdmins({ type, title, body, link, meta }) {
  const User = require('../models/User');
  try {
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    await Promise.all(admins.map((a) => notify({ userId: a._id, type, title, body, link, meta })));
  } catch (err) {
    console.error('notifyAdmins: failed:', err.message);
  }
}

module.exports = { notify, notifyAdmins };