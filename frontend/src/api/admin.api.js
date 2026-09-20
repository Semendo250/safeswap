import api from './axios';

export function getOverview() {
  return api.get('/admin/overview');
}

export function getFlaggedListings() {
  return api.get('/admin/flagged-listings');
}

export function approveListing(id) {
  return api.patch(`/admin/listings/${id}/approve`);
}

export function removeListing(id) {
  return api.patch(`/admin/listings/${id}/remove`);
}

export function getVerificationQueue() {
  return api.get('/admin/verification-queue');
}

export function approveFallbackVerification(userId) {
  return api.patch(`/admin/verification/${userId}/approve`);
}

export function getBlacklist() {
  return api.get('/admin/blacklist');
}

export function addBlacklistImei(imei) {
  return api.post('/admin/blacklist', { imei });
}

export function removeBlacklistImei(id) {
  return api.delete(`/admin/blacklist/${id}`);
}