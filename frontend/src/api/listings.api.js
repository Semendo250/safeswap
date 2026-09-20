import api from './axios';

export function getListings(category) {
  const params = category ? { category } : {};
  return api.get('/listings', { params });
}

export function getListingById(id) {
  return api.get(`/listings/${id}`);
}

// formData must be built with FormData() on the calling side, since this
// is a multipart request (text fields + photo files together)
export function createListing(formData) {
  return api.post('/listings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function updateListing(id, data) {
  return api.patch(`/listings/${id}`, data);
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