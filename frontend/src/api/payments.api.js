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