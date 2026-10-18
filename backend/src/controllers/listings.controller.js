const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const Favorite = require('../models/Favorite');
const Message = require('../models/Message');
const Offer = require('../models/Offer');
const { checkImeiStatus } = require('../utils/imei');
const paymentStore = require('../utils/paymentStore');
const { notify, notifyAdmins } = require('../utils/notify');
const { getActiveZoneNames } = require('../utils/safeZones');
const { parsePrice, getAgreementInfo, sweepOffers } = require('../utils/offers');
const { notifyPriceDrop } = require('../utils/favorites');
const { maybeRunExpirySweep } = require('../utils/listingExpiry');

const SELLER_PUBLIC_FIELDS =
  'fullName trustScore verificationPath completedSales profilePicture ratingAverage ratingCount';
const PRICE_ERROR = 'Price must be a whole number of KES between 1 and 250,000';

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function presentListing(listing, viewer) {
  const obj = listing.toJSON();
  const ref = obj.seller;
  const sellerId = ref && ref._id ? ref._id.toString() : ref ? String(ref) : null;
  const isPrivileged = viewer && (viewer.role === 'admin' || viewer._id.toString() === sellerId);
  delete obj.paymentLockUntil;
  delete obj.paymentLockBy;
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
  const obj = presentListing(listing, viewer);
  if (viewer) {
    try {
      Object.assign(obj, await getAgreementInfo(listing, viewer._id));
    } catch (err) {
      console.error('getAgreementInfo failed:', err.message);
    }
    try {
      obj.isFavorite = !!(await Favorite.exists({ user: viewer._id, listing: listing._id }));
    } catch (err) {
      obj.isFavorite = false;
    }
  }
  return obj;
}

// POST /api/listings
async function createListing(req, res) {
  try {
    const { title, description, category, imei } = req.body;
    const price = parsePrice(req.body.price);

    if (price === null) {
      return res.status(400).json({ error: PRICE_ERROR });
    }
    if (!title || !category) {
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
      listingData.status = 'under_review';
    }

    const listing = await Listing.create(listingData);

    if (category === 'phone') {
      const flagged = listing.imeiStatus === 'blacklisted';

      await notifyAdmins({
        type: 'new_listing_review',
        title: 'New listing to review',
        body: flagged
          ? `"${listing.title}" was flagged (blacklisted IMEI) and needs review.`
          : `"${listing.title}" is a phone listing waiting for approval.`,
        link: '/admin/flagged',
        actorId: req.user._id,
      });

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

// GET /api/listings?category=&search=&minPrice=&maxPrice=&sort=&seller=
async function getListings(req, res) {
  try {
    try {
      await maybeRunExpirySweep();
    } catch (e) {
      console.error('Expiry sweep failed:', e.message);
    }

    const { category, search = '', sort = 'newest' } = req.query;
    const filter = { status: 'active' };
    if (category && ['phone', 'general'].includes(category)) {
      filter.category = category;
    }
    if (isId(String(req.query.seller || ''))) filter.seller = req.query.seller;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const min = Number(req.query.minPrice);
    const max = Number(req.query.maxPrice);
    const price = {};
    if (req.query.minPrice !== undefined && req.query.minPrice !== '' && Number.isFinite(min) && min >= 0) {
      price.$gte = min;
    }
    if (req.query.maxPrice !== undefined && req.query.maxPrice !== '' && Number.isFinite(max) && max >= 0) {
      price.$lte = max;
    }
    if (Object.keys(price).length) filter.price = price;

    const sorts = {
      newest: { createdAt: -1 },
      cheapest: { price: 1, createdAt: -1 },
      expensive: { price: -1, createdAt: -1 },
    };

    const listings = await Listing.find(filter)
      .select('-imei -proofPhoto -paymentLockUntil -paymentLockBy')
      .sort(sorts[sort] || sorts.newest)
      .limit(200)
      .populate('seller', 'fullName trustScore verificationPath')
      .lean();

    let favSet = new Set();
    if (req.user && listings.length) {
      const favs = await Favorite.find({
        user: req.user._id,
        listing: { $in: listings.map((l) => l._id) },
      })
        .select('listing')
        .lean();
      favSet = new Set(favs.map((f) => String(f.listing)));
    }

    res.json(listings.map((l) => ({ ...l, isFavorite: favSet.has(String(l._id)) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/listings/:id
async function getListingById(req, res) {
  try {
    const listing = await loadListingForViewer(req.params.id, req.user);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

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
    if (!['active', 'under_review', 'unavailable', 'expired'].includes(listing.status)) {
      return res.status(409).json({ error: 'This listing can no longer be edited' });
    }
    const activePayment = await paymentStore.getActiveByListingId(String(listing._id));
    if (activePayment) {
      return res
        .status(409)
        .json({ error: 'A payment is in progress for this item. You can edit it once that is finished.' });
    }

    const oldPrice = listing.price;
    const { title, description, price } = req.body;

    if (title !== undefined) {
      const t = String(title).trim();
      if (t.length < 3 || t.length > 100) {
        return res.status(400).json({ error: 'Title must be 3 to 100 characters' });
      }
      listing.title = t;
    }
    if (description !== undefined) {
      const d = String(description).trim();
      if (d.length > 1000) {
        return res.status(400).json({ error: 'Description can be up to 1000 characters' });
      }
      listing.description = d;
    }
    if (price !== undefined && price !== '') {
      const newPrice = parsePrice(price);
      if (newPrice === null) return res.status(400).json({ error: PRICE_ERROR });
      listing.price = newPrice;
    }

    await listing.save();

    if (listing.status === 'active' && listing.price < oldPrice) {
      notifyPriceDrop(listing, oldPrice, listing.price).catch((err) =>
        console.error('notifyPriceDrop failed:', err.message)
      );
    }

    res.json(presentListing(listing, req.user));
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

    const hasPayments = await Payment.exists({ listing: listing._id });
    if (hasPayments) {
      return res.status(409).json({
        error: "This item has payment history, so it can't be deleted. Mark it unavailable instead.",
      });
    }

    await Offer.updateMany(
      { listing: listing._id, status: { $in: ['pending', 'accepted'] } },
      { status: 'closed' }
    );
    await Favorite.deleteMany({ listing: listing._id });
    await listing.deleteOne();
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/listings/:id/availability   body: { action: 'sold_elsewhere' | 'unavailable' | 'available' }
async function setAvailability(req, res) {
  try {
    const action = String(req.body?.action || '');
    if (!['sold_elsewhere', 'unavailable', 'available'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    if (action === 'available') {
      if (listing.status !== 'unavailable') {
        return res.status(409).json({ error: 'Only unavailable listings can be made available again' });
      }
      if (listing.imeiStatus === 'blacklisted') {
        return res.status(403).json({ error: 'This phone is flagged. Contact support for help.' });
      }
      listing.status = 'active';
      listing.unavailableReason = undefined;
      listing.renewedAt = new Date();
      listing.expiryWarned = false;
    } else {
      if (listing.status !== 'active') {
        return res.status(409).json({ error: 'Only live listings can be marked unavailable' });
      }
      const activePayment = await paymentStore.getActiveByListingId(String(listing._id));
      if (activePayment) {
        return res
          .status(409)
          .json({ error: 'A payment is in progress for this item. Wait until it is finished.' });
      }
      listing.status = 'unavailable';
      listing.unavailableReason = action === 'sold_elsewhere' ? 'sold_elsewhere' : 'other';
    }

    await listing.save();

    if (listing.status === 'unavailable') {
      try {
        await sweepOffers({ listing: listing._id });
      } catch (e) {
        console.error('sweepOffers failed:', e.message);
      }
    }

    res.json(presentListing(listing, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/listings/:id/renew
async function renewListing(req, res) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your listing' });
    }
    if (!['active', 'expired'].includes(listing.status)) {
      return res.status(409).json({ error: 'Only live or expired listings can be renewed' });
    }
    if (listing.imeiStatus === 'blacklisted') {
      return res.status(403).json({ error: 'This phone is flagged. Contact support for help.' });
    }

    listing.status = 'active';
    listing.renewedAt = new Date();
    listing.expiryWarned = false;
    await listing.save();

    res.json(presentListing(listing, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const SAFE_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

// PATCH /api/listings/:id/meetup
async function setMeetup(req, res) {
  try {
    const { safeZone } = req.body;
    const allowedZones = await getActiveZoneNames();
    if (!allowedZones.includes(safeZone)) {
      return res.status(400).json({ error: 'Invalid safe zone selection' });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    const callerId = req.user._id.toString();
    const isSeller = listing.seller.toString() === callerId;
    const active = await paymentStore.getActiveByListingId(listing._id.toString());

    if (active && !isSeller && String(active.buyerId) !== callerId) {
      return res.status(403).json({
        error: 'A payment is already in progress for this item. Only the buyer and seller can change the meetup.',
      });
    }

    if (!isSeller && !active) {
      const talked = await Message.exists({
        listing: listing._id,
        $or: [
          { sender: req.user._id, receiver: listing.seller },
          { sender: listing.seller, receiver: req.user._id },
        ],
      });
      if (!talked) {
        return res.status(403).json({ error: 'Message the seller about this item before choosing a meetup point' });
      }
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

    const held = await paymentStore.getHeldByListingId(listing._id.toString());
    if (!held) {
      return res.status(400).json({ error: 'There is no held payment yet. Pay first, then confirm after the handover.' });
    }
    if (String(held.buyerId) !== callerId) {
      return res.status(403).json({ error: 'Only the buyer who paid can confirm this meetup.' });
    }

    const released = await paymentStore.releaseByListingId(listing._id.toString());
    if (!released) {
      return res.status(409).json({ error: 'This payment has already been released.' });
    }
    const releasedCheckoutId = released.checkoutRequestId;

    listing.status = 'sold';
    listing.meetupConfirmed = true;
    try {
      await listing.save();
    } catch (saveErr) {
      await paymentStore.updateStatusByCheckoutId(releasedCheckoutId, 'held');
      throw saveErr;
    }

    try {
      await sweepOffers({ listing: listing._id });
    } catch (e) {
      console.error('sweepOffers failed:', e.message);
    }

    await notify({
      userId: listing.seller,
      actorId: req.user._id,
      type: 'meetup_confirmed',
      title: 'Meetup confirmed',
      body: `The buyer confirmed the handover for "${listing.title}".`,
      link: `/listings/${listing._id}`,
    });
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
    await notify({
      userId: req.user._id,
      type: 'review_request',
      title: 'How was the handover?',
      body: `Rate the seller for "${listing.title}".`,
      link: `/listings/${listing._id}`,
    });

    res.json(await loadListingForViewer(listing._id, req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/listings/mine
async function getMyListings(req, res) {
  try {
    const listings = await Listing.find({ seller: req.user._id })
      .select('-paymentLockUntil -paymentLockBy')
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createListing,
  getMyListings,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  setAvailability,
  renewListing,
  setMeetup,
  confirmMeetup,
  SAFE_ZONES,
};