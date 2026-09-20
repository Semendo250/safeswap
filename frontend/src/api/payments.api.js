import api from './axios';

export function initiateStkPush(listingId, phone) {
  return api.post('/payments/stk-push', { listingId, phone });
}

export function getPaymentStatus(checkoutRequestId) {
  return api.get(`/payments/status/${checkoutRequestId}`);
}