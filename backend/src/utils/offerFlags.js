const Offer = require('../models/Offer');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;
let cache = null;
let cachedAt = 0;

async function nameMap(ids) {
  const users = await User.find({ _id: { $in: ids } }).select('fullName').lean();
  return new Map(users.map((u) => [String(u._id), u.fullName]));
}

async function findOfferFlags() {
  if (cache && Date.now() - cachedAt < 60 * 1000) return cache;

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

  cache = {
    heavy: heavy.map((r) => ({ name: nm(r._id), count: r.count })),
    declines: declines.map((r) => ({ buyerName: nm(r._id.buyer), sellerName: nm(r._id.seller), count: r.count })),
    lowball: lowball.map((r) => ({ name: nm(r._id), count: r.count })),
    deepSellers: deep.map((r) => ({ name: nm(r._id), count: r.count })),
  };
  cachedAt = Date.now();
  return cache;
}

function countOfferFlags(flags) {
  return flags.heavy.length + flags.declines.length + flags.lowball.length + flags.deepSellers.length;
}

module.exports = { findOfferFlags, countOfferFlags };