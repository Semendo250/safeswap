const Listing = require('../models/Listing');
const User = require('../models/User');
const BlacklistIMEI = require('../models/BlacklistIMEI');
const Report = require('../models/Report');
const { calculateTrustScore } = require('../utils/trustScore');

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

// PATCH /api/admin/listings/:id/approve
async function approveListing(req, res) {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/listings/:id/remove
async function removeListing(req, res) {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status: 'removed' },
      { new: true }
    );
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

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

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/verification-queue - fallback-path users awaiting approval
async function getVerificationQueue(req, res) {
  try {
    const users = await User.find({
      verificationPath: 'fallback',
      fallbackApproved: false,
    }).select('fullName email studentRegNo fallbackIdPhoto createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/verification/:userId/approve
async function approveFallbackVerification(req, res) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { fallbackApproved: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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

module.exports = {
  getOverview,
  getFlaggedListings,
  approveListing,
  removeListing,
  getVerificationQueue,
  approveFallbackVerification,
  addBlacklistImei,
  getBlacklist,
  removeBlacklistImei,
};