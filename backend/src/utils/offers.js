const Offer = require('../models/Offer');
const Listing = require('../models/Listing');
const { notify } = require('./notify');

const OFFER_TTL_MS = 48 * 60 * 60 * 1000;
const OPEN = ['pending', 'accepted'];
const MAX_PRICE = 250000;

function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PRICE) return null;
  return n;
}

function kes(n) {
  return `KES ${Number(n).toLocaleString('en-US')}`;
}

function roomFor(listingId, a, b) {
  return [String(listingId), [String(a), String(b)].sort().join('-')].join(':');
}

function agreedAmount(offer, listing) {
  return Math.min(offer.amount, listing.price);
}

async function getAgreedOffer(listingId, buyerId) {
  return Offer.findOne({
    listing: listingId,
    buyer: buyerId,
    status: 'accepted',
    expiresAt: { $gt: new Date() },
  })
    .sort({ acceptedAt: -1 })
    .lean();
}

async function tellBoth(offer, title, bodyFn) {
  const listing = await Listing.findById(offer.listing).select('title').lean();
  const text = bodyFn(listing?.title || 'an item');
  const pairs = [
    [offer.buyer, offer.seller],
    [offer.seller, offer.buyer],
  ];
  for (const [userId, otherId] of pairs) {
    await notify({
      userId,
      type: 'offer_update',
      title,
      body: text,
      link: `/chat/${offer.listing}?with=${otherId}`,
    });
  }
}

async function sweepOffers(filter = {}) {
  const now = new Date();

  const stale = await Offer.find({ ...filter, status: { $in: OPEN }, expiresAt: { $lte: now } }).select('_id');
  for (const s of stale) {
    const o = await Offer.findOneAndUpdate(
      { _id: s._id, status: { $in: OPEN } },
      { status: 'expired' },
      { new: true }
    );
    if (o) await tellBoth(o, 'Offer expired', (t) => `The ${kes(o.amount)} offer for "${t}" has expired.`);
  }

  const open = await Offer.find({ ...filter, status: { $in: OPEN } }).populate('listing', 'status');
  for (const o of open) {
    if (o.listing && o.listing.status === 'active') continue;
    const c = await Offer.findOneAndUpdate(
      { _id: o._id, status: { $in: OPEN } },
      { status: 'closed' },
      { new: true }
    );
    if (c) await tellBoth(c, 'Item no longer available', (t) => `The offer for "${t}" was closed.`);
  }
}

async function closeOffers(listingId, exceptBuyerId) {
  const query = { listing: listingId, status: { $in: OPEN } };
  if (exceptBuyerId) query.buyer = { $ne: exceptBuyerId };
  const open = await Offer.find(query).select('_id');
  for (const o of open) {
    const c = await Offer.findOneAndUpdate(
      { _id: o._id, status: { $in: OPEN } },
      { status: 'closed' },
      { new: true }
    );
    if (c) {
      await tellBoth(c, 'Item no longer available', (t) => `Another buyer has paid for "${t}", so the offer was closed.`);
    }
  }
}

async function onPaymentHeld(listingId, buyerId) {
  await Offer.updateMany({ listing: listingId, buyer: buyerId, status: 'accepted' }, { status: 'paid' });
  await closeOffers(listingId, buyerId);
}

async function getAgreementInfo(listing, viewerId) {
  const sellerId = String(listing.seller._id || listing.seller);
  await sweepOffers({ listing: listing._id });

  if (String(viewerId) === sellerId) {
    const offers = await Offer.find({
      listing: listing._id,
      status: 'accepted',
      expiresAt: { $gt: new Date() },
    })
      .populate('buyer', 'fullName')
      .lean();
    return {
      agreements: offers
        .filter((o) => o.buyer)
        .map((o) => ({
          offerId: o._id,
          buyer: { _id: o.buyer._id, fullName: o.buyer.fullName },
          amount: agreedAmount(o, listing),
          expiresAt: o.expiresAt,
        })),
    };
  }

  const o = await getAgreedOffer(listing._id, viewerId);
  return {
    agreedOffer: o ? { offerId: o._id, amount: agreedAmount(o, listing), expiresAt: o.expiresAt } : null,
  };
}

module.exports = {
  OFFER_TTL_MS,
  OPEN,
  MAX_PRICE,
  parsePrice,
  kes,
  roomFor,
  agreedAmount,
  getAgreedOffer,
  sweepOffers,
  closeOffers,
  onPaymentHeld,
  getAgreementInfo,
};