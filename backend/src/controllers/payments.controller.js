const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { notify } = require('../utils/notify');

const HOUR_MS = 60 * 60 * 1000;

// Hours a payment must have been pending before it counts as stale. Never under 6,
// so a buyer still entering their M-Pesa PIN can't be caught by a cleanup.
function hoursParam(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 24;
  return Math.min(Math.max(n, 6), 720);
}

// Sends the notifications a few at a time, after the admin already has their answer
async function notifyBuyers(payments, actorId) {
  const size = 10;
  for (let i = 0; i < payments.length; i += size) {
    await Promise.all(
      payments.slice(i, i + size).map((p) => {
        const title = p.listing && p.listing.title ? p.listing.title : null;
        return notify({
          userId: p.buyer,
          actorId,
          type: 'payment_status',
          title: 'Your payment was cancelled',
          body: title
            ? `Your payment for "${title}" was never completed, so it has been cancelled. If money was taken from your M-Pesa, please contact support.`
            : 'Your payment was never completed, so it has been cancelled. If money was taken from your M-Pesa, please contact support.',
          link: p.listing && p.listing._id ? `/listings/${p.listing._id}` : '/support',
        });
      })
    );
  }
}

// GET /api/admin/payments/stale-count?hours=24
async function getStaleCount(req, res) {
  try {
    const hours = hoursParam(req.query.hours);
    const cutoff = new Date(Date.now() - hours * HOUR_MS);
    const [count, oldest] = await Promise.all([
      Payment.countDocuments({ status: 'pending', createdAt: { $lt: cutoff } }),
      Payment.findOne({ status: 'pending', createdAt: { $lt: cutoff } })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean(),
    ]);
    res.json({ count, hours, oldest: oldest ? oldest.createdAt : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/payments/expire-stale  { hours }
// Marks old pending payments as failed and tells each buyer.
async function expireStale(req, res) {
  try {
    const hours = hoursParam(req.body?.hours);
    const cutoff = new Date(Date.now() - hours * HOUR_MS);

    const stale = await Payment.find({ status: 'pending', createdAt: { $lt: cutoff } })
      .select('buyer listing')
      .populate('listing', 'title')
      .lean();

    // One at a time, and only if it is still pending, so a payment that completes
    // while this runs is never overwritten
    const changed = [];
    for (const p of stale) {
      const done = await Payment.findOneAndUpdate({ _id: p._id, status: 'pending' }, { status: 'failed' });
      if (done) changed.push(p);
    }

    if (changed.length > 0) {
      try {
        await AuditLog.create({
          admin: req.user._id,
          adminName: req.user.fullName,
          action: 'payment.expire',
          targetType: 'payment',
          summary: `Cleaned up ${changed.length} pending payment${changed.length === 1 ? '' : 's'} older than ${hours} hours (marked failed, buyers notified)`,
          meta: { expired: changed.length, hours },
        });
      } catch (err) {
        console.error('Audit log failed:', err.message);
      }
    }

    res.json({ expired: changed.length, hours });

    // Notifications go out in the background so the page doesn't wait on them
    notifyBuyers(changed, req.user._id).catch((err) =>
      console.error('Cleanup notifications failed:', err.message)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getStaleCount, expireStale };