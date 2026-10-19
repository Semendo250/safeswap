const Listing = require('../models/Listing');
const User = require('../models/User');
const Report = require('../models/Report');
const Review = require('../models/Review');
const Favorite = require('../models/Favorite');
const Block = require('../models/Block');
const FcmToken = require('../models/FcmToken');
const Message = require('../models/Message');
const Offer = require('../models/Offer');
const Payment = require('../models/Payment');
const BlacklistIMEI = require('../models/BlacklistIMEI');

const DAY_MS = 24 * 60 * 60 * 1000;

function olderThan(date) {
  return { $or: [{ renewedAt: { $lt: date } }, { renewedAt: null, createdAt: { $lt: date } }] };
}

// GET /api/admin/community-stats
async function getCommunityStats(req, res) {
  try {
    const now = Date.now();
    const d7 = new Date(now - 7 * DAY_MS);
    const d30 = new Date(now - 30 * DAY_MS);
    const warnCut = new Date(now - 53 * DAY_MS);
    const studentFilter = { isBanned: { $ne: true }, role: { $ne: 'admin' } };

    const [
      openReports,
      newReviews,
      expiringSoon,
      multiRows,
      savedRows,
      itemsSold,
      itemsSold30,
      blockedImeis,
      pushIds,
      totalUsers,
      senders,
      proposers,
      sellers,
      buyers,
    ] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      Review.countDocuments({ createdAt: { $gte: d7 } }),
      Listing.countDocuments({ status: 'active', ...olderThan(warnCut) }),
      Block.aggregate([
        { $group: { _id: '$blocked', count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
        { $count: 'n' },
      ]),
      Favorite.aggregate([{ $group: { _id: '$listing', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
      Listing.countDocuments({ status: 'sold' }),
      Listing.countDocuments({ status: 'sold', updatedAt: { $gte: d30 } }),
      BlacklistIMEI.countDocuments(),
      FcmToken.distinct('user'),
      User.countDocuments(studentFilter),
      Message.distinct('sender', { createdAt: { $gte: d7 } }),
      Offer.distinct('proposedBy', { createdAt: { $gte: d7 } }),
      Listing.distinct('seller', { createdAt: { $gte: d7 } }),
      Payment.distinct('buyer', { createdAt: { $gte: d7 } }),
    ]);

    const activeIds = [...new Set([...senders, ...proposers, ...sellers, ...buyers].map(String))];

    const [activeUsers, pushUsers, savedListings] = await Promise.all([
      activeIds.length ? User.countDocuments({ _id: { $in: activeIds }, ...studentFilter }) : 0,
      pushIds.length ? User.countDocuments({ _id: { $in: pushIds }, ...studentFilter }) : 0,
      savedRows.length
        ? Listing.find({ _id: { $in: savedRows.map((r) => r._id) } }).select('title price status').lean()
        : [],
    ]);
    const listingMap = new Map(savedListings.map((l) => [String(l._id), l]));

    res.json({
      openReports,
      newReviews,
      expiringSoon,
      multiBlocked: multiRows[0] ? multiRows[0].n : 0,
      mostSaved: savedRows
        .filter((r) => listingMap.get(String(r._id)))
        .map((r) => {
          const l = listingMap.get(String(r._id));
          return { listingId: String(l._id), title: l.title, price: l.price, status: l.status, count: r.count };
        }),
      activeUsers,
      itemsSold,
      itemsSold30,
      blockedImeis,
      pushUsers,
      pushTotal: totalUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCommunityStats };