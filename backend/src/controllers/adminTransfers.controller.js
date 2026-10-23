const Settlement = require('../models/Settlement');
const Payment = require('../models/Payment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const b2c = require('../utils/mpesaB2C');
const { EXPECTED_STATUS } = require('../utils/finance');

const STUCK_AFTER_MS = 2 * 60 * 1000;
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

async function logAction(req, action, { targetId, summary, reason, meta } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType: 'payment',
      targetId: targetId ? String(targetId) : undefined,
      summary,
      reason: reason || undefined,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// POST /api/admin/finance/settlements/:id/send  { amount }
// Starts an M-Pesa payout or refund. The money only counts as sent once M-Pesa confirms it.
async function sendNow(req, res) {
  try {
    const st = b2c.status();
    if (!st.enabled) {
      return res.status(503).json({
        error: 'Automatic sending is turned off. Send it in M-Pesa yourself and mark it as sent.',
      });
    }
    if (!st.ready) {
      return res.status(503).json({ error: `Automatic sending is not fully set up. Missing: ${st.problems.join(', ')}` });
    }

    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });
    if (s.status !== 'due') return res.status(409).json({ error: 'This has already been sent.' });

    const payment = await Payment.findById(s.payment).select('status checkoutRequestId phone').lean();
    if (!payment || payment.status !== EXPECTED_STATUS[s.type]) {
      return res.status(409).json({ error: 'The payment status changed. Refresh the page and check it first.' });
    }

    const amount = s.net;
    if (!Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({ error: 'There is nothing to send for this record.' });
    }
    if (amount > st.maxAmount) {
      return res.status(400).json({
        error: `KES ${amount.toLocaleString('en-US')} is above the limit of KES ${st.maxAmount.toLocaleString('en-US')} for one automatic send. Send it manually.`,
      });
    }
    // The amount on the admin's screen must match what is on record
    if (Number(req.body?.amount) !== amount) {
      return res.status(409).json({ error: 'The amount changed since this page loaded. Refresh and review it again.' });
    }

    const isRefund = s.type === 'refund';
    const person = await User.findById(isRefund ? s.buyer : s.seller).select('fullName phone').lean();
    const rawPhone = isRefund ? payment.phone || (person && person.phone) : person && person.phone;
    const phone = b2c.toMsisdn(rawPhone);
    const name = person ? person.fullName : 'the recipient';
    if (!phone) {
      return res.status(400).json({
        error: `${name} has no valid M-Pesa number on file. Add one, or send it manually and mark it as sent.`,
      });
    }

    // Only one request can win this lock, so a double click can never send twice
    const locked = await Settlement.findOneAndUpdate(
      { _id: s._id, status: 'due', 'transfer.state': { $ne: 'sending' } },
      {
        $set: {
          'transfer.state': 'sending',
          'transfer.phone': phone,
          'transfer.amount': amount,
          'transfer.initiatedAt': new Date(),
          'transfer.initiatedBy': req.user._id,
          'transfer.initiatedByName': req.user.fullName,
        },
        $unset: { 'transfer.message': 1 },
        $inc: { 'transfer.attempts': 1 },
      },
      { new: true }
    );
    if (!locked) return res.status(409).json({ error: 'This is already being sent.' });

    const attempt = locked.transfer.attempts;
    const label = `SafeSwap ${isRefund ? 'refund' : 'payout'} ${String(payment.checkoutRequestId).slice(-8)}`;

    let sent;
    try {
      sent = await b2c.sendB2C({ settlementId: String(s._id), attempt, phone, amount, remarks: label });
    } catch (err) {
      const message = b2c.errorText(err);
      const status = err.response && err.response.status;
      // Safe to retry when nothing was sent, or M-Pesa answered with a rejection
      const definitive = err.notSent || (status && status < 500);
      if (definitive) {
        await Settlement.updateOne(
          { _id: s._id },
          { $set: { 'transfer.state': 'failed', 'transfer.message': String(message).slice(0, 300) } }
        );
        await logAction(req, 'payment.transfer_failed', {
          targetId: s.payment,
          summary: `Could not start sending KES ${amount} to ${name}: ${message}`,
        });
        return res.status(502).json({ error: `M-Pesa did not accept it: ${message}` });
      }
      // No clear answer: M-Pesa may or may not have it. Stay on "sending" so nobody sends it twice.
      await Settlement.updateOne(
        { _id: s._id },
        {
          $set: {
            'transfer.message':
              'No clear answer from M-Pesa. It may or may not have gone through. Check your M-Pesa statement before trying again.',
          },
        }
      );
      return res.status(202).json({
        ok: true,
        message: 'M-Pesa did not answer clearly. Check your M-Pesa statement before trying again.',
      });
    }

    const reply = sent.data || {};
    if (String(reply.ResponseCode) !== '0') {
      const message = reply.ResponseDescription || 'M-Pesa rejected the request';
      await Settlement.updateOne(
        { _id: s._id },
        { $set: { 'transfer.state': 'failed', 'transfer.message': String(message).slice(0, 300) } }
      );
      await logAction(req, 'payment.transfer_failed', {
        targetId: s.payment,
        summary: `M-Pesa rejected sending KES ${amount} to ${name}: ${message}`,
      });
      return res.status(502).json({ error: `M-Pesa did not accept it: ${message}` });
    }

    await Settlement.updateOne(
      { _id: s._id },
      {
        $set: {
          'transfer.conversationId': reply.ConversationID,
          'transfer.originatorConversationId': reply.OriginatorConversationID,
        },
      }
    );
    await logAction(req, 'payment.transfer_started', {
      targetId: s.payment,
      summary: `Started sending KES ${amount} to ${name} (${phone}) through M-Pesa`,
      meta: { settlementId: s._id, attempt, conversationId: reply.ConversationID || null },
    });

    res.json({
      ok: true,
      message: `Sending KES ${amount.toLocaleString('en-US')} to ${name}. It will show as sent when M-Pesa confirms.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/finance/settlements/:id/reset-transfer  { reason }
// For a send that failed or got stuck. Check the M-Pesa statement first.
async function resetTransfer(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });
    if (s.status !== 'due') return res.status(409).json({ error: 'This has already been sent.' });

    const state = s.transfer && s.transfer.state;
    if (!state) return res.status(409).json({ error: 'There is nothing to reset here.' });
    if (state === 'sending' && Date.now() - new Date(s.transfer.initiatedAt).getTime() < STUCK_AFTER_MS) {
      return res.status(409).json({ error: 'M-Pesa is still processing this. Wait a couple of minutes.' });
    }

    await Settlement.updateOne(
      { _id: s._id, status: 'due' },
      { $unset: { 'transfer.state': 1, 'transfer.message': 1 } }
    );
    await logAction(req, 'payment.transfer_reset', {
      targetId: s.payment,
      summary: `Reset a ${s.type} of KES ${s.net} that was ${state}`,
      reason,
    });

    res.json({
      ok: true,
      message: 'Reset. Check your M-Pesa statement that the money did not leave your account before sending again.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { sendNow, resetTransfer };