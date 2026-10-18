const mongoose = require('mongoose');
const Review = require('../models/Review');
const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { notify } = require('../utils/notify');

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function paidAndReceived(listingId, userId) {
  return Payment.exists({ listing: listingId, buyer: userId, status: 'released' });
}

async function refreshSellerRating(sellerId) {
  const rows = await Review.aggregate([
    { $match: { seller: new mongoose.Types.ObjectId(String(sellerId)) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = rows[0] ? Math.round(rows[0].avg * 10) / 10 : 0;
  const count = rows[0] ? rows[0].count : 0;
  await User.updateOne({ _id: sellerId }, { ratingAverage: avg, ratingCount: count });
}

// GET /api/reviews/listing/:listingId/mine
async function getMyReviewStatus(req, res) {
  try {
    const id = String(req.params.listingId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid listing' });
    const [eligible, review] = await Promise.all([
      paidAndReceived(id, req.user._id),
      Review.findOne({ listing: id, reviewer: req.user._id }).lean(),
    ]);
    res.json({
      eligible: !!eligible,
      review: review ? { rating: review.rating, comment: review.comment || '', createdAt: review.createdAt } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/reviews/:listingId   body: { rating, comment }
async function createReview(req, res) {
  try {
    const id = String(req.params.listingId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid listing' });

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Pick a rating from 1 to 5 stars' });
    }
    const comment = String(req.body.comment || '').trim().slice(0, 300);

    const listing = await Listing.findById(id).select('seller title');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (String(listing.seller) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't review yourself" });
    }
    if (!(await paidAndReceived(id, req.user._id))) {
      return res
        .status(403)
        .json({ error: 'You can review a seller after you have paid for the item and confirmed the handover' });
    }

    let review;
    try {
      review = await Review.create({
        listing: id,
        seller: listing.seller,
        reviewer: req.user._id,
        rating,
        comment: comment || undefined,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'You already reviewed this seller for this item' });
      }
      throw err;
    }

    await refreshSellerRating(listing.seller);

    notify({
      userId: listing.seller,
      actorId: req.user._id,
      type: 'new_review',
      title: 'You got a new review',
      body: `${req.user.fullName} rated you ${rating}/5 for "${listing.title}".`,
      link: `/sellers/${listing.seller}`,
    }).catch(() => {});

    res.status(201).json({ review: { rating: review.rating, comment: review.comment || '' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reviews/seller/:sellerId
async function getSellerReviews(req, res) {
  try {
    const id = String(req.params.sellerId);
    if (!isId(id)) return res.status(404).json({ error: 'Seller not found' });

    const seller = await User.findById(id)
      .select('fullName trustScore verificationPath profilePicture ratingAverage ratingCount isBanned role')
      .lean();
    if (!seller || seller.isBanned || seller.role === 'admin') {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const reviews = await Review.find({ seller: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('reviewer', 'fullName')
      .populate('listing', 'title')
      .lean();

    res.json({
      seller: {
        _id: seller._id,
        fullName: seller.fullName,
        trustScore: seller.trustScore,
        verificationPath: seller.verificationPath,
        profilePicture: seller.profilePicture,
        ratingAverage: seller.ratingAverage || 0,
        ratingCount: seller.ratingCount || 0,
      },
      reviews: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment || '',
        createdAt: r.createdAt,
        reviewerName: r.reviewer && r.reviewer.fullName ? String(r.reviewer.fullName).split(' ')[0] : 'Student',
        listingTitle: r.listing ? r.listing.title : '',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getMyReviewStatus, createReview, getSellerReviews };