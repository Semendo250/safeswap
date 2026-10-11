const Listing = require('../models/Listing');
const User = require('../models/User');
const Report = require('../models/Report');
const Payment = require('../models/Payment');

// Kenya is UTC+3 all year (no daylight saving), so "today" for the admin means Nairobi time
const TZ = '+03:00';
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
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

// GET /api/admin/needs-attention
async function getNeedsAttention(req, res) {
  try {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * DAY_MS);
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000);

    const [
      pendingListings,
      openReports,
      pendingVerifications,
      heldTotal,
      heldOverThreeDays,
      stuckPending,
    ] = await Promise.all([
      Listing.countDocuments({ status: 'under_review' }),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({
        verificationPath: 'fallback',
        fallbackApproved: false,
        fallbackRejected: { $ne: true },
      }),
      Payment.countDocuments({ status: 'held' }),
      Payment.countDocuments({ status: 'held', updatedAt: { $lt: threeDaysAgo } }),
      Payment.countDocuments({ status: 'pending', createdAt: { $lt: thirtyMinAgo } }),
    ]);

    res.json({
      pendingListings,
      openReports,
      pendingVerifications,
      heldTotal,
      heldOverThreeDays,
      stuckPending,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/money-overview
async function getMoneyOverview(req, res) {
  try {
    const now = Date.now();
    const d7 = new Date(now - 7 * DAY_MS);
    const d30 = new Date(now - 30 * DAY_MS);

    const rows = await Payment.aggregate([
      ...amountStages(),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$_amt' },
          last7: { $sum: { $cond: [{ $gte: ['$updatedAt', d7] }, '$_amt', 0] } },
          last30: { $sum: { $cond: [{ $gte: ['$updatedAt', d30] }, '$_amt', 0] } },
        },
      },
    ]);

    const empty = { count: 0, total: 0, last7: 0, last30: 0 };
    const by = {};
    ['pending', 'held', 'released', 'failed', 'refunded'].forEach((s) => {
      by[s] = { ...empty };
    });
    rows.forEach((r) => {
      by[r._id] = { count: r.count, total: r.total, last7: r.last7, last30: r.last30 };
    });

    res.json(by);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/trends?days=7|30
async function getTrends(req, res) {
  try {
    const days = parseInt(req.query.days, 10) === 30 ? 30 : 7;

    const keys = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      keys.push(dayKey(new Date(Date.now() - i * DAY_MS)));
    }
    // Nairobi midnight of the first day in the range
    const start = new Date(`${keys[0]}T00:00:00+03:00`);

    const dayField = (field) => ({
      $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ },
    });

    const [signupRows, listingRows, paidRows] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: dayField('$createdAt'), count: { $sum: 1 } } },
      ]),
      Listing.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: dayField('$createdAt'), count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: start }, status: { $in: ['held', 'released'] } } },
        ...amountStages(),
        {
          $group: {
            _id: dayField('$createdAt'),
            count: { $sum: 1 },
            amount: { $sum: '$_amt' },
          },
        },
      ]),
    ]);

    const signups = new Map(signupRows.map((r) => [r._id, r.count]));
    const listings = new Map(listingRows.map((r) => [r._id, r.count]));
    const paid = new Map(paidRows.map((r) => [r._id, r]));

    const series = keys.map((date) => ({
      date,
      signups: signups.get(date) || 0,
      listings: listings.get(date) || 0,
      paidCount: paid.get(date)?.count || 0,
      paidAmount: paid.get(date)?.amount || 0,
    }));

    res.json({ days, series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getNeedsAttention, getMoneyOverview, getTrends };
