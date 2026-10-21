const Payment = require('../models/Payment');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const AuditLog = require('../models/AuditLog');
const { notify } = require('../utils/notify');
const { normalizeKenyanPhone } = require('../utils/phone');
const {
  getFeeRates,
  setFeeRates,
  rateFor,
  isFeeConfigured,
  MAX_FEE_PERCENT,
} = require('../utils/financeSettings');
const { syncSettlements, calcFee, EXPECTED_STATUS } = require('../utils/finance');

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = '+03:00'; // Kenya is UTC+3 all year
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_ROWS = 10000;
const TYPES = ['payout', 'refund'];
const STATUSES = ['due', 'paid'];
const REFERENCE_RX = /^[A-Z0-9][A-Z0-9\-_.]{3,29}$/;

// ---------- helpers ----------

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 20) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

function dayKey(date) {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function dayStart(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T00:00:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayEnd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T23:59:59.999+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Nairobi time, like 2026-10-12 14:05:09
function eat(d) {
  return d ? new Date(new Date(d).getTime() + TZ_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) : '';
}

// Quotes cells that need it. Text starting with = + - @ gets a leading apostrophe so a
// spreadsheet can't run it as a formula.
function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sendCsv(res, filename, headers, rows) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}\r\n`);
}

async function logAction(req, action, { targetType = 'payment', targetId, summary, reason, meta } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      summary,
      reason: reason || undefined,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// Payment amount, falling back to the listing price when amount wasn't stored
function amountStages() {
  return [
    {
      $lookup: {
        from: Listing.collection.name,
        localField: 'listing',
        foreignField: '_id',
        as: '_l',
      },
    },
    {
      $addFields: {
        _amt: {
          $ifNull: ['$amount', { $ifNull: [{ $arrayElemAt: ['$_l.price', 0] }, 0] }],
        },
      },
    },
  ];
}

const SETTLEMENT_POPULATE = [
  { path: 'payment', select: 'checkoutRequestId mpesaReceipt phone status amount askingPrice' },
  { path: 'listing', select: 'title category' },
  { path: 'seller', select: 'fullName email phone' },
  { path: 'buyer', select: 'fullName email phone' },
];

function person(u) {
  return u ? { _id: u._id, fullName: u.fullName, email: u.email, phone: u.phone || '' } : null;
}

function shapeSettlement(s) {
  const payment = s.payment && s.payment.checkoutRequestId ? s.payment : null;
  const listing = s.listing && typeof s.listing.title === 'string' ? s.listing : null;
  const seller = s.seller && s.seller.fullName ? s.seller : null;
  const buyer = s.buyer && s.buyer.fullName ? s.buyer : null;
  const isRefund = s.type === 'refund';

  // Payouts go to the seller's phone. Refunds go back to the number that paid.
  const sendTo = isRefund
    ? {
        name: buyer ? buyer.fullName : 'Deleted user',
        phone: (payment && payment.phone) || (buyer && buyer.phone) || '',
      }
    : {
        name: seller ? seller.fullName : 'Unknown seller',
        phone: (seller && seller.phone) || '',
      };

  return {
    _id: s._id,
    type: s.type,
    status: s.status,
    category: s.category || (listing && listing.category) || '',
    gross: s.gross,
    askingPrice: payment && payment.askingPrice != null ? payment.askingPrice : null,
    feePercent: s.feePercent || 0,
    fee: s.fee || 0,
    net: s.net,
    reference: s.reference || '',
    note: s.note || '',
    eventAt: s.eventAt,
    paidAt: s.paidAt || null,
    paidByName: s.paidByName || '',
    paymentStatus: payment ? payment.status : null,
    mismatch: s.status === 'paid' && !!payment && payment.status !== EXPECTED_STATUS[s.type],
    mpesaReceipt: payment ? payment.mpesaReceipt || '' : '',
    checkoutRequestId: payment ? payment.checkoutRequestId : '',
    listing: listing ? { _id: listing._id, title: listing.title } : null,
    seller: person(seller),
    buyer: person(buyer),
    sendTo,
  };
}

// ---------- overview ----------

// GET /api/admin/finance/overview
async function getOverview(req, res) {
  try {
    await syncSettlements();
    const [rates, configured] = await Promise.all([getFeeRates(), isFeeConfigured()]);

    const now = Date.now();
    const d3 = new Date(now - 3 * DAY_MS);
    const d7 = new Date(now - 7 * DAY_MS);
    const d30 = new Date(now - 30 * DAY_MS);

    // The fee rate that applies to a held payment depends on the listing's category
    const rateExpr = {
      $cond: [
        { $eq: [{ $arrayElemAt: ['$_l.category', 0] }, 'phone'] },
        rates.phone / 100,
        rates.general / 100,
      ],
    };

    const paidSince = (since) => ({
      $cond: [{ $and: [{ $eq: ['$status', 'paid'] }, { $gte: ['$paidAt', since] }] }, '$net', 0],
    });

    const [heldRows, setRows, noReceipt, needsReview, changedRows, owedBySeller, byCategory] = await Promise.all([
      // Money being held, and the fee we would keep from it
      Payment.aggregate([
        { $match: { status: 'held' } },
        ...amountStages(),
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$_amt' },
            fee: { $sum: { $floor: { $add: [{ $multiply: ['$_amt', rateExpr] }, 0.5] } } },
            overdue: { $sum: { $cond: [{ $lt: ['$updatedAt', d3] }, 1, 0] } },
          },
        },
      ]),
      // Payouts and refunds, split by status
      Settlement.aggregate([
        {
          $group: {
            _id: { type: '$type', status: '$status' },
            count: { $sum: 1 },
            gross: { $sum: '$gross' },
            fee: { $sum: '$fee' },
            net: { $sum: '$net' },
            last7: { $sum: paidSince(d7) },
            last30: { $sum: paidSince(d30) },
            feeLast30: { $sum: { $cond: [{ $gte: ['$eventAt', d30] }, '$fee', 0] } },
            overdue: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$status', 'due'] }, { $lt: ['$eventAt', d3] }] }, 1, 0],
              },
            },
          },
        },
      ]),
      // Marked as paid but no M-Pesa receipt on file
      Payment.countDocuments({
        status: { $in: ['held', 'released'] },
        $or: [{ mpesaReceipt: { $exists: false } }, { mpesaReceipt: null }, { mpesaReceipt: '' }],
      }),
      Payment.countDocuments({ needsReview: true }),
      // Already sent out, but the payment status was changed afterwards
      Settlement.aggregate([
        { $match: { status: 'paid' } },
        {
          $lookup: {
            from: Payment.collection.name,
            localField: 'payment',
            foreignField: '_id',
            as: '_p',
          },
        },
        { $match: { '_p.0': { $exists: true } } },
        { $addFields: { _ps: { $arrayElemAt: ['$_p.status', 0] } } },
        {
          $match: {
            $expr: {
              $ne: ['$_ps', { $cond: [{ $eq: ['$type', 'payout'] }, 'released', 'refunded'] }],
            },
          },
        },
        { $count: 'n' },
      ]),
      // Who is owed the most
      Settlement.aggregate([
        { $match: { type: 'payout', status: 'due', seller: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$seller',
            count: { $sum: 1 },
            net: { $sum: '$net' },
            oldest: { $min: '$eventAt' },
          },
        },
        { $sort: { net: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: User.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: '_u',
          },
        },
        {
          $project: {
            count: 1,
            net: 1,
            oldest: 1,
            name: { $arrayElemAt: ['$_u.fullName', 0] },
            phone: { $arrayElemAt: ['$_u.phone', 0] },
          },
        },
      ]),
      // Released sales and the fees earned, split by listing category
      Settlement.aggregate([
        { $match: { type: 'payout' } },
        {
          $group: {
            _id: { $ifNull: ['$category', 'other'] },
            count: { $sum: 1 },
            gross: { $sum: '$gross' },
            fee: { $sum: '$fee' },
          },
        },
        { $sort: { fee: -1 } },
      ]),
    ]);

    const empty = { count: 0, gross: 0, fee: 0, net: 0, last7: 0, last30: 0, feeLast30: 0, overdue: 0 };
    const pick = (type, status) =>
      setRows.find((r) => r._id.type === type && r._id.status === status) || empty;

    const H = heldRows[0] || { count: 0, total: 0, fee: 0, overdue: 0 };
    const payoutsDue = pick('payout', 'due');
    const payoutsPaid = pick('payout', 'paid');
    const refundsDue = pick('refund', 'due');
    const refundsPaid = pick('refund', 'paid');

    res.json({
      feeRates: rates,
      feeConfigured: configured,
      held: {
        count: H.count,
        total: H.total,
        fee: H.fee,
        payout: H.total - H.fee,
        overdue: H.overdue,
      },
      payoutsDue: {
        count: payoutsDue.count,
        gross: payoutsDue.gross,
        fee: payoutsDue.fee,
        net: payoutsDue.net,
        overdue: payoutsDue.overdue,
      },
      payoutsPaid: {
        count: payoutsPaid.count,
        net: payoutsPaid.net,
        last7: payoutsPaid.last7,
        last30: payoutsPaid.last30,
      },
      refundsDue: { count: refundsDue.count, total: refundsDue.net, overdue: refundsDue.overdue },
      refundsPaid: { count: refundsPaid.count, total: refundsPaid.net, last30: refundsPaid.last30 },
      fees: {
        earned: payoutsDue.fee + payoutsPaid.fee,
        last30: payoutsDue.feeLast30 + payoutsPaid.feeLast30,
        expected: H.fee,
      },
      byCategory: byCategory.map((c) => ({
        category: c._id,
        count: c.count,
        gross: c.gross,
        fee: c.fee,
      })),
      // Money that belongs to buyers and sellers, not to us
      owedToOthers: H.total + payoutsDue.net + refundsDue.net,
      alerts: {
        noReceipt,
        needsReview,
        changedAfterPaid: changedRows[0] ? changedRows[0].n : 0,
      },
      owedBySeller: owedBySeller.map((r) => ({
        sellerId: r._id,
        name: r.name || 'Deleted user',
        phone: r.phone || '',
        count: r.count,
        net: r.net,
        oldest: r.oldest,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- lists ----------

// GET /api/admin/finance/settlements?type=&status=&search=&page=
async function getSettlements(req, res) {
  try {
    await syncSettlements();
    const { type = 'all', status = 'all', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const and = [];
    if (TYPES.includes(type)) and.push({ type });
    if (STATUSES.includes(status)) and.push({ status });

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const normalized = normalizeKenyanPhone(term);
      const userOr = [{ fullName: rx }, { email: rx }, { phone: rx }];
      if (normalized) userOr.push({ phone: normalized });

      const [users, listings, payments] = await Promise.all([
        User.find({ $or: userOr }).select('_id').limit(50).lean(),
        Listing.find({ title: rx }).select('_id').limit(50).lean(),
        Payment.find({
          $or: [{ checkoutRequestId: rx }, { mpesaReceipt: rx }, { phone: normalized || rx }],
        })
          .select('_id')
          .limit(50)
          .lean(),
      ]);
      const or = [{ reference: rx }];
      if (users.length) {
        const ids = users.map((u) => u._id);
        or.push({ seller: { $in: ids } }, { buyer: { $in: ids } });
      }
      if (listings.length) or.push({ listing: { $in: listings.map((l) => l._id) } });
      if (payments.length) or.push({ payment: { $in: payments.map((p) => p._id) } });
      and.push({ $or: or });
    }
    const query = and.length ? { $and: and } : {};

    // Oldest first for money still owed, newest first for what has been sent
    const sort =
      status === 'due' ? { eventAt: 1 } : status === 'paid' ? { paidAt: -1 } : { eventAt: -1 };

    const [rows, total] = await Promise.all([
      Settlement.find(query).sort(sort).skip(skip).limit(limit).populate(SETTLEMENT_POPULATE).lean(),
      Settlement.countDocuments(query),
    ]);

    res.json({
      settlements: rows.map(shapeSettlement),
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/finance/held?page=   (money being held, longest first)
async function getHeld(req, res) {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const rates = await getFeeRates();

    const [rows, total] = await Promise.all([
      Payment.find({ status: 'held' })
        .sort({ updatedAt: 1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'listing',
          select: 'title price seller category',
          populate: { path: 'seller', select: 'fullName phone' },
        })
        .populate('buyer', 'fullName')
        .lean(),
      Payment.countDocuments({ status: 'held' }),
    ]);

    const payments = rows.map((p) => {
      const listing = p.listing && typeof p.listing.title === 'string' ? p.listing : null;
      const amount = p.amount != null ? p.amount : listing ? listing.price : 0;
      const rate = rateFor(rates, listing ? listing.category : undefined);
      const fee = calcFee(amount, rate);
      return {
        _id: p._id,
        checkoutRequestId: p.checkoutRequestId,
        amount,
        askingPrice: p.askingPrice != null ? p.askingPrice : null,
        category: listing ? listing.category : '',
        feePercent: rate,
        fee,
        sellerGets: amount - fee,
        heldSince: p.updatedAt,
        daysHeld: Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / DAY_MS),
        mpesaReceipt: p.mpesaReceipt || '',
        needsReview: !!p.needsReview,
        listing: listing ? { _id: listing._id, title: listing.title } : null,
        buyerName: p.buyer && p.buyer.fullName ? p.buyer.fullName : 'Deleted user',
        sellerName: listing && listing.seller && listing.seller.fullName ? listing.seller.fullName : 'Unknown',
        sellerPhone: listing && listing.seller && listing.seller.phone ? listing.seller.phone : '',
      };
    });

    res.json({ payments, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- trends ----------

// GET /api/admin/finance/trends?days=7|30|90
async function getTrends(req, res) {
  try {
    const asked = parseInt(req.query.days, 10);
    const days = [7, 30, 90].includes(asked) ? asked : 30;

    const keys = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      keys.push(dayKey(new Date(Date.now() - i * DAY_MS)));
    }
    const start = new Date(`${keys[0]}T00:00:00+03:00`);

    const dayField = (field) => ({
      $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ },
    });
    const toMap = (rows) => new Map(rows.map((r) => [r._id, r.total]));

    const [inRows, feeRows, paidRows, refundRows] = await Promise.all([
      Payment.aggregate([
        { $match: { createdAt: { $gte: start }, status: { $in: ['held', 'released', 'refunded'] } } },
        ...amountStages(),
        { $group: { _id: dayField('$createdAt'), total: { $sum: '$_amt' } } },
      ]),
      Settlement.aggregate([
        { $match: { type: 'payout', eventAt: { $gte: start } } },
        { $group: { _id: dayField('$eventAt'), total: { $sum: '$fee' } } },
      ]),
      Settlement.aggregate([
        { $match: { type: 'payout', status: 'paid', paidAt: { $gte: start } } },
        { $group: { _id: dayField('$paidAt'), total: { $sum: '$net' } } },
      ]),
      Settlement.aggregate([
        { $match: { type: 'refund', status: 'paid', paidAt: { $gte: start } } },
        { $group: { _id: dayField('$paidAt'), total: { $sum: '$net' } } },
      ]),
    ]);

    const moneyIn = toMap(inRows);
    const fees = toMap(feeRows);
    const paidOut = toMap(paidRows);
    const refunded = toMap(refundRows);

    res.json({
      days,
      series: keys.map((date) => ({
        date,
        moneyIn: moneyIn.get(date) || 0,
        fees: fees.get(date) || 0,
        paidOut: paidOut.get(date) || 0,
        refunded: refunded.get(date) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- fee ----------

function parseRate(raw) {
  if (raw === '' || raw === null || raw === undefined) return NaN;
  return Number(raw);
}

function rateProblem(n, label) {
  if (!Number.isFinite(n) || n < 0 || n > MAX_FEE_PERCENT) {
    return `Enter a fee from 0 to ${MAX_FEE_PERCENT}% for ${label}`;
  }
  if (Math.round(n * 100) / 100 !== n) return `Use at most 2 decimal places for ${label}`;
  return '';
}

// PATCH /api/admin/finance/settings/fee  { phone, general, reason, applyToDue }
async function setFee(req, res) {
  try {
    const phone = parseRate(req.body?.phone);
    const general = parseRate(req.body?.general);
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const applyToDue = req.body?.applyToDue === true;

    const problem = rateProblem(phone, 'phones') || rateProblem(general, 'other items');
    if (problem) return res.status(400).json({ error: problem });
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Please give a reason for this change' });
    }

    const [before, configured] = await Promise.all([getFeeRates(), isFeeConfigured()]);
    if (configured && before.phone === phone && before.general === general && !applyToDue) {
      return res.status(400).json({ error: 'Those are already the current fees' });
    }

    const rates = { phone, general };
    await setFeeRates(rates);

    // Optionally re-price payouts that have not been sent yet (rows already sent never change)
    let updated = 0;
    if (applyToDue) {
      const due = await Settlement.find({ type: 'payout', status: 'due' })
        .select('gross category listing')
        .populate('listing', 'category')
        .lean();
      if (due.length) {
        const ops = due.map((d) => {
          const category = d.category || (d.listing && d.listing.category) || undefined;
          const rate = rateFor(rates, category);
          const fee = calcFee(d.gross, rate);
          const set = { feePercent: rate, fee, net: d.gross - fee };
          if (category) set.category = category;
          return {
            updateOne: {
              filter: { _id: d._id, status: 'due', type: 'payout' },
              update: { $set: set },
            },
          };
        });
        const result = await Settlement.bulkWrite(ops, { ordered: false });
        updated = result.modifiedCount || 0;
      }
    }

    await logAction(req, 'settings.fee_rate', {
      targetType: 'settings',
      summary: `Fees changed: phones ${before.phone}% to ${phone}%, other items ${before.general}% to ${general}%${
        applyToDue ? ` (also applied to ${updated} unsent payout${updated === 1 ? '' : 's'})` : ''
      }`,
      reason,
      meta: { from: before, to: rates, applyToDue, updated },
    });

    res.json({
      feeRates: rates,
      updated,
      message: `Fees set: phones ${phone}%, other items ${general}%.${
        applyToDue
          ? ` ${updated} unsent payout${updated === 1 ? '' : 's'} updated.`
          : ' They apply to payments released from now on.'
      }`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- mark as sent / undo ----------

// POST /api/admin/finance/settlements/:id/paid  { reference, note }
async function markPaid(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });

    const reference = String(req.body?.reference || '').trim().toUpperCase();
    const note = String(req.body?.note || '').trim().slice(0, 300);
    if (!REFERENCE_RX.test(reference)) {
      return res.status(400).json({
        error: 'Enter the M-Pesa confirmation code (4 to 30 letters or numbers)',
      });
    }

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });
    if (s.status === 'paid') return res.status(409).json({ error: 'This is already marked as sent' });

    const payment = await Payment.findById(s.payment).select('status checkoutRequestId').lean();
    if (!payment || payment.status !== EXPECTED_STATUS[s.type]) {
      return res.status(409).json({
        error: 'The payment status changed since this page loaded. Refresh and check it first.',
      });
    }

    const update = {
      status: 'paid',
      reference,
      paidAt: new Date(),
      paidBy: req.user._id,
      paidByName: req.user.fullName,
    };
    if (note) update.note = note;

    let updated;
    try {
      updated = await Settlement.findOneAndUpdate({ _id: s._id, status: 'due' }, update, { new: true });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'That confirmation code is already saved on another record.' });
      }
      throw err;
    }
    if (!updated) return res.status(409).json({ error: 'This was already marked as sent by someone else.' });

    const isRefund = updated.type === 'refund';
    await logAction(req, isRefund ? 'payment.refund_sent' : 'payment.payout_sent', {
      targetId: updated.payment,
      summary: `${isRefund ? 'Refund' : 'Payout'} of KES ${updated.net} marked as sent (payment ${payment.checkoutRequestId}, code ${reference})`,
      meta: { settlementId: updated._id, net: updated.net, fee: updated.fee, reference },
    });

    const listing = await Listing.findById(updated.listing).select('title').lean();
    const title = listing ? listing.title : 'your item';
    const link = listing ? `/listings/${updated.listing}` : '/browse';
    if (isRefund && updated.buyer) {
      await notify({
        userId: updated.buyer,
        actorId: req.user._id,
        type: 'payment_status',
        title: 'Refund sent',
        body: `Your refund of KES ${updated.net} for "${title}" was sent to your M-Pesa. Code: ${reference}.`,
        link,
      });
    } else if (!isRefund && updated.seller) {
      await notify({
        userId: updated.seller,
        actorId: req.user._id,
        type: 'payment_status',
        title: 'Payout sent',
        body: `KES ${updated.net} for "${title}" was sent to your M-Pesa${
          updated.fee > 0 ? ` after a KES ${updated.fee} service fee` : ''
        }. Code: ${reference}.`,
        link,
      });
    }

    res.json({
      ok: true,
      message: `${isRefund ? 'Refund' : 'Payout'} of KES ${updated.net.toLocaleString('en-US')} marked as sent.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/finance/settlements/:id/undo  { reason }
async function undoPaid(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid record id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const s = await Settlement.findById(id);
    if (!s) return res.status(404).json({ error: 'Record not found' });
    if (s.status !== 'paid') return res.status(409).json({ error: 'This is not marked as sent' });

    const previousCode = s.reference;
    const done = await Settlement.findOneAndUpdate(
      { _id: s._id, status: 'paid' },
      {
        $set: { status: 'due' },
        $unset: { reference: 1, paidAt: 1, paidBy: 1, paidByName: 1, note: 1 },
      },
      { new: true }
    );
    if (!done) return res.status(409).json({ error: 'This record changed. Refresh and try again.' });

    await logAction(req, 'payment.settlement_undo', {
      targetId: done.payment,
      summary: `Moved a ${done.type} of KES ${done.net} back to "to send"${previousCode ? ` (was code ${previousCode})` : ''}`,
      reason,
      meta: { settlementId: done._id, previousCode: previousCode || null },
    });

    res.json({ ok: true, message: 'Moved back to "to send".' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- CSV export ----------

// GET /api/admin/export/finance.csv?type=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD
async function exportFinance(req, res) {
  try {
    await syncSettlements();
    const { type = 'all', status = 'all', from = '', to = '' } = req.query;

    const query = {};
    if (TYPES.includes(type)) query.type = type;
    if (STATUSES.includes(status)) query.status = status;

    const start = dayStart(from);
    const end = dayEnd(to);
    if (from && !start) return res.status(400).json({ error: 'Invalid start date' });
    if (to && !end) return res.status(400).json({ error: 'Invalid end date' });
    if (start || end) {
      query.eventAt = {};
      if (start) query.eventAt.$gte = start;
      if (end) query.eventAt.$lte = end;
    }

    const total = await Settlement.countDocuments(query);
    if (total > MAX_ROWS) {
      return res.status(400).json({
        error: `That is ${total} records, more than the ${MAX_ROWS} limit. Narrow the dates.`,
      });
    }

    const rows = await Settlement.find(query)
      .sort({ eventAt: -1 })
      .populate(SETTLEMENT_POPULATE)
      .lean();

    const headers = [
      'Released or refunded (EAT)',
      'Type',
      'Status',
      'Listing',
      'Category',
      'Seller',
      'Buyer',
      'Send to',
      'Send to phone',
      'Asking price (KES)',
      'Agreed price paid (KES)',
      'Fee %',
      'Fee (KES)',
      'To send (KES)',
      'Confirmation code',
      'Sent (EAT)',
      'Sent by',
      'Buyer M-Pesa receipt',
      'Checkout ID',
    ];

    const out = rows.map((r) => {
      const s = shapeSettlement(r);
      const categoryLabel = s.category === 'phone' ? 'Phone' : s.category ? 'Other item' : '';
      return [
        eat(s.eventAt),
        s.type === 'refund' ? 'Refund' : 'Payout',
        s.status === 'paid' ? 'Sent' : 'To send',
        s.listing ? s.listing.title : 'Deleted listing',
        categoryLabel,
        s.seller ? s.seller.fullName : '',
        s.buyer ? s.buyer.fullName : 'Deleted user',
        s.sendTo.name,
        s.sendTo.phone,
        s.askingPrice,
        s.gross,
        s.feePercent,
        s.fee,
        s.net,
        s.reference,
        eat(s.paidAt),
        s.paidByName,
        s.mpesaReceipt,
        s.checkoutRequestId,
      ];
    });

    await logAction(req, 'export.finance', {
      targetType: 'export',
      summary: `Exported ${out.length} finance records to CSV`,
      meta: { rows: out.length, type, status, from: from || null, to: to || null },
    });

    sendCsv(res, 'safeswap-finance.csv', headers, out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOverview,
  getSettlements,
  getHeld,
  getTrends,
  setFee,
  markPaid,
  undoPaid,
  exportFinance,
};