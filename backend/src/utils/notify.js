const Notification = require('../models/Notification');
const FcmToken = require('../models/FcmToken');
const { getFirebaseMessaging } = require('../config/firebase');

// Short readable label for a saved browser user-agent, used only in logs
function deviceLabel(ua) {
  const s = String(ua || '');
  const os = /android/i.test(s)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(s)
    ? 'iOS'
    : /windows/i.test(s)
    ? 'Windows'
    : /mac os/i.test(s)
    ? 'Mac'
    : /linux/i.test(s)
    ? 'Linux'
    : 'Unknown';
  const browser = /edg\//i.test(s)
    ? 'Edge'
    : /firefox/i.test(s)
    ? 'Firefox'
    : /chrome|crios/i.test(s)
    ? 'Chrome'
    : /safari/i.test(s)
    ? 'Safari'
    : 'browser';
  return `${os} ${browser}`;
}

// Sends the push only (no DB row). Internal helper, never throws.
//
// Sent as a DATA-ONLY message (no "notification" block). A message with a
// "notification" block is shown automatically by the browser AND by the service
// worker's own showNotification call, which produced duplicates. With data-only,
// the service worker (public/firebase-messaging-sw.js) is the single place that
// displays it.
//
// Each device is sent to separately so one bad token can't affect the others, and
// every outcome is logged so a failure can be traced.
async function sendPush(userId, title, body, link, type) {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn('sendPush skipped: Firebase is not configured');
      return;
    }

    const tokenDocs = await FcmToken.find({ user: userId }).select('token userAgent').lean();
    const devices = (tokenDocs || []).filter((t) => t.token);
    if (devices.length === 0) return;
    const tokens = devices.map((t) => t.token);

    // Repeated chat messages from the same conversation replace one another on the device
    const tag = type === 'new_message' ? link || '' : '';

    const data = {
      title: String(title || 'SafeSwap'),
      body: String(body || ''),
      link: String(link || '/'),
      type: String(type || ''),
    };
    if (tag) data.tag = String(tag);

    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging.send({
          token,
          data,
          // High urgency so phones deliver it promptly instead of batching it
          webpush: { headers: { Urgency: 'high', TTL: '86400' } },
        })
      )
    );

    const deadTokens = [];
    let sent = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        sent += 1;
        return;
      }
      const code = String((r.reason && r.reason.code) || '');
      console.error(
        `sendPush: device ${i + 1}/${tokens.length} (${deviceLabel(devices[i].userAgent)}) failed:`,
        code || (r.reason && r.reason.message) || r.reason
      );
      // Only remove tokens Firebase says no longer exist. Other errors (such as
      // "invalid-argument") can mean the message was bad, not the device.
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        deadTokens.push(tokens[i]);
      }
    });

    if (deadTokens.length) await FcmToken.deleteMany({ token: { $in: deadTokens } });

    console.log(
      `sendPush: ${sent}/${tokens.length} delivered to user ${userId} (${type || 'n/a'}) devices: ${devices
        .map((d) => deviceLabel(d.userAgent))
        .join(', ')}`
    );
  } catch (err) {
    console.error('sendPush failed:', err.stack || err.message);
  }
}

// Creates a bell notification row and sends a push. Never throws: the action
// that triggered it (an approval, a webhook, a sent message) must always
// succeed even if this fails entirely.
// If actorId is given and matches userId, the call is skipped silently — a
// person is never notified of their own action (e.g. an admin approving
// their own listing).
async function notify({ userId, actorId, type, title, body, link, meta }) {
  if (!userId) return;
  if (actorId && String(actorId) === String(userId)) return;

  try {
    await Notification.create({ user: userId, type, title, body, link, meta });
  } catch (err) {
    console.error('notify: failed to save notification row:', err.message);
  }
  await sendPush(userId, title, body, link, type);
}

// Same as notify, but to every admin at once.
async function notifyAdmins({ type, title, body, link, meta, actorId }) {
  const User = require('../models/User');
  try {
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    await Promise.all(admins.map((a) => notify({ userId: a._id, actorId, type, title, body, link, meta })));
  } catch (err) {
    console.error('notifyAdmins: failed:', err.message);
  }
}

// New-message notifications collapse repeats from the same sender in the same
// conversation into one updated row instead of spamming one per message, and
// are skipped entirely if the recipient already has this exact chat open
// (the live socket message already reached them in real time).
async function notifyNewMessage({ recipientId, senderId, senderName, listingId, listingTitle, room, isUserActiveInRoom }) {
  if (!recipientId || String(recipientId) === String(senderId)) return;
  if (isUserActiveInRoom && isUserActiveInRoom(recipientId, room)) return;

  const link = `/chat/${listingId}?with=${senderId}`;
  let title;
  let body;

  try {
    const existing = await Notification.findOne({
      user: recipientId,
      type: 'new_message',
      read: false,
      'meta.senderId': String(senderId),
      'meta.listingId': String(listingId),
    });

    if (existing) {
      const count = (existing.meta?.count || 1) + 1;
      title = `New messages from ${senderName}`;
      body = `${count} new messages about "${listingTitle}"`;
      existing.title = title;
      existing.body = body;
      existing.meta = { ...existing.meta, count };
      existing.createdAt = new Date(); // bump to the top of the bell list
      await existing.save();
    } else {
      title = `New message from ${senderName}`;
      body = `About "${listingTitle}"`;
      await Notification.create({
        user: recipientId,
        type: 'new_message',
        title,
        body,
        link,
        meta: { senderId: String(senderId), listingId: String(listingId), count: 1 },
      });
    }
  } catch (err) {
    console.error('notifyNewMessage: failed to save notification row:', err.message);
    title = title || `New message from ${senderName}`;
    body = body || `About "${listingTitle}"`;
  }

  await sendPush(recipientId, title, body, link, 'new_message');
}

module.exports = { notify, notifyAdmins, notifyNewMessage, sendPush };