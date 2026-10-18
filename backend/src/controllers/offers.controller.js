const Offer = require('../models/Offer');
const Message = require('../models/Message');
const Listing = require('../models/Listing');
const paymentStore = require('../utils/paymentStore');
const { notify } = require('../utils/notify');
const { OPEN, parsePrice, kes, roomFor, sweepOffers } = require('../utils/offers');
const { getOfferTtlMs } = require('../utils/settings');

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const STATUS_TEXT = {
  accepted: 'already accepted',
  declined: 'already declined',
  replaced: 'replaced by a newer offer',
  expired: 'expired',
  closed: 'closed because the item is no longer available',
  paid: 'already paid',
};

function emit(req, room, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(room).emit(event, payload);
}

async function loadCard(messageId) {
  const doc = await Message.findById(messageId)
    .populate('sender', 'fullName')
    .populate('receiver', 'fullName')
    .populate('offer');
  return doc ? doc.toJSON() : null;
}

async function bargainProblem(listing, amount) {
  if (!listing || listing.status !== 'active') return [409, 'This item is no longer available'];
  if (amount && amount > listing.price) {
    return [400, `An offer can't be higher than the asking price (${kes(listing.price)})`];
  }
  const active = await paymentStore.getActiveByListingId(String(listing._id));
  if (active) return [409, 'A payment for this item is already in progress'];
  return null;
}

async function placeOffer({ req, listing, buyerId, proposerId, amount, kind }) {
  const sellerId = String(listing.seller);
  const otherId = String(proposerId) === sellerId ? String(buyerId) : sellerId;

  const open = await Offer.find({ listing: listing._id, buyer: buyerId, status: { $in: OPEN } }).select('_id');
  const openIds = open.map((o) => o._id);
  if (openIds.length) {
    await Offer.updateMany({ _id: { $in: openIds }, status: { $in: OPEN } }, { status: 'replaced' });
  }

  const offer = await Offer.create({
    listing: listing._id,
    buyer: buyerId,
    seller: listing.seller,
    proposedBy: proposerId,
    amount,
    askingPrice: listing.price,
    status: 'pending',
    expiresAt: new Date(Date.now() + (await getOfferTtlMs())),
  });

  const message = await Message.create({
    listing: listing._id,
    sender: proposerId,
    receiver: otherId,
    content: `Offer: ${kes(amount)}`,
    type: 'offer',
    offer: offer._id,
  });
  offer.message = message._id;
  await offer.save();

  const replaced = openIds.length ? (await Offer.find({ _id: { $in: openIds } })).map((o) => o.toJSON()) : [];
  const card = await loadCard(message._id);
  const room = roomFor(listing._id, buyerId, sellerId);

  replaced.forEach((o) => emit(req, room, 'offer_updated', { room, offer: o }));
  emit(req, room, 'offer_message', { room, message: card });

  const name = req.user.fullName;
  notify({
    userId: otherId,
    actorId: proposerId,
    type: 'offer_update',
    title:
      kind === 'counter'
        ? `${name} countered with ${kes(amount)}`
        : `${name} offered ${kes(amount)} for ${listing.title}`,
    body: 'Tap to accept, decline or counter.',
    link: `/chat/${listing._id}?with=${proposerId}`,
  }).catch(() => {});

  return { message: card, offer: card ? card.offer : offer.toJSON(), replaced };
}

async function findRespondable(offerId, userId) {
  if (!isId(String(offerId))) return { error: [404, 'Offer not found'] };
  const me = String(userId);
  const first = await Offer.findById(offerId);
  if (!first || (String(first.buyer) !== me && String(first.seller) !== me)) {
    return { error: [404, 'Offer not found'] };
  }
  await sweepOffers({ _id: first._id });
  const offer = await Offer.findById(offerId);
  if (offer.status !== 'pending') {
    return { error: [409, `This offer is ${STATUS_TEXT[offer.status] || offer.status}`] };
  }
  if (String(offer.proposedBy) === me) {
    return { error: [403, "You can't respond to your own offer"] };
  }
  return { offer };
}

// POST /api/offers/:listingId   body: { otherUserId, amount }
async function createOffer(req, res) {
  try {
    const { listingId } = req.params;
    const otherUserId = String(req.body.otherUserId || '');
    const amount = parsePrice(req.body.amount);

    if (!isId(listingId) || !isId(otherUserId)) return res.status(400).json({ error: 'Invalid listing or user' });
    if (amount === null) return res.status(400).json({ error: 'Enter a whole number above zero' });

    const me = String(req.user._id);
    if (otherUserId === me) return res.status(400).json({ error: "You can't make an offer to yourself" });

    const listing = await Listing.findById(listingId).select('title seller price status');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const sellerId = String(listing.seller);
    let buyerId;
    if (me === sellerId) {
      buyerId = otherUserId;
      const hasWrittenFirst = await Message.exists({ listing: listingId, sender: buyerId, receiver: me });
      if (!hasWrittenFirst) {
        return res.status(403).json({ error: 'You can only make offers to buyers who have messaged you about this listing' });
      }
    } else {
      if (otherUserId !== sellerId) {
        return res.status(403).json({ error: 'Offers go between the buyer and the seller' });
      }
      buyerId = me;
    }

    const problem = await bargainProblem(listing, amount);
    if (problem) return res.status(problem[0]).json({ error: problem[1] });

    const result = await placeOffer({ req, listing, buyerId, proposerId: me, amount, kind: 'new' });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/offers/:offerId/accept
async function acceptOffer(req, res) {
  try {
    const found = await findRespondable(req.params.offerId, req.user._id);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    const { offer } = found;

    const listing = await Listing.findById(offer.listing).select('title seller price status');
    const problem = await bargainProblem(listing);
    if (problem) {
      await sweepOffers({ _id: offer._id });
      return res.status(problem[0]).json({ error: problem[1] });
    }

    const now = new Date();
    const updated = await Offer.findOneAndUpdate(
      { _id: offer._id, status: 'pending' },
      { status: 'accepted', acceptedAt: now, expiresAt: new Date(now.getTime() + (await getOfferTtlMs())) },
      { new: true }
    );
    if (!updated) return res.status(409).json({ error: 'This offer is no longer open' });

    if (updated.message) {
      await Message.updateOne({ _id: updated.message }, { content: `Agreed: ${kes(updated.amount)}` });
    }

    const room = roomFor(offer.listing, offer.buyer, offer.seller);
    emit(req, room, 'offer_updated', { room, offer: updated.toJSON() });

    notify({
      userId: offer.proposedBy,
      actorId: req.user._id,
      type: 'offer_update',
      title: 'Offer accepted',
      body: `${req.user.fullName} accepted ${kes(updated.amount)} for "${listing.title}".`,
      link: `/chat/${offer.listing}?with=${req.user._id}`,
    }).catch(() => {});

    res.json({ offer: updated.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/offers/:offerId/decline
async function declineOffer(req, res) {
  try {
    const found = await findRespondable(req.params.offerId, req.user._id);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    const { offer } = found;

    const updated = await Offer.findOneAndUpdate(
      { _id: offer._id, status: 'pending' },
      { status: 'declined' },
      { new: true }
    );
    if (!updated) return res.status(409).json({ error: 'This offer is no longer open' });

    const listing = await Listing.findById(offer.listing).select('title').lean();
    const room = roomFor(offer.listing, offer.buyer, offer.seller);
    emit(req, room, 'offer_updated', { room, offer: updated.toJSON() });

    notify({
      userId: offer.proposedBy,
      actorId: req.user._id,
      type: 'offer_update',
      title: 'Offer declined',
      body: `${req.user.fullName} declined ${kes(updated.amount)} for "${listing?.title || 'an item'}".`,
      link: `/chat/${offer.listing}?with=${req.user._id}`,
    }).catch(() => {});

    res.json({ offer: updated.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/offers/:offerId/counter   body: { amount }
async function counterOffer(req, res) {
  try {
    const amount = parsePrice(req.body.amount);
    if (amount === null) return res.status(400).json({ error: 'Enter a whole number above zero' });

    const found = await findRespondable(req.params.offerId, req.user._id);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    const { offer } = found;

    const listing = await Listing.findById(offer.listing).select('title seller price status');
    const problem = await bargainProblem(listing, amount);
    if (problem) return res.status(problem[0]).json({ error: problem[1] });

    const result = await placeOffer({
      req,
      listing,
      buyerId: offer.buyer,
      proposerId: String(req.user._id),
      amount,
      kind: 'counter',
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createOffer, acceptOffer, declineOffer, counterOffer };