import api from './axios';

export function getFavorites() {
  return api.get('/favorites');
}

export function addFavorite(listingId) {
  return api.post(`/favorites/${listingId}`);
}

export function removeFavorite(listingId) {
  return api.delete(`/favorites/${listingId}`);
}