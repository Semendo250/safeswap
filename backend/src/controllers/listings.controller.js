const Listing = require('../models/Listing');
const { checkImeiStatus } = require('../utils/imei');
const paymentStore = require('../utils/paymentStore');
const { notify, notifyAdmins } = require('../utils/notify');

const SELLER_PUBLIC_FIELDS = 'fullName trustScore verificationPath completedSales profilePicture';

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

async function loadListingForViewer(id, viewer) {
  const sellerFields = SELLER_PUBLIC_FIELDS + (viewer ? ' phone location' : '');
  const listing = await Listing.findById(id).populate('seller', sellerFields);
  if (!listing) return null;
  return presentListing(listing, viewer);
}

// POST /api/listings
async function createListing(req, res) {
  try {
    const { title, description, price, category, imei } = req.body;

    if (!title || !price || !category) {
      return res.status(400).json({ error: 'title, price, and category are required' });
    }
    if (!['phone', 'general'].includes(category)) {
      return res.status(400).json({ error: 'category must be phone or general' });
    }

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
        return res.status(400).json({
          error:
            'A proof photo is required for phone listings: dial *#06# to show your IMEI screen, then photograph it together with your National ID, School ID, or School Temporary ID, in one photo',
        });
      }

      const imeiStatus = await checkImeiStatus(imei);

      if (imeiStatus === 'invalid_format') {
        return res.status(400).json({ error: 'Invalid IMEI — check the number and try again' });
      }

      listingData.imei = imei;
      listingData.imeiStatus = imeiStatus;
      listingData.proofPhoto = proofFile.path;

      // Every phone listing waits for an admin to approve it before it goes live
      listingData.status = 'under_review';
    }

    const listing = await Listing.create(listingData);

    if (category === 'phone') {
      const flagged = listing.imeiStatus === 'blacklisted';

      // Tell admins there is a phone waiting (the Flagged queue is where these listings sit)
      await notifyAdmins({
        type: 'new_listing_review',
        title: 'New listing to review',
        body: flagged
          ? `"${listing.title}" was flagged (blacklisted IMEI) and needs review.`
          : `"${listing.title}" is a phone listing waiting for approval.`,
        link: '/admin/flagged',
        actorId: req.user._id,
      });

      // Tell the seller what is happening. The "live" or "not approved" message
      // follows when an admin decides (see the admin controller).
      await notify({
        userId: listing.seller,
        type: 'listing_flagged',
        title: 'Your listing is under review',
        body: flagged
          ? `"${listing.title}": this device was flagged, so an admin will check it before it can go live.`
          : `"${listing.title}" will go live once an admin approves it.`,
        link: `/listings/${listing._id}`,
      });

      return res.status(201).json({ ...listing.toObject(), underReview: true, flagged });
    }

    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/listings
async function getListings(req, res) {
  try {
    const { category } = req.query;
    const filter = { status: 'active' };
    if (category && ['phone', 'general'].includes(category)) {
      filter.category = category;
    }

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
async function getListingById(req, res) {
  try {
    const listing = await loadListingForViewer(req.params.id, req.user);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // A listing waiting for approval is visible only to its seller and to admins
    if (listing.status === 'under_review') {
      const ref = listing.seller;
      const sellerId = ref && ref._id ? String(ref._id) : String(ref);
      const allowed = req.user && (req.user.role === 'admin' || String(req.user._id) === sellerId);
      if (!allowed) return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/listings/:id
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
async function setMeetup(req, res) {
  try {
    const { safeZone } = req.body;
    if (!SAFE_ZONES.includes(safeZone)) {
      return res.status(400).json({ error: 'Invalid safe zone selection' });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    const callerId = req.user._id.toString();
    const isSeller = listing.seller.toString() === callerId;
    const held = await paymentStore.getHeldByListingId(listing._id.toString());
    if (held && !isSeller && String(held.buyerId) !== callerId) {
      return res.status(403).json({
        error: 'A payment is already in progress for this item. Only the buyer and seller can change the meetup.',
      });
    }

    listing.meetupSafeZone = safeZone;
    listing.meetupConfirmed = false;
    await listing.save();

    res.json(await loadListingForViewer(listing._id, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/listings/:id/meetup/confirm
async function confirmMeetup(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const callerId = req.user._id.toString();

    if (listing.seller.toString() === callerId) {
      return res
        .status(403)
        .json({ error: "Sellers can't confirm their own meetup. The buyer confirms it." });
    }

    let releasedCheckoutId = null;
    let paymentWasReleased = false;
    const held = await paymentStore.getHeldByListingId(listing._id.toString());
    if (held) {
      if (String(held.buyerId) !== callerId) {
        return res.status(403).json({ error: 'Only the buyer who paid can confirm this meetup.' });
      }
      const released = await paymentStore.releaseByListingId(listing._id.toString());
      if (released) {
        listing.status = 'sold';
        releasedCheckoutId = released.checkoutRequestId;
        paymentWasReleased = true;
      }
    }

    listing.meetupConfirmed = true;
    try {
      await listing.save();
    } catch (saveErr) {
      if (releasedCheckoutId) {
        await paymentStore.updateStatusByCheckoutId(releasedCheckoutId, 'held');
      }
      throw saveErr;
    }

    // The buyer (req.user) just confirmed; notify the other party, the seller
    await notify({
      userId: listing.seller,
      actorId: req.user._id,
      type: 'meetup_confirmed',
      title: 'Meetup confirmed',
      body: `The buyer confirmed the handover for "${listing.title}".`,
      link: `/listings/${listing._id}`,
    });

    if (paymentWasReleased) {
      await notify({
        userId: listing.seller,
        actorId: req.user._id,
        type: 'payment_status',
        title: 'Funds released to you',
        body: `Payment for "${listing.title}" has been released.`,
        link: `/listings/${listing._id}`,
      });
      await notify({
        userId: listing.seller,
        actorId: req.user._id,
        type: 'listing_sold',
        title: 'Your item has been sold',
        body: `"${listing.title}" has been marked as sold.`,
        link: `/listings/${listing._id}`,
      });
    }

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