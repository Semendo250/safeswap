const User = require('../models/User');
const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const Offer = require('../models/Offer');
const AuditLog = require('../models/AuditLog');
const { normalizeKenyanPhone } = require('../utils/phone');

const PAYMENT_STATUSES = ['pending', 'held', 'released', 'failed', 'refunded'];
const MAX_ROWS = 10000;
const EAT_MS = 3 * 60 * 60 * 1000; // Nairobi is UTC+3 all year

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Nairobi time, like 2026-10-12 14:05:09
function eat(d) {
  return d ? new Date(new Date(d).getTime() + EAT_MS).toISOString().replace('T', ' ').slice(0, 19) : '';
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
  // The BOM makes Excel read the file as UTF-8
  res.send(`\uFEFF${body}\r\n`);
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

async function logAction(req, action, summary, meta) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType: 'export',
      summary,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// GET /api/admin/export/payments.csv?status=&from=YYYY-MM-DD&to=YYYY-MM-DD
async function exportPayments(req, res) {
  try {
    const { status = 'all', from = '', to = '' } = req.query;
    const query = {};
    if (PAYMENT_STATUSES.includes(status)) query.status = status;

    const start = dayStart(from);
    const end = dayEnd(to);
    if (from && !start) return res.status(400).json({ error: 'Invalid start date' });
    if (to && !end) return res.status(400).json({ error: 'Invalid end date' });
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    const total = await Payment.countDocuments(query);
    if (total > MAX_ROWS) {
      return res.status(400).json({
        error: `That is ${total} payments, more than the ${MAX_ROWS} limit. Narrow the dates or pick a status.`,
      });
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate([
        { path: 'listing', select: 'title price seller', populate: { path: 'seller', select: 'fullName email' } },
        { path: 'buyer', select: 'fullName email phone' },
      ])
      .lean();

    const headers = [
      'Date (EAT)',
      'Last change (EAT)',
      'Status',
      'Amount (KES)',
      'Listing',
      'Buyer',
      'Buyer email',
      'Buyer phone',
      'Paid from',
      'Seller',
      'Seller email',
      'M-Pesa receipt',
      'Checkout ID',
    ];

    const rows = payments.map((p) => {
      const listing = p.listing && typeof p.listing.title === 'string' ? p.listing : null;
      const seller = listing && listing.seller && listing.seller.fullName ? listing.seller : null;
      const buyer = p.buyer && p.buyer.fullName ? p.buyer : null;
      const amount = p.amount != null ? p.amount : listing ? listing.price : null;
      return [
        eat(p.createdAt),
        eat(p.updatedAt),
        p.status,
        amount,
        listing ? listing.title : 'Deleted listing',
        buyer ? buyer.fullName : 'Deleted user',
        buyer ? buyer.email : '',
        buyer ? buyer.phone || '' : '',
        p.phone || '',
        seller ? seller.fullName : '',
        seller ? seller.email : '',
        p.mpesaReceipt || '',
        p.checkoutRequestId,
      ];
    });

    await logAction(req, 'export.payments', `Exported ${rows.length} payments to CSV`, {
      rows: rows.length,
      status,
      from: from || null,
      to: to || null,
    });

    sendCsv(res, 'safeswap-payments.csv', headers, rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/export/users.csv?filter=&search=
async function exportUsers(req, res) {
  try {
    const { filter = 'all', search = '' } = req.query;

    const query = {};
    if (filter === 'unverified') query.emailVerified = false;
    else if (filter === 'banned') query.isBanned = true;
    else if (filter === 'admins') query.role = 'admin';

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ fullName: rx }, { email: rx }, { studentRegNo: rx }, { phone: rx }];
      const normalized = normalizeKenyanPhone(term);
      if (normalized) query.$or.push({ phone: normalized });
    }

    const total = await User.countDocuments(query);
    if (total > MAX_ROWS) {
      return res.status(400).json({
        error: `That is ${total} users, more than the ${MAX_ROWS} limit. Use a filter or search to narrow it.`,
      });
    }

    const users = await User.find(query)
      .select(
        'fullName email studentRegNo phone location role isBanned emailVerified verificationPath ' +
          'fallbackApproved fallbackRejected trustScore completedSales reportCount createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    const ids = users.map((u) => u._id);
    const counts = ids.length
      ? await Listing.aggregate([
          { $match: { seller: { $in: ids } } },
          { $group: { _id: '$seller', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    const headers = [
      'Joined (EAT)',
      'Name',
      'Email',
      'Reg number',
      'Phone',
      'Location',
      'Role',
      'Banned',
      'Email verified',
      'ID verification',
      'Trust score',
      'Completed sales',
      'Reports against',
      'Listings',
    ];

    const rows = users.map((u) => {
      let idStatus = 'University email';
      if (u.verificationPath === 'fallback') {
        idStatus = u.fallbackApproved ? 'ID approved' : u.fallbackRejected ? 'ID rejected' : 'ID pending';
      }
      const reg = u.studentRegNo ? String(u.studentRegNo).trim() : '';
      return [
        eat(u.createdAt),
        u.fullName,
        u.email,
        reg && !['undefined', 'null'].includes(reg.toLowerCase()) ? reg : '',
        u.phone || '',
        u.location || '',
        u.role,
        !!u.isBanned,
        !!u.emailVerified,
        idStatus,
        u.trustScore,
        u.completedSales,
        u.reportCount,
        countMap.get(String(u._id)) || 0,
      ];
    });

    await logAction(req, 'export.users', `Exported ${rows.length} users to CSV`, {
      rows: rows.length,
      filter,
      search: term || null,
    });

    sendCsv(res, 'safeswap-users.csv', headers, rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const OFFER_STATUSES = ['pending', 'accepted', 'declined', 'replaced', 'expired', 'closed', 'paid'];

// GET /api/admin/export/offers.csv?status=&from=YYYY-MM-DD&to=YYYY-MM-DD
async function exportOffers(req, res) {
  try {
    const { status = 'all', from = '', to = '' } = req.query;
    const query = {};
    if (OFFER_STATUSES.includes(status)) query.status = status;

    const start = dayStart(from);
    const end = dayEnd(to);
    if (from && !start) return res.status(400).json({ error: 'Invalid start date' });
    if (to && !end) return res.status(400).json({ error: 'Invalid end date' });
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    const total = await Offer.countDocuments(query);
    if (total > MAX_ROWS) {
      return res.status(400).json({
        error: `That is ${total} offers, more than the ${MAX_ROWS} limit. Narrow the dates or pick a status.`,
      });
    }

    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .populate([
        { path: 'listing', select: 'title' },
        { path: 'buyer', select: 'fullName email' },
        { path: 'seller', select: 'fullName email' },
        { path: 'proposedBy', select: 'fullName' },
      ])
      .lean();

    const headers = [
      'Date (EAT)',
      'Listing',
      'Buyer',
      'Buyer email',
      'Seller',
      'Seller email',
      'Proposed by',
      'Offer (KES)',
      'Asking (KES)',
      'Discount %',
      'Status',
      'Agreed (EAT)',
    ];

    const rows = offers.map((o) => {
      const discount =
        o.askingPrice > 0 ? Math.round(((o.askingPrice - o.amount) / o.askingPrice) * 1000) / 10 : '';
      return [
        eat(o.createdAt),
        o.listing ? o.listing.title : 'Deleted listing',
        o.buyer ? o.buyer.fullName : 'Deleted user',
        o.buyer ? o.buyer.email : '',
        o.seller ? o.seller.fullName : 'Deleted user',
        o.seller ? o.seller.email : '',
        o.proposedBy ? o.proposedBy.fullName : 'Deleted user',
        o.amount,
        o.askingPrice,
        discount,
        o.status,
        eat(o.acceptedAt),
      ];
    });

    await logAction(req, 'export.offers', `Exported ${rows.length} offers to CSV`, {
      rows: rows.length,
      status,
      from: from || null,
      to: to || null,
    });

    sendCsv(res, 'safeswap-offers.csv', headers, rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { exportPayments, exportUsers, exportOffers };