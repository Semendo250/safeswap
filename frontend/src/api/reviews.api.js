import api from './axios';

export function getSellerReviews(sellerId) {
  return api.get(`/reviews/seller/${sellerId}`);
}

export function getMyReviewStatus(listingId) {
  return api.get(`/reviews/listing/${listingId}/mine`);
}

export function createReview(listingId, rating, comment) {
  return api.post(`/reviews/${listingId}`, { rating, comment });
}