import api from './axios';

export function createOffer(listingId, otherUserId, amount) {
  return api.post(`/offers/${listingId}`, { otherUserId, amount });
}

export function acceptOffer(offerId) {
  return api.post(`/offers/${offerId}/accept`);
}

export function declineOffer(offerId) {
  return api.post(`/offers/${offerId}/decline`);
}

export function counterOffer(offerId, amount) {
  return api.post(`/offers/${offerId}/counter`, { amount });
}