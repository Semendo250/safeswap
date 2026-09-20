const Listing = require('../models/Listing');
const { checkImeiStatus } = require('../utils/imei');
const paymentStore = require('../utils/paymentStore');

// Seller details anyone may see. Phone + location are added only for logged-in viewers.
const SELLER_PUBLIC_FIELDS = 'fullName trustScore verificationPath completedSales profilePicture';

// Turns a listing into what this viewer is allowed to see.
// The IMEI and the proof photo (phone next to a student ID) only go to the seller or an admin.
function presentListing(listing, viewer) {
  const obj = listing.toJSON();
  const ref = obj.seller;
  const sellerId = ref && ref._id ? ref._id.toString() : ref ? String(ref) : null;
  const isPrivileged = viewer && (viewer.role === 'admin' || viewer._id.toString() === sellerId);
  if (!isPrivileged) {
    delete obj.imei;
    delete obj.proofPhoto;
  }
  return obj;
}

// Loads one listing the way the detail page needs it: seller filled in,
// phone/location only for logged-in viewers, private fields removed.
async function loadListingForViewer(id, viewer) {
  const sellerFields = SELLER_PUBLIC_FIELDS + (viewer ? ' phone location' : '');
  const listing = await Listing.findById(id).populate('seller', sellerFields);
  if (!listing) return null;
  return presentListing(listing, viewer);
}

// POST /api/listings
// Handles both categories: 'phone' (IMEI check + proof photo required)
// and 'general' (lighter flow, no IMEI/proof photo)
async function createListing(req, res) {
  try {
    const { title, description, price, category, imei } = req.body;

    if (!title || !price || !category) {
      return res.status(400).json({ error: 'title, price, and category are required' });
    }
    if (!['phone', 'general'].includes(category)) {
      return res.status(400).json({ error: 'category must be phone or general' });
    }

    // req.files comes from upload.array('photos', 5) on the route
    const photoUrls = (req.files?.photos || []).map((f) => f.path);
    if (photoUrls.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    const listingData = {
      seller: req.user._id,
      title,
      description,
      price,
      category,
      photos: photoUrls,
    };

    if (category === 'phone') {
      if (!imei) {
        return res.status(400).json({ error: 'IMEI is required for phone listings' });
      }
      const proofFile = req.files?.proofPhoto?.[0];
      if (!proofFile) {
        return res
          .status(400)
          .json({ error: 'A proof photo (phone next to your student ID) is required for phone listings' });
      }

      const imeiStatus = await checkImeiStatus(imei);

      if (imeiStatus === 'invalid_format') {
        return res.status(400).json({ error: 'Invalid IMEI — check the number and try again' });
      }

      listingData.imei = imei;
      listingData.imeiStatus = imeiStatus; // 'clean' or 'blacklisted'
      listingData.proofPhoto = proofFile.path;

      if (imeiStatus === 'blacklisted') {
        listingData.status = 'under_review';
        const listing = await Listing.create(listingData);
        return res.status(403).json({
          error: 'This device has been flagged. Your listing was submitted for review.',
          listing,
        });
      }
    }
    // category === 'general' skips IMEI/proof photo entirely and goes straight to active

    const listing = await Listing.create(listingData);
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/listings
// Feed - filterable by category, only shows active listings
async function getListings(req, res) {
  try {
    const { category } = req.query;
    const filter = { status: 'active' };
    if (category && ['phone', 'general'].includes(category)) {
      filter.category = category;
    }

    // IMEI and proof photo are private: never sent in the public feed
    const listings = await Listing.find(filter)
      .select('-imei -proofPhoto')
      .sort({ createdAt: -1 })
      .populate('seller', 'fullName trustScore verificationPath');

    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/listings/:id
// Seller phone/location: logged-in viewers only. IMEI + proof photo: seller or admin only.
async function getListingById(req, res) {
  try {
    const listing = await loadListingForViewer(req.params.id, req.user);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/listings/:id
// Only the seller can edit their own listing, and only certain fields
async function updateListing(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    const { title, description, price } = req.body;
    if (title) listing.title = title;
    if (description) listing.description = description;
    if (price) listing.price = price;

    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/listings/:id
async function deleteListing(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    await listing.deleteOne();
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const SAFE_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

// PATCH /api/listings/:id/meetup
// Buyer or seller proposes/confirms a safe-zone meetup for this listing
async function setMeetup(req, res) {
  try {
    const { safeZone } = req.body;
    if (!SAFE_ZONES.includes(safeZone)) {
      return res.status(400).json({ error: 'Invalid safe zone selection' });
    }

    const updated = await Listing.findByIdAndUpdate(
      req.params.id,
      { meetupSafeZone: safeZone, meetupConfirmed: false },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Listing not found' });

    // Same shape as the detail page (seller filled in, private fields removed)
    res.json(await loadListingForViewer(updated._id, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/listings/:id/meetup/confirm
// PATCH /api/listings/:id/meetup/confirm
async function confirmMeetup(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const callerId = req.user._id.toString();

    // The seller must never be able to release the payment to themselves
    if (listing.seller.toString() === callerId) {
      return res
        .status(403)
        .json({ error: "Sellers can't confirm their own meetup. The buyer confirms it." });
    }

    // If a payment was made for this listing and it's sitting in 'held',
    // confirming the meetup is what releases it to the seller.
    // Only the buyer who actually paid may do that.
    const payment = paymentStore.getLatestByListingId(listing._id.toString());
    if (payment && payment.status === 'held') {
      if (String(payment.buyerId) !== callerId) {
        return res.status(403).json({ error: 'Only the buyer who paid can confirm this meetup.' });
      }
      paymentStore.releaseByListingId(listing._id.toString());
      listing.status = 'sold';
    }

    listing.meetupConfirmed = true;
    await listing.save();
    res.json(await loadListingForViewer(listing._id, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
// GET /api/listings/mine
async function getMyListings(req, res) {
  try {
    const listings = await Listing.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createListing, getMyListings, getListings, getListingById, updateListing, deleteListing, setMeetup, confirmMeetup, SAFE_ZONES };