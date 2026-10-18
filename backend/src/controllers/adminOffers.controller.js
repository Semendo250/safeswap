const Offer = require('../models/Offer');
const Payment = require('../models/Payment');
const Listing = require('../models/Listing');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getOfferHours, setOfferHours } = require('../utils/settings');

const OFFER_STATUSES = ['pending', 'accepted', 'declined', 'replaced', 'expired', 'closed', 'paid'];
const DAY_MS = 24 * 60 * 60 * 1000;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function nameMap(ids) {
  const users = await User.find({ _id: { $in: ids } }).select('fullName').lean();
  return new Map(users.map((u) => [String(u._id), u.fullName]));
}

// GET /api/admin/offers/listing/:listingId
async function getListingOffers(req, res) {
  try {
    const id = String(req.params.listingId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid listing id' });

    const listing = await Listing.findById(id)
      .select('title price status seller')
      .populate('seller', 'fullName')
      .lean();
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const [offers, payments] = await Promise.all([
      Offer.find({ listing: id })
        .sort({ createdAt: 1 })
        .populate('buyer', 'fullName')
        .populate('proposedBy', 'fullName')
        .lean(),
      Payment.find({ listing: id }).sort({ createdAt: 1 }).populate('buyer', 'fullName').lean(),
    ]);

    res.json({
      listing: {
        _id: listing._id,
        title: listing.title,
        price: listing.price,
        status: listing.status,
        sellerName: listing.seller ? listing.seller.fullName : 'Deleted user',
      },
      offers: offers.map((o) => ({
        _id: o._id,
        buyerName: o.buyer ? o.buyer.fullName : 'Deleted user',
        proposedByName: o.proposedBy ? o.proposedBy.fullName : 'Deleted user',
        amount: o.amount,
        askingPrice: o.askingPrice,
        status: o.status,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt || null,
        expiresAt: o.expiresAt,
      })),
      payments: payments.map((p) => ({
        _id: p._id,
        buyerName: p.buyer ? p.buyer.fullName : 'Deleted user',
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        checkoutRequestId: p.checkoutRequestId,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/offers?status=&search=&page=
async function getOffersLog(req, res) {
  try {
    const { status = 'all', search = '' } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const and = [];
    if (OFFER_STATUSES.includes(status)) and.push({ status });

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const [users, listings] = await Promise.all([
        User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').limit(50).lean(),
        Listing.find({ title: rx }).select('_id').limit(50).lean(),
      ]);
      const or = [];
      if (users.length) {
        const ids = users.map((u) => u._id);
        or.push({ buyer: { $in: ids } }, { seller: { $in: ids } });
      }
      if (listings.length) or.push({ listing: { $in: listings.map((l) => l._id) } });
      if (!or.length) return res.json({ offers: [], total: 0, page, pages: 1 });
      and.push({ $or: or });
    }
    const query = and.length ? { $and: and } : {};

    const [offers, total] = await Promise.all([
      Offer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('listing', 'title')
        .populate('buyer', 'fullName')
        .populate('seller', 'fullName')
        .populate('proposedBy', 'fullName')
        .lean(),
      Offer.countDocuments(query),
    ]);

    res.json({
      offers: offers.map((o) => ({
        _id: o._id,
        listing: o.listing ? { _id: o.listing._id, title: o.listing.title } : null,
        buyerName: o.buyer ? o.buyer.fullName : 'Deleted user',
        sellerName: o.seller ? o.seller.fullName : 'Deleted user',
        proposedByName: o.proposedBy ? o.proposedBy.fullName : 'Deleted user',
        amount: o.amount,
        askingPrice: o.askingPrice,
        status: o.status,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt || null,
      })),
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/offers/flags
async function getOfferFlags(req, res) {
  try {
    const d7 = new Date(Date.now() - 7 * DAY_MS);
    const d30 = new Date(Date.now() - 30 * DAY_MS);
    const d60 = new Date(Date.now() - 60 * DAY_MS);

    const [heavy, declines, lowball, deep] = await Promise.all([
      Offer.aggregate([
        { $match: { createdAt: { $gte: d7 } } },
        { $group: { _id: '$proposedBy', count: { $sum: 1 } } },
        { $match: { count: { $gte: 10 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Offer.aggregate([
        { $match: { status: 'declined', createdAt: { $gte: d30 } } },
        { $group: { _id: { buyer: '$buyer', seller: '$seller' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Offer.aggregate([
        { $match: { createdAt: { $gte: d30 } } },
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$proposedBy', '$buyer'] },
                { $lt: ['$amount', { $multiply: ['$askingPrice', 0.5] }] },
              ],
            },
          },
        },
        { $group: { _id: '$buyer', count: { $sum: 1 } } },
        { $match: { count: { $gte: 5 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Offer.aggregate([
        { $match: { createdAt: { $gte: d60 }, acceptedAt: { $exists: true } } },
        { $match: { $expr: { $lte: ['$amount', { $multiply: ['$askingPrice', 0.6] }] } } },
        { $group: { _id: '$seller', count: { $sum: 1 } } },
        { $match: { count: { $gte: 2 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const ids = [
      ...heavy.map((r) => r._id),
      ...declines.flatMap((r) => [r._id.buyer, r._id.seller]),
      ...lowball.map((r) => r._id),
      ...deep.map((r) => r._id),
    ];
    const names = await nameMap(ids);
    const nm = (id) => names.get(String(id)) || 'Deleted user';

    res.json({
      heavy: heavy.map((r) => ({ name: nm(r._id), count: r.count })),
      declines: declines.map((r) => ({ buyerName: nm(r._id.buyer), sellerName: nm(r._id.seller), count: r.count })),
      lowball: lowball.map((r) => ({ name: nm(r._id), count: r.count })),
      deepSellers: deep.map((r) => ({ name: nm(r._id), count: r.count })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/settings
async function getSettings(req, res) {
  try {
    res.json({ offerHours: await getOfferHours() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/settings/offer-expiry  { hours }
async function setOfferExpiry(req, res) {
  try {
    const hours = Number(req.body?.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      return res.status(400).json({ error: 'Enter a whole number of hours from 1 to 168' });
    }
    const before = await getOfferHours();
    await setOfferHours(hours);

    try {
      await AuditLog.create({
        admin: req.user._id,
        adminName: req.user.fullName,
        action: 'settings.offer_expiry',
        targetType: 'settings',
        summary: `Offer expiry changed from ${before} to ${hours} hours`,
        meta: { from: before, to: hours },
      });
    } catch (err) {
      console.error('Audit log failed:', err.message);
    }

    res.json({ offerHours: hours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getListingOffers, getOffersLog, getOfferFlags, getSettings, setOfferExpiry };