const Settlement = require('../models/Settlement');
const Payment = require('../models/Payment');
const Listing = require('../models/Listing');
const AuditLog = require('../models/AuditLog');
const { notify } = require('../utils/notify');
const { EXPECTED_STATUS } = require('../utils/finance');
const { parseMpesaSms, cleanManualFields, toMsisdn } = require('../utils/mpesaSms');

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const kes = (n) => `KES ${Number(n).toLocaleString('en-US')}`;
const showPhone = (m) => (m ? `0${String(m).slice(3)}` : '');
const eatText = (d) =>
  new Date(new Date(d).getTime() + TZ_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16);

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

function load(id) {
  return Settlement.findById(id)
    .populate('seller', 'fullName phone')
    .populate('buyer', 'fullName phone')
    .populate('payment', 'status createdAt phone');
}

// Payouts go to the seller's phone. Refunds go back to the number that paid.
function expectedPhone(s) {
  const raw =
    s.type === 'refund'
      ? (s.payment && s.payment.phone) || (s.buyer && s.buyer.phone)
      : s.seller && s.seller.phone;
  return toMsisdn(raw);
}

function expectedName(s) {
  const u = s.type === 'refund' ? s.buyer : s.seller;
  return u && u.fullName ? u.fullName : '';
}

function nameMatches(a, b) {
  const tok = (x) =>
    String(x || '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length > 1);
  const B = tok(b);
  return tok(a).some((t) => B.includes(t));
}

function sumReceipts(s) {
  return round2((s.receipts || []).reduce((n, r) => n + (Number(r.amount) || 0), 0));
}

// Has this code been used already, anywhere?
async function codeProblem(s, code) {
  if (!code) return '';
  if (s.reference === code || (s.receipts || []).some((r) => r.code === code)) {
    return 'This code is already saved on this order.';
  }
  const [other, buyerPayment] = await Promise.all([
    Settlement.exists({ _id: { $ne: s._id }, $or: [{ 'receipts.code': code }, { reference: code }] }),
    Payment.exists({ mpesaReceipt: code }),
  ]);
  if (other) return 'This code is already saved on another payout or refund.';
  if (buyerPayment) return "This is a buyer's payment code, not a confirmation of money you sent.";
  return '';
}

function runChecks(s, ev, problem) {
  const checks = [];
  const add = (key, label, status, message, hard = false) =>
    checks.push({ key, label, status, message, hard });
  const f = ev.fields;
  const { remaining } = ev.owed;
  const noun = s.type === 'refund' ? 'refund' : 'payout';

  // 1. Is a send allowed for this order right now?
  const expected = EXPECTED_STATUS[s.type];
  if (s.status !== 'due') {
    add('state', 'Order state', 'fail', 'This record is already fully paid.', true);
  } else if (!s.payment || s.payment.status !== expected) {
    add(
      'state',
      'Order state',
      'fail',
      `The payment is ${s.payment ? s.payment.status : 'missing'}, not ${expected}.${
        s.type === 'payout' ? ' The buyer has to confirm the handover first.' : ''
      }`,
      true
    );
  } else if (s.transfer && s.transfer.state === 'sending') {
    add('state', 'Order state', 'fail', 'An M-Pesa send is still in progress for this record.', true);
  } else {
    add('state', 'Order state', 'pass', `A ${noun} is allowed for this order.`);
  }

  // 2. Is it a real send confirmation?
  if (ev.manual) {
    add('confirmed', 'Message', 'info', 'Entered by hand. Nothing was read from a message.');
  } else if (!ev.parsed.confirmed) {
    add('confirmed', 'Message', 'fail', 'The message does not say "Confirmed".');
  } else if (ev.parsed.reversal) {
    add('confirmed', 'Message', 'fail', 'This looks like a reversal message, not a send confirmation.');
  } else if (ev.parsed.direction !== 'out') {
    add('confirmed', 'Message', 'fail', 'This does not look like money you sent (no "sent to" or "paid to").');
  } else {
    add('confirmed', 'Message', 'pass', 'Looks like an M-Pesa send confirmation.');
  }

  // 3. Receipt code
  if (!/^[A-Z0-9]{10}$/.test(f.code || '')) {
    add('code', 'Receipt code', 'fail', 'Could not find a valid 10-character M-Pesa code.', true);
  } else if (problem) {
    add('code', 'Receipt code', 'fail', problem, true);
  } else {
    add('code', 'Receipt code', 'pass', `${f.code} has not been used before.`);
  }

  // 4. Amount
  if (f.amount === null || !(f.amount > 0)) {
    add('amount', 'Amount', 'fail', 'Could not read an amount.', true);
  } else if (Math.abs(f.amount - remaining) < 0.005) {
    add('amount', 'Amount', 'pass', `${kes(f.amount)} matches what is owed.`);
  } else if (f.amount < remaining) {
    add(
      'amount',
      'Amount',
      'warn',
      `Part payment: ${kes(f.amount)} of ${kes(remaining)}. ${kes(round2(remaining - f.amount))} will still be owed after this.`
    );
  } else {
    add('amount', 'Amount', 'fail', `Amount is ${kes(f.amount)} but ${kes(remaining)} is owed.`);
  }

  // 5. Recipient number
  const want = ev.expected.phoneRaw;
  if (!want) {
    add('phone', 'Recipient number', 'fail', 'There is no phone number on file to match this against.');
  } else if (f.phone) {
    if (f.phone === want) {
      add('phone', 'Recipient number', 'pass', `Sent to ${showPhone(f.phone)}, which matches the order.`);
    } else {
      add(
        'phone',
        'Recipient number',
        'fail',
        `The message went to ${showPhone(f.phone)} but ${showPhone(want)} is on the order.`
      );
    }
  } else {
    add(
      'phone',
      'Recipient number',
      'warn',
      `The message has no phone number, so it cannot be verified. Confirm you sent it to ${showPhone(want)}.`
    );
  }

  // Names can be shortened, so this is information only
  if (f.name) {
    if (nameMatches(f.name, ev.expected.name)) {
      add('name', 'Name', 'pass', `"${f.name}" looks like ${ev.expected.name}.`);
    } else {
      add(
        'name',
        'Name',
        'info',
        `The message says "${f.name}" and the order has "${ev.expected.name}". Names can be shortened, so only the number is used to match.`
      );
    }
  }

  // 6. Time
  if (!f.paidAt) {
    add('time', 'Payment time', 'fail', 'Could not read the payment time.');
  } else {
    const buyerPaid = s.payment && s.payment.createdAt ? new Date(s.payment.createdAt) : null;
    if (f.paidAt.getTime() > Date.now() + 2 * 60 * 1000) {
      add('time', 'Payment time', 'fail', `${eatText(f.paidAt)} is in the future.`);
    } else if (buyerPaid && f.paidAt.getTime() + 60 * 1000 < buyerPaid.getTime()) {
      add(
        'time',
        'Payment time',
        'fail',
        `${eatText(f.paidAt)} is before the buyer paid (${eatText(buyerPaid)}).`
      );
    } else {
      add('time', 'Payment time', 'pass', `Sent ${eatText(f.paidAt)}, after the buyer paid.`);
    }
  }

  return checks;
}

async function evaluate(s, body) {
  const text = String(body.text || '').slice(0, 2000);
  const parsed = parseMpesaSms(text);
  const manual = body.manual === true;

  const fields = manual
    ? cleanManualFields(body.fields)
    : {
        code: parsed.code,
        amount: parsed.amount,
        phone: parsed.phone,
        name: parsed.name,
        paidAt: parsed.paidAt,
        cost: parsed.cost || 0,
      };
  const complete = manual ? !!(fields.code && fields.amount !== null && fields.paidAt) : parsed.complete;

  const paid = sumReceipts(s);
  const owed = { net: s.net, paid, remaining: Math.max(round2(s.net - paid), 0) };
  const wantPhone = expectedPhone(s);
  const expected = { name: expectedName(s), phone: showPhone(wantPhone), phoneRaw: wantPhone };

  const base = { text, parsed, manual, complete, fields, owed, expected };
  if (!complete && !manual) {
    return { ...base, checks: [], blocking: false, softFails: 0, needsPhoneTick: false, needsPartialTick: false };
  }

  const problem = await codeProblem(s, fields.code);
  const checks = runChecks(s, base, problem);
  return {
    ...base,
    checks,
    blocking: checks.some((c) => c.status === 'fail' && c.hard),
    softFails: checks.filter((c) => c.status === 'fail' && !c.hard).length,
    needsPhoneTick: checks.some((c) => c.key === 'phone' && c.status === 'warn'),
    needsPartialTick: checks.some((c) => c.key === 'amount' && c.status === 'warn'),
  };
}

// POST /api/admin/finance/settlements/:id/receipt/check  { text, manual, fields }
async function checkReceipt(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });
    const s = await load(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });

    const ev = await evaluate(s, req.body || {});
    res.json({
      complete: ev.complete,
      manual: ev.manual,
      fields: ev.fields,
      owed: ev.owed,
      expected: { name: ev.expected.name, phone: ev.expected.phone },
      checks: ev.checks,
      blocking: ev.blocking,
      softFails: ev.softFails,
      needsPhoneTick: ev.needsPhoneTick,
      needsPartialTick: ev.needsPartialTick,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/finance/settlements/:id/receipt
//   { text, manual, fields, phoneConfirmed, partialConfirmed, overrideReason }
// Runs every check again here, so nothing that skips the screen skips the checks.
async function addReceipt(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });
    const body = req.body || {};
    const s = await load(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });

    const ev = await evaluate(s, body);
    if (!ev.complete) {
      return res.status(400).json({ error: 'Could not read the receipt. Fill in the code, amount and time.' });
    }
    const hard = ev.checks.find((c) => c.status === 'fail' && c.hard);
    if (hard) return res.status(409).json({ error: hard.message });

    const softFails = ev.checks.filter((c) => c.status === 'fail' && !c.hard);
    const reason = String(body.overrideReason || '').trim().slice(0, 300);
    if (softFails.length && reason.length < 3) {
      return res.status(400).json({ error: 'Some checks failed. Give a reason to override them.' });
    }
    if (ev.needsPhoneTick && body.phoneConfirmed !== true) {
      return res.status(400).json({ error: 'Confirm you sent it to the number on the order.' });
    }
    if (ev.needsPartialTick && body.partialConfirmed !== true) {
      return res.status(400).json({ error: 'Confirm this is a part payment.' });
    }

    const f = ev.fields;
    const receipt = {
      code: f.code,
      amount: f.amount,
      phone: f.phone || undefined,
      recipientName: f.name || undefined,
      paidAtSms: f.paidAt || undefined,
      cost: f.cost || 0,
      rawText: ev.text || undefined,
      manual: ev.manual,
      partial: ev.needsPartialTick,
      phoneConfirmed: ev.needsPhoneTick,
      overridden: softFails.length > 0,
      overrideReason: softFails.length ? reason : undefined,
      failedChecks: softFails.map((c) => c.key),
      addedBy: req.user._id,
      addedByName: req.user.fullName,
      addedAt: new Date(),
    };

    const stored = Number(s.paidTotal) || 0;
    const newTotal = round2(sumReceipts(s) + f.amount);
    const fullyPaid = newTotal + 0.005 >= s.net;

    const set = { paidTotal: newTotal, via: 'manual' };
    if (fullyPaid) {
      set.status = 'paid';
      set.paidAt = new Date();
      set.paidBy = req.user._id;
      set.paidByName = req.user.fullName;
    }
    // The paidTotal condition stops two admins adding receipts at the same moment
    const filter = {
      _id: s._id,
      status: 'due',
      ...(stored === 0 ? { $or: [{ paidTotal: 0 }, { paidTotal: { $exists: false } }] } : { paidTotal: stored }),
    };

    let updated;
    try {
      updated = await Settlement.findOneAndUpdate(
        filter,
        { $set: set, $push: { receipts: receipt }, $unset: { 'transfer.state': 1, 'transfer.message': 1 } },
        { new: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'That receipt code is already saved on another record.' });
      }
      throw err;
    }
    if (!updated) {
      return res.status(409).json({ error: 'This record just changed. Refresh and try again.' });
    }

    const isRefund = updated.type === 'refund';
    const codes = updated.receipts.map((r) => r.code).join(', ');
    const left = Math.max(round2(updated.net - newTotal), 0);

    await logAction(req, isRefund ? 'payment.refund_sent' : 'payment.payout_sent', {
      targetId: updated.payment,
      summary: `${isRefund ? 'Refund' : 'Payout'} receipt ${f.code} of ${kes(f.amount)} added${
        fullyPaid ? ', now fully sent' : `, ${kes(left)} still to send`
      }${ev.manual ? ' (entered by hand)' : ''}${softFails.length ? ' (checks overridden)' : ''}`,
      reason: softFails.length ? reason : undefined,
      meta: {
        settlementId: updated._id,
        code: f.code,
        amount: f.amount,
        failedChecks: softFails.map((c) => c.key),
        manual: ev.manual,
        partial: receipt.partial,
        phoneConfirmed: receipt.phoneConfirmed,
      },
    });

    const listing = await Listing.findById(updated.listing).select('title').lean();
    const title = listing ? listing.title : 'your item';
    const link = listing ? `/listings/${updated.listing}` : '/browse';
    const person = isRefund ? updated.buyer : updated.seller;
    if (person) {
      const whole = fullyPaid
        ? isRefund
          ? `Your refund of ${kes(newTotal)} for "${title}" was sent to your M-Pesa. Code: ${codes}.`
          : `${kes(newTotal)} for "${title}" was sent to your M-Pesa${
              updated.fee > 0 ? ` after a ${kes(updated.fee)} service fee` : ''
            }. Code: ${codes}.`
        : `Part of your ${isRefund ? 'refund' : 'payout'} for "${title}" was sent: ${kes(f.amount)} (code ${f.code}). ${kes(left)} is still to come.`;
      await notify({
        userId: person,
        actorId: req.user._id,
        type: 'payment_status',
        title: fullyPaid ? (isRefund ? 'Refund sent' : 'Payout sent') : 'Part payment sent',
        body: whole,
        link,
      });
    }

    res.json({
      ok: true,
      fullyPaid,
      message: fullyPaid
        ? `${isRefund ? 'Refund' : 'Payout'} fully sent: ${kes(newTotal)}.`
        : `Part payment of ${kes(f.amount)} saved. ${kes(left)} still to send.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/finance/settlements/:id/receipt/:receiptId/remove  { reason }
async function removeReceipt(req, res) {
  try {
    const id = String(req.params.id);
    const receiptId = String(req.params.receiptId);
    if (!isId(id) || !isId(receiptId)) return res.status(400).json({ error: 'Invalid id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });
    const r = s.receipts && s.receipts.id(receiptId);
    if (!r) return res.status(404).json({ error: 'Receipt not found' });

    const stored = Number(s.paidTotal) || 0;
    const newTotal = Math.max(round2(stored - r.amount), 0);
    const done = await Settlement.findOneAndUpdate(
      { _id: s._id, paidTotal: stored, 'receipts._id': r._id },
      {
        $pull: { receipts: { _id: r._id } },
        $set: { paidTotal: newTotal, status: 'due' },
        $unset: { paidAt: 1, paidBy: 1, paidByName: 1 },
      },
      { new: true }
    );
    if (!done) return res.status(409).json({ error: 'This record just changed. Refresh and try again.' });

    await logAction(req, 'payment.settlement_undo', {
      targetId: done.payment,
      summary: `Removed receipt ${r.code} (${kes(r.amount)}) from a ${done.type}; ${kes(
        Math.max(round2(done.net - newTotal), 0)
      )} is owed again`,
      reason,
      meta: { settlementId: done._id, code: r.code, amount: r.amount },
    });

    res.json({ ok: true, message: `Receipt ${r.code} removed.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { checkReceipt, addReceipt, removeReceipt };