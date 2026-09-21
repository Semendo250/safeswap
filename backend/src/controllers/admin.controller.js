const Listing = require('../models/Listing');
const User = require('../models/User');
const BlacklistIMEI = require('../models/BlacklistIMEI');
const Report = require('../models/Report');
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const PasswordResetToken = require('../models/PasswordResetToken');
const { calculateTrustScore } = require('../utils/trustScore');
const { normalizeKenyanPhone } = require('../utils/phone');

const PAYMENT_STATUSES = ['pending', 'held', 'released', 'failed', 'refunded'];
const LISTING_STATUSES = ['active', 'under_review', 'removed', 'sold'];

const USER_LIST_FIELDS =
  'fullName email studentRegNo phone location profilePicture role isBanned emailVerified ' +
  'phoneVerified verificationPath fallbackApproved fallbackRejected trustScore completedSales ' +
  'reportCount createdAt';

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

function bodyReason(req) {
  return String(req.body?.reason || '').trim().slice(0, 300);
}

// Writes one row to the audit log. Never blocks or breaks the action itself.
async function logAction(req, action, { targetType, targetId, summary, reason, meta } = {}) {
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

const PAYMENT_POPULATE = [
  {
    path: 'listing',
    select: 'title price status seller',
    populate: { path: 'seller', select: 'fullName email phone' },
  },
  { path: 'buyer', select: 'fullName email phone' },
];

// One payment, in the shape the admin pages expect
function shapePayment(p) {
  const listing = p.listing && typeof p.listing.title === 'string' ? p.listing : null;
  const buyer = p.buyer && p.buyer.fullName ? p.buyer : null;
  const seller = listing && listing.seller && listing.seller.fullName ? listing.seller : null;
  const person = (u) =>
    u ? { _id: u._id, fullName: u.fullName, email: u.email, phone: u.phone || '' } : null;
  return {
    _id: p._id,
    checkoutRequestId: p.checkoutRequestId,
    status: p.status,
    amount: p.amount != null ? p.amount : listing ? listing.price : null,
    phone: p.phone || '',
    mpesaReceipt: p.mpesaReceipt || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    listing: listing
      ? { _id: listing._id, title: listing.title, status: listing.status, price: listing.price }
      : null,
    buyer: person(buyer),
    seller: person(seller),
  };
}

async function loadPaymentForAdmin(id) {
  const p = await Payment.findById(id).populate(PAYMENT_POPULATE).lean();
  return p ? shapePayment(p) : null;
}

// ---------- overview ----------

// GET /api/admin/overview
async function getOverview(req, res) {
  try {
    const [activeListings, pendingReviews, openReports, signupsToday] = await Promise.all([
      Listing.countDocuments({ status: 'active' }),
      Listing.countDocuments({ status: 'under_review' }),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ createdAt: { $gte: new Date().setHours(0, 0, 0, 0) } }),
    ]);
    res.json({ activeListings, pendingReviews, openReports, signupsToday });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- users ----------

// GET /api/admin/users?search=&filter=all|unverified|banned|admins&page=
async function getUsers(req, res) {
  try {
    const { search = '', filter = 'all' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};
    if (filter === 'unverified') query.emailVerified = false;
    else if (filter === 'banned') query.isBanned = true;
    else if (filter === 'admins') query.role = 'admin';

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ fullName: rx }, { email: rx }, { studentRegNo: rx }, { phone: rx }];
      const normalized = normalizeKenyanPhone(term); // so "0712345678" finds "254712345678"
      if (normalized) query.$or.push({ phone: normalized });
    }

    const [users, total] = await Promise.all([
      User.find(query).select(USER_LIST_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    const ids = users.map((u) => u._id);
    const counts = ids.length
      ? await Listing.aggregate([
          { $match: { seller: { $in: ids } } },
          { $group: { _id: '$seller', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    res.json({
      users: users.map((u) => ({ ...u, listingCount: countMap.get(u._id.toString()) || 0 })),
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/users/:id
async function getUserById(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [listings, payments] = await Promise.all([
      Listing.find({ seller: user._id })
        .select('title price status category createdAt reportCount')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Payment.find({ buyer: user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate(PAYMENT_POPULATE)
        .lean(),
    ]);

    res.json({ user, listings, payments: payments.map(shapePayment) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/users/:id/ban   body: { banned: true|false, reason }
async function setUserBan(req, res) {
  try {
    const { id } = req.params;
    const banned = req.body?.banned === true;
    const reason = bodyReason(req);

    if (!isId(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (id === req.user._id.toString()) {
      return res.status(400).json({ error: "You can't ban yourself" });
    }
    if (banned && reason.length < 3) {
      return res.status(400).json({ error: 'Please give a reason for the ban' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ error: "Admins can't be banned" });
    }
    if (user.isBanned === banned) {
      return res.json({ ok: true, isBanned: banned, hiddenListings: 0, keptListings: 0 });
    }

    await User.updateOne({ _id: user._id }, { isBanned: banned });

    let hidden = 0;
    let kept = 0;
    if (banned) {
      // Hide their listings, except ones with money held: those stay until the
      // payment is settled on the Payments page
      const listings = await Listing.find({
        seller: user._id,
        status: { $in: ['active', 'under_review'] },
      })
        .select('_id')
        .lean();
      const listingIds = listings.map((l) => l._id);
      if (listingIds.length) {
        const heldRows = await Payment.find({ listing: { $in: listingIds }, status: 'held' })
          .select('listing')
          .lean();
        const heldSet = new Set(heldRows.map((p) => p.listing.toString()));
        const toHide = listingIds.filter((lid) => !heldSet.has(lid.toString()));
        kept = listingIds.length - toHide.length;
        if (toHide.length) {
          await Listing.updateMany({ _id: { $in: toHide } }, { status: 'removed' });
          hidden = toHide.length;
        }
      }
    }

    await logAction(req, banned ? 'user.ban' : 'user.unban', {
      targetType: 'user',
      targetId: user._id,
      summary: `${banned ? 'Banned' : 'Unbanned'} ${user.fullName} (${user.email})`,
      reason,
      meta: { hiddenListings: hidden, keptListings: kept },
    });

    res.json({ ok: true, isBanned: banned, hiddenListings: hidden, keptListings: kept });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/users/:id/verify  - marks the email as verified (e.g. the OTP email never arrived)
async function verifyUserEmail(req, res) {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(id).select('fullName email emailVerified');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

    await User.updateOne({ _id: user._id }, { emailVerified: true });
    await logAction(req, 'user.verify', {
      targetType: 'user',
      targetId: user._id,
      summary: `Marked ${user.fullName} (${user.email}) as email verified`,
      reason: bodyReason(req),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/users/:id   body: { reason }
// Permanent. Refused for users with payment history: ban those instead.
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const reason = bodyReason(req);

    if (!isId(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (id === req.user._id.toString()) {
      return res.status(400).json({ error: "You can't delete yourself" });
    }
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Please give a reason for the deletion' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ error: "Admins can't be deleted" });
    }

    const listings = await Listing.find({ seller: user._id }).select('_id').lean();
    const listingIds = listings.map((l) => l._id);

    const hasPayments = await Payment.exists({
      $or: [{ buyer: user._id }, { listing: { $in: listingIds } }],
    });
    if (hasPayments) {
      return res.status(409).json({
        error: 'This user has payment history, which must be kept. Ban them instead of deleting.',
      });
    }

    await Promise.all([
      Message.deleteMany({
        $or: [{ sender: user._id }, { receiver: user._id }, { listing: { $in: listingIds } }],
      }),
      Report.deleteMany({
        $or: [{ reportedBy: user._id }, { listing: { $in: listingIds } }],
      }),
      Listing.deleteMany({ seller: user._id }),
      PasswordResetToken.deleteMany({ email: user.email }),
    ]);
    await user.deleteOne();

    await logAction(req, 'user.delete', {
      targetType: 'user',
      targetId: id,
      summary: `Deleted ${user.fullName} (${user.email})`,
      reason,
      meta: { listingsDeleted: listingIds.length },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- listings ----------

// GET /api/admin/flagged-listings
async function getFlaggedListings(req, res) {
  try {
    const listings = await Listing.find({ status: 'under_review' })
      .sort({ createdAt: -1 })
      .populate('seller', 'fullName trustScore');
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/listings?status=&category=&search=&page=
// Every listing, with the private fields (IMEI, proof photo) that only admins may see
async function getAllListings(req, res) {
  try {
    const { status = 'all', category = 'all', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};
    if (LISTING_STATUSES.includes(status)) query.status = status;
    if (['phone', 'general'].includes(category)) query.category = category;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const sellers = await User.find({ $or: [{ fullName: rx }, { email: rx }] })
        .select('_id')
        .limit(50)
        .lean();
      query.$or = [{ title: rx }, { imei: rx }];
      if (sellers.length) query.$or.push({ seller: { $in: sellers.map((s) => s._id) } });
    }

    const [listings, total] = await Promise.all([
      Listing.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('seller', 'fullName email phone isBanned')
        .lean(),
      Listing.countDocuments(query),
    ]);

    res.json({ listings, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/listings/:id/approve
async function approveListing(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid listing id' });
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.status === 'sold') {
      return res.status(400).json({
        error: "Sold listings can't be approved again. Change the payment status instead.",
      });
    }
    const seller = await User.findById(listing.seller).select('isBanned');
    if (seller && seller.isBanned) {
      return res.status(400).json({ error: 'The seller is banned. Unban them first.' });
    }

    listing.status = 'active';
    await listing.save();

    await logAction(req, 'listing.approve', {
      targetType: 'listing',
      targetId: listing._id,
      summary: `Approved listing "${listing.title}"`,
      reason: bodyReason(req),
    });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/listings/:id/remove
async function removeListing(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid listing id' });
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status === 'removed') return res.json(listing); // already removed: don't penalize twice

    const held = await Payment.exists({ listing: listing._id, status: 'held' });
    if (held) {
      return res.status(409).json({
        error: 'Money is held for this listing. Refund or release the payment first (Payments page).',
      });
    }

    listing.status = 'removed';
    await listing.save();

    // Removing a listing for cause upholds any pending reports against it,
    // and penalizes the seller's trust score
    await Report.updateMany(
      { listing: listing._id, status: 'pending' },
      { status: 'reviewed_upheld' }
    );
    const seller = await User.findById(listing.seller);
    if (seller) {
      seller.reportCount += 1;
      seller.trustScore = calculateTrustScore(seller);
      await seller.save();
    }

    await logAction(req, 'listing.remove', {
      targetType: 'listing',
      targetId: listing._id,
      summary: `Removed listing "${listing.title}"`,
      reason: bodyReason(req),
    });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- verification ----------

// GET /api/admin/verification-queue - fallback-path users awaiting approval, oldest first
async function getVerificationQueue(req, res) {
  try {
    const users = await User.find({
      verificationPath: 'fallback',
      fallbackApproved: false,
      fallbackRejected: { $ne: true },
    })
      .select('fullName email studentRegNo phone location fallbackIdPhoto emailVerified createdAt')
      .sort({ createdAt: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/verification/:userId/approve
async function approveFallbackVerification(req, res) {
  try {
    if (!isId(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(req.params.userId).select('fullName email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.updateOne({ _id: user._id }, { fallbackApproved: true, fallbackRejected: false });
    await logAction(req, 'verification.approve', {
      targetType: 'user',
      targetId: user._id,
      summary: `Approved ID verification for ${user.fullName} (${user.email})`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/verification/:userId/reject   body: { reason }
async function rejectFallbackVerification(req, res) {
  try {
    if (!isId(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
    const user = await User.findById(req.params.userId).select('fullName email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.updateOne({ _id: user._id }, { fallbackRejected: true, fallbackApproved: false });
    await logAction(req, 'verification.reject', {
      targetType: 'user',
      targetId: user._id,
      summary: `Rejected ID verification for ${user.fullName} (${user.email})`,
      reason: bodyReason(req),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- IMEI blacklist ----------

// POST /api/admin/blacklist - add a test IMEI (simulated CA blacklist)
async function addBlacklistImei(req, res) {
  try {
    const { imei } = req.body;
    if (!imei) return res.status(400).json({ error: 'imei is required' });

    const existing = await BlacklistIMEI.findOne({ imei });
    if (existing) return res.status(409).json({ error: 'IMEI already blacklisted' });

    const entry = await BlacklistIMEI.create({ imei, addedBy: req.user._id });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/blacklist
async function getBlacklist(req, res) {
  try {
    const entries = await BlacklistIMEI.find().sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/blacklist/:id
async function removeBlacklistImei(req, res) {
  try {
    await BlacklistIMEI.findByIdAndDelete(req.params.id);
    res.json({ message: 'Removed from blacklist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- payments ----------

// GET /api/admin/payments?status=&search=&page=
async function getPayments(req, res) {
  try {
    const { status = 'all', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};
    if (PAYMENT_STATUSES.includes(status)) query.status = status;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const or = [{ checkoutRequestId: rx }, { mpesaReceipt: rx }];
      const normalized = normalizeKenyanPhone(term);
      or.push(normalized ? { phone: normalized } : { phone: rx });

      const [users, listings] = await Promise.all([
        User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').limit(50).lean(),
        Listing.find({ title: rx }).select('_id').limit(50).lean(),
      ]);
      if (users.length) or.push({ buyer: { $in: users.map((u) => u._id) } });
      if (listings.length) or.push({ listing: { $in: listings.map((l) => l._id) } });
      query.$or = or;
    }

    const [payments, total, grouped] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(PAYMENT_POPULATE)
        .lean(),
      Payment.countDocuments(query),
      Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = {};
    grouped.forEach((g) => {
      counts[g._id] = g.count;
    });

    res.json({
      payments: payments.map(shapePayment),
      counts,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/payments/:id/status   body: { status, reason }
// Changes the RECORD only. It never moves money.
async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const reason = bodyReason(req);

    if (!isId(id)) return res.status(400).json({ error: 'Invalid payment id' });
    if (!PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Please give a reason for this change' });
    }

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const previous = payment.status;
    if (previous === status) {
      return res.status(400).json({ error: `This payment is already ${status}` });
    }

    // A listing can only have one live (held or released) payment at a time
    if (status === 'held' || status === 'released') {
      const clash = await Payment.findOne({
        listing: payment.listing,
        _id: { $ne: payment._id },
        status: { $in: ['held', 'released'] },
      });
      if (clash) {
        return res.status(409).json({
          error: `Another payment for this listing is already ${clash.status}. Fix that one first.`,
        });
      }
    }

    payment.status = status;
    await payment.save();

    // Keep the listing consistent with the payment
    const listing = await Listing.findById(payment.listing);
    if (listing) {
      if (status === 'released') {
        listing.status = 'sold';
        listing.meetupConfirmed = true;
      } else if (previous === 'released' && listing.status === 'sold') {
        listing.status = 'active';
        listing.meetupConfirmed = false;
      }
      if (listing.isModified()) {
        try {
          await listing.save();
        } catch (saveErr) {
          payment.status = previous; // undo, so the two never disagree
          await payment.save();
          throw saveErr;
        }
      }
    }

    await logAction(req, 'payment.status', {
      targetType: 'payment',
      targetId: payment._id,
      summary: `Payment ${payment.checkoutRequestId}: ${previous} -> ${status}${
        listing ? ` (listing "${listing.title}")` : ''
      }`,
      reason,
      meta: {
        from: previous,
        to: status,
        listingId: payment.listing,
        listingStatusAfter: listing ? listing.status : null,
      },
    });

    res.json({
      payment: await loadPaymentForAdmin(payment._id),
      message: `Payment marked ${status}.${listing ? ` Listing is now ${listing.status}.` : ''}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- activity log ----------

// GET /api/admin/audit-log?page=
async function getAuditLog(req, res) {
  try {
    const { page, limit, skip } = pageParams(req.query, 30);
    const [entries, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);
    res.json({ entries, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOverview,
  getUsers,
  getUserById,
  setUserBan,
  verifyUserEmail,
  deleteUser,
  getFlaggedListings,
  getAllListings,
  approveListing,
  removeListing,
  getVerificationQueue,
  approveFallbackVerification,
  rejectFallbackVerification,
  addBlacklistImei,
  getBlacklist,
  removeBlacklistImei,
  getPayments,
  updatePaymentStatus,
  getAuditLog,
};