const Payment = require('../models/Payment');

function toRecord(doc) {
  if (!doc) return null;
  return {
    checkoutRequestId: doc.checkoutRequestId,
    listingId: doc.listing.toString(),
    buyerId: doc.buyer.toString(),
    amount: doc.amount,
    mpesaReceipt: doc.mpesaReceipt,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

async function createPending(checkoutRequestId, { listingId, buyerId, amount, phone, askingPrice, offerId }) {
  const doc = await Payment.create({
    checkoutRequestId,
    listing: listingId,
    buyer: buyerId,
    amount: amount !== undefined && amount !== null ? Number(amount) : undefined,
    askingPrice: askingPrice !== undefined && askingPrice !== null ? Number(askingPrice) : undefined,
    offer: offerId || undefined,
    phone: phone ? String(phone).trim() : undefined,
    status: 'pending',
  });
  return toRecord(doc);
}

async function settlePending(checkoutRequestId, status, extra = {}) {
  const update = { status };
  if (extra.mpesaReceipt) update.mpesaReceipt = extra.mpesaReceipt;
  if (extra.reviewNote) {
    update.needsReview = true;
    update.reviewNote = extra.reviewNote;
  }
  const doc = await Payment.findOneAndUpdate(
    { checkoutRequestId, status: 'pending' },
    update,
    { new: true }
  );
  return toRecord(doc);
}

async function flagReview(checkoutRequestId, note, extra = {}) {
  const update = { needsReview: true, reviewNote: String(note || '').slice(0, 300) };
  if (extra.mpesaReceipt) update.mpesaReceipt = extra.mpesaReceipt;
  const doc = await Payment.findOneAndUpdate({ checkoutRequestId }, update, { new: true });
  return toRecord(doc);
}

async function updateStatusByCheckoutId(checkoutRequestId, status) {
  const doc = await Payment.findOneAndUpdate({ checkoutRequestId }, { status }, { new: true });
  return toRecord(doc);
}

async function getByCheckoutId(checkoutRequestId) {
  return toRecord(await Payment.findOne({ checkoutRequestId }).lean());
}

async function getLatestByListingId(listingId) {
  return toRecord(await Payment.findOne({ listing: listingId }).sort({ createdAt: -1 }).lean());
}

async function getHeldByListingId(listingId) {
  return toRecord(await Payment.findOne({ listing: listingId, status: 'held' }).lean());
}

async function getActiveByListingId(listingId) {
  return toRecord(await Payment.findOne({ listing: listingId, status: { $in: ['pending', 'held'] } }).lean());
}

async function failStalePending(listingId, olderThanMs) {
  await Payment.updateMany(
    { listing: listingId, status: 'pending', createdAt: { $lt: new Date(Date.now() - olderThanMs) } },
    { status: 'failed' }
  );
}

async function releaseByListingId(listingId) {
  const doc = await Payment.findOneAndUpdate(
    { listing: listingId, status: 'held' },
    { status: 'released' },
    { new: true, sort: { createdAt: -1 } }
  );
  return toRecord(doc);
}

module.exports = {
  createPending,
  settlePending,
  flagReview,
  updateStatusByCheckoutId,
  getByCheckoutId,
  getLatestByListingId,
  getHeldByListingId,
  getActiveByListingId,
  failStalePending,
  releaseByListingId,
};