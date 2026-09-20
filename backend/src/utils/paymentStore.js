// Shared in-memory payment tracking so both payments.controller.js and
// listings.controller.js can read/update the same records.
// Replace with a real Payment model in MongoDB before any real deployment -
// this resets on server restart and won't work across multiple server
// instances.

const byCheckoutId = new Map();
const listingToCheckoutId = new Map(); // tracks the latest payment attempt per listing

function createPending(checkoutRequestId, { listingId, buyerId }) {
  byCheckoutId.set(checkoutRequestId, { listingId, buyerId, status: 'pending' });
  listingToCheckoutId.set(listingId, checkoutRequestId);
}

function updateStatusByCheckoutId(checkoutRequestId, status) {
  const record = byCheckoutId.get(checkoutRequestId);
  if (!record) return null;
  record.status = status;
  byCheckoutId.set(checkoutRequestId, record);
  return record;
}

function getByCheckoutId(checkoutRequestId) {
  return byCheckoutId.get(checkoutRequestId) || null;
}

function getLatestByListingId(listingId) {
  const checkoutId = listingToCheckoutId.get(listingId.toString());
  if (!checkoutId) return null;
  return byCheckoutId.get(checkoutId) || null;
}

// Releases the held payment tied to a listing - called once meetup is
// confirmed, marking the escrow-lite transaction complete
function releaseByListingId(listingId) {
  const checkoutId = listingToCheckoutId.get(listingId.toString());
  if (!checkoutId) return null;
  return updateStatusByCheckoutId(checkoutId, 'released');
}

module.exports = {
  createPending,
  updateStatusByCheckoutId,
  getByCheckoutId,
  getLatestByListingId,
  releaseByListingId,
};