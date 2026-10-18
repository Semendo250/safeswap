const Favorite = require('../models/Favorite');
const Listing = require('../models/Listing');

const MAX_FAVORITES = 200;
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// GET /api/favorites
async function getFavorites(req, res) {
  try {
    const favs = await Favorite.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(MAX_FAVORITES)
      .populate({
        path: 'listing',
        select: 'title price photos status category imeiStatus seller unavailableReason',
        populate: { path: 'seller', select: 'fullName' },
      })
      .lean();

    const listings = favs
      .filter((f) => f.listing)
      .map((f) => ({ ...f.listing, isFavorite: true, savedPrice: f.lastSeenPrice }));
    res.json({ listings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/favorites/:listingId
async function addFavorite(req, res) {
  try {
    const id = String(req.params.listingId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid listing' });

    const listing = await Listing.findById(id).select('seller price status');
    if (!listing || listing.status !== 'active') {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (String(listing.seller) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't save your own listing" });
    }

    const already = await Favorite.exists({ user: req.user._id, listing: id });
    if (!already) {
      const count = await Favorite.countDocuments({ user: req.user._id });
      if (count >= MAX_FAVORITES) {
        return res.status(400).json({ error: `You can save up to ${MAX_FAVORITES} items. Remove some first.` });
      }
      await Favorite.updateOne(
        { user: req.user._id, listing: id },
        { $setOnInsert: { lastSeenPrice: listing.price } },
        { upsert: true }
      );
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/favorites/:listingId
async function removeFavorite(req, res) {
  try {
    const id = String(req.params.listingId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid listing' });
    await Favorite.deleteOne({ user: req.user._id, listing: id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getFavorites, addFavorite, removeFavorite };