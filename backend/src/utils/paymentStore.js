// Payment records, stored in MongoDB (see models/Payment.js).
// Every function is async, so callers must `await` them.
const Payment = require('../models/Payment');

function toRecord(doc) {
  if (!doc) return null;
  return {
    checkoutRequestId: doc.checkoutRequestId,
    listingId: doc.listing.toString(),
    buyerId: doc.buyer.toString(),
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

async function createPending(checkoutRequestId, { listingId, buyerId, amount, phone }) {
  const doc = await Payment.create({
    checkoutRequestId,
    listing: listingId,
    buyer: buyerId,
    amount: amount !== undefined && amount !== null ? Number(amount) : undefined,
    phone: phone ? String(phone).trim() : undefined,
    status: 'pending',
  });
  return toRecord(doc);
}

// Moves a payment out of 'pending' exactly once. Returns null if it was not pending,
// so a repeated or replayed M-Pesa callback can't change a payment that already settled.
async function settlePending(checkoutRequestId, status, extra = {}) {
  const update = { status };
  if (extra.mpesaReceipt) update.mpesaReceipt = extra.mpesaReceipt;
  const doc = await Payment.findOneAndUpdate(
    { checkoutRequestId, status: 'pending' },
    update,
    { new: true }
  );
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

// The payment currently holding money for this listing, if any
async function getHeldByListingId(listingId) {
  return toRecord(await Payment.findOne({ listing: listingId, status: 'held' }).lean());
}

// Releases the held payment for a listing. It is one atomic step (held -> released),
// so two quick taps on "Confirm meetup" can't release it twice.
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
  updateStatusByCheckoutId,
  getByCheckoutId,
  getLatestByListingId,
  getHeldByListingId,
  releaseByListingId,
};