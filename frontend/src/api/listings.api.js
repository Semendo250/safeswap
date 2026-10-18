import api from './axios';

export function getListings(category, filters = {}) {
  const params = {};
  if (category) params.category = category;
  if (filters.search) params.search = filters.search;
  if (filters.minPrice) params.minPrice = filters.minPrice;
  if (filters.maxPrice) params.maxPrice = filters.maxPrice;
  if (filters.seller) params.seller = filters.seller;
  if (filters.sort && filters.sort !== 'newest') params.sort = filters.sort;
  return api.get('/listings', { params });
}

export function getListingById(id) {
  return api.get(`/listings/${id}`);
}

export function createListing(formData) {
  return api.post('/listings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function updateListing(id, data) {
  return api.patch(`/listings/${id}`, data);
}

export function setListingAvailability(id, action) {
  return api.patch(`/listings/${id}/availability`, { action });
}

export function renewListing(id) {
  return api.post(`/listings/${id}/renew`);
}

export function setMeetup(id, safeZone) {
  return api.patch(`/listings/${id}/meetup`, { safeZone });
}

export function confirmMeetup(id) {
  return api.patch(`/listings/${id}/meetup/confirm`);
}

export function deleteListing(id) {
  return api.delete(`/listings/${id}`);
}

export function getMyListings() {
  return api.get('/listings/mine');
}