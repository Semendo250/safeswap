const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');

const HOUR_MS = 60 * 60 * 1000;

// Hours a payment must have been pending before it counts as stale. Never under 6,
// so a buyer still entering their M-Pesa PIN can't be caught by a cleanup.
function hoursParam(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 24;
  return Math.min(Math.max(n, 6), 720);
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
// Marks old pending payments as failed. Silent: nobody is notified.
async function expireStale(req, res) {
  try {
    const hours = hoursParam(req.body?.hours);
    const cutoff = new Date(Date.now() - hours * HOUR_MS);

    const result = await Payment.updateMany(
      { status: 'pending', createdAt: { $lt: cutoff } },
      { status: 'failed' }
    );
    const expired = result.modifiedCount || 0;

    if (expired > 0) {
      try {
        await AuditLog.create({
          admin: req.user._id,
          adminName: req.user.fullName,
          action: 'payment.expire',
          targetType: 'payment',
          summary: `Cleaned up ${expired} pending payment${expired === 1 ? '' : 's'} older than ${hours} hours (marked failed, nobody notified)`,
          meta: { expired, hours },
        });
      } catch (err) {
        console.error('Audit log failed:', err.message);
      }
    }

    res.json({ expired, hours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/payments/:id/review/clear  { reason }
async function clearReview(req, res) {
  try {
    const id = String(req.params.id);
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid payment id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const p = await Payment.findOneAndUpdate({ _id: id, needsReview: true }, { needsReview: false }, { new: true });
    if (!p) return res.status(404).json({ error: 'This payment is not flagged for review' });

    try {
      await AuditLog.create({
        admin: req.user._id,
        adminName: req.user.fullName,
        action: 'payment.review',
        targetType: 'payment',
        targetId: String(p._id),
        summary: `Marked payment ${p.checkoutRequestId} as reviewed`,
        reason,
      });
    } catch (err) {
      console.error('Audit log failed:', err.message);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getStaleCount, expireStale, clearReview };