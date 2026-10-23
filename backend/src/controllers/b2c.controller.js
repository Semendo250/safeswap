const crypto = require('crypto');
const Settlement = require('../models/Settlement');
const Listing = require('../models/Listing');
const AuditLog = require('../models/AuditLog');
const { notify, notifyAdmins } = require('../utils/notify');

const ACK = { ResultCode: 0, ResultDesc: 'Accepted' };
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function tokenIsValid(provided) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// M-Pesa sends the details as a list of { Key, Value }
function readParams(result) {
  const list = result && result.ResultParameters && result.ResultParameters.ResultParameter;
  const items = Array.isArray(list) ? list : list ? [list] : [];
  const out = {};
  items.forEach((p) => {
    if (p && p.Key) out[p.Key] = p.Value;
  });
  return out;
}

async function logAction(s, action, summary, meta) {
  const adminId = s.transfer && s.transfer.initiatedBy;
  if (!adminId) return;
  try {
    await AuditLog.create({
      admin: adminId,
      adminName: (s.transfer && s.transfer.initiatedByName) || 'M-Pesa',
      action,
      targetType: 'payment',
      targetId: String(s.payment),
      summary,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

async function markFailed(s, attempt, message) {
  // Only the latest attempt can fail the record, so a late answer from an old attempt changes nothing
  if (s.status !== 'due' || !s.transfer || s.transfer.state !== 'sending') return;
  if (Number(s.transfer.attempts) !== attempt) return;
  await Settlement.updateOne(
    { _id: s._id, status: 'due' },
    { $set: { 'transfer.state': 'failed', 'transfer.message': String(message).slice(0, 300) } }
  );
  await logAction(s, 'payment.transfer_failed', `Sending KES ${s.net} failed: ${message}`);
  await notifyAdmins({
    type: 'payment_status',
    title: 'Money transfer failed',
    body: `Sending KES ${s.net} did not go through. Open Finance to try again.`,
    link: '/admin/finance',
  });
}

// POST /api/b2c/result
async function handleResult(req, res) {
  try {
    if (!tokenIsValid(req.query.token)) return res.status(403).json({ error: 'Forbidden' });
    const result = req.body && req.body.Result;
    if (!result) return res.status(400).json({ error: 'Invalid payload' });

    const sid = String(req.query.sid || '');
    const attempt = Number(req.query.a);
    if (!isId(sid)) return res.json(ACK);
    const s = await Settlement.findById(sid);
    if (!s) return res.json(ACK);

    const success = Number(result.ResultCode) === 0;
    const params = readParams(result);
    const receipt = String(result.TransactionID || params.TransactionReceipt || '')
      .trim()
      .toUpperCase();

    if (!success) {
      await markFailed(s, attempt, `${result.ResultDesc || 'Unknown reason'} (code ${result.ResultCode})`);
      return res.json(ACK);
    }

    if (s.status === 'paid') {
      // Already recorded. A different code means a second send went out, which needs a human.
      if (receipt && s.reference && s.reference !== receipt) {
        await logAction(s, 'payment.transfer_duplicate', `A second M-Pesa send of KES ${s.net} was confirmed (codes ${s.reference} and ${receipt})`);
        await notifyAdmins({
          type: 'payment_status',
          title: 'Possible double payout',
          body: `KES ${s.net} may have been sent twice (codes ${s.reference} and ${receipt}). Check your M-Pesa statement.`,
          link: '/admin/finance',
        });
      }
      return res.json(ACK);
    }

    const sentAmount = Number(params.TransactionAmount);
    const requested = Number(s.transfer && s.transfer.amount);
    const mismatch = Number.isFinite(sentAmount) && Number.isFinite(requested) && sentAmount !== requested;

    const update = {
      status: 'paid',
      via: 'mpesa',
      paidAt: new Date(),
      paidByName: (s.transfer && s.transfer.initiatedByName) || 'M-Pesa',
    };
    if (s.transfer && s.transfer.initiatedBy) update.paidBy = s.transfer.initiatedBy;
    if (receipt) update.reference = receipt;
    if (mismatch) update.note = `M-Pesa says KES ${sentAmount} was sent but KES ${requested} was requested. Check this one.`;
    const clear = { $unset: { 'transfer.state': 1, 'transfer.message': 1 } };

    let saved;
    try {
      saved = await Settlement.findOneAndUpdate({ _id: s._id, status: 'due' }, { ...update, ...clear }, { new: true });
    } catch (err) {
      if (err.code !== 11000) throw err;
      // That code is already saved on another record: keep it in the note instead
      delete update.reference;
      update.note = `${update.note ? `${update.note} ` : ''}M-Pesa code ${receipt}.`.slice(0, 300);
      saved = await Settlement.findOneAndUpdate({ _id: s._id, status: 'due' }, { ...update, ...clear }, { new: true });
    }
    if (!saved) return res.json(ACK);

    const isRefund = saved.type === 'refund';
    await logAction(
      saved,
      isRefund ? 'payment.refund_sent' : 'payment.payout_sent',
      `${isRefund ? 'Refund' : 'Payout'} of KES ${saved.net} sent through M-Pesa${receipt ? ` (code ${receipt})` : ''}`,
      { settlementId: saved._id, net: saved.net, fee: saved.fee, reference: receipt || null }
    );

    const listing = await Listing.findById(saved.listing).select('title').lean();
    const title = listing ? listing.title : 'your item';
    const link = listing ? `/listings/${saved.listing}` : '/browse';
    if (isRefund && saved.buyer) {
      await notify({
        userId: saved.buyer,
        type: 'payment_status',
        title: 'Refund sent',
        body: `Your refund of KES ${saved.net} for "${title}" was sent to your M-Pesa.${receipt ? ` Code: ${receipt}.` : ''}`,
        link,
      });
    } else if (!isRefund && saved.seller) {
      await notify({
        userId: saved.seller,
        type: 'payment_status',
        title: 'Payout sent',
        body: `KES ${saved.net} for "${title}" was sent to your M-Pesa${
          saved.fee > 0 ? ` after a KES ${saved.fee} service fee` : ''
        }.${receipt ? ` Code: ${receipt}.` : ''}`,
        link,
      });
    }
    if (mismatch) {
      await notifyAdmins({
        type: 'payment_status',
        title: 'Check a payout amount',
        body: `M-Pesa reports KES ${sentAmount} sent, but KES ${requested} was requested.`,
        link: '/admin/finance',
      });
    }

    res.json(ACK);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/b2c/timeout   (M-Pesa could not process it in time)
async function handleTimeout(req, res) {
  try {
    if (!tokenIsValid(req.query.token)) return res.status(403).json({ error: 'Forbidden' });
    const sid = String(req.query.sid || '');
    const attempt = Number(req.query.a);
    if (!isId(sid)) return res.json(ACK);
    const s = await Settlement.findById(sid);
    if (s) {
      await markFailed(s, attempt, 'M-Pesa could not process it in time. Check your M-Pesa statement before trying again.');
    }
    res.json(ACK);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleResult, handleTimeout };