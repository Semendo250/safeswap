const mongoose = require('mongoose');
const Review = require('../models/Review');
const User = require('../models/User');

async function refreshSellerRating(sellerId) {
  const rows = await Review.aggregate([
    { $match: { seller: new mongoose.Types.ObjectId(String(sellerId)) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = rows[0] ? Math.round(rows[0].avg * 10) / 10 : 0;
  const count = rows[0] ? rows[0].count : 0;
  await User.updateOne({ _id: sellerId }, { ratingAverage: avg, ratingCount: count });
}

module.exports = { refreshSellerRating };