import api from './axios';

export function initiateStkPush(listingId, phone) {
  return api.post('/payments/stk-push', { listingId, phone });
}

export function getMyPurchases() {
  return api.get('/payments/mine');
}

export function getPaymentStatus(checkoutRequestId) {
  return api.get(`/payments/status/${checkoutRequestId}`);
}

// The buyer's open payment (waiting or paid) for a listing, or { payment: null }
export function getMyPaymentForListing(listingId) {
  return api.get(`/payments/listing/${listingId}/mine`);
}

export function cancelPayment(checkoutRequestId) {
  return api.post(`/payments/cancel/${checkoutRequestId}`);
}