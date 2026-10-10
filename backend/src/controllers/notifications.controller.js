const Notification = require('../models/Notification');
const FcmToken = require('../models/FcmToken');

// GET /api/notifications?page=
async function getNotifications(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.json({ notifications, total, unreadCount, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/notifications/unread-count — lightweight, for polling the bell badge
async function getUnreadCount(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/notifications/:id/read
async function markOneRead(req, res) {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    res.json(n);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/notifications/read-all
async function markAllRead(req, res) {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/notifications/token   body: { token }
// Registers (or re-confirms) this browser's push token for the logged-in user
async function registerToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    await FcmToken.findOneAndUpdate(
      { token },
      { user: req.user._id, token, userAgent: req.headers['user-agent'] || '' },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/notifications/token   body: { token }
// Called on logout, so a shared/public computer stops receiving this user's pushes
async function removeToken(req, res) {
  try {
    const { token } = req.body;
    if (token) await FcmToken.deleteOne({ token, user: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  registerToken,
  removeToken,
};