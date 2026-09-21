import api from './axios';

export function getOverview() {
  return api.get('/admin/overview');
}

// ----- users -----
export function getUsers(params) {
  return api.get('/admin/users', { params });
}

export function getUserById(id) {
  return api.get(`/admin/users/${id}`);
}

export function setUserBan(id, banned, reason) {
  return api.patch(`/admin/users/${id}/ban`, { banned, reason });
}

export function verifyUserEmail(id) {
  return api.patch(`/admin/users/${id}/verify`);
}

export function deleteUser(id, reason) {
  return api.delete(`/admin/users/${id}`, { data: { reason } });
}

// ----- listings -----
export function getFlaggedListings() {
  return api.get('/admin/flagged-listings');
}

export function getAllListings(params) {
  return api.get('/admin/listings', { params });
}

export function approveListing(id, reason) {
  return api.patch(`/admin/listings/${id}/approve`, { reason });
}

export function removeListing(id, reason) {
  return api.patch(`/admin/listings/${id}/remove`, { reason });
}

// ----- verification -----
export function getVerificationQueue() {
  return api.get('/admin/verification-queue');
}

export function approveFallbackVerification(userId) {
  return api.patch(`/admin/verification/${userId}/approve`);
}

export function rejectFallbackVerification(userId, reason) {
  return api.patch(`/admin/verification/${userId}/reject`, { reason });
}

// ----- IMEI blacklist -----
export function getBlacklist() {
  return api.get('/admin/blacklist');
}

export function addBlacklistImei(imei) {
  return api.post('/admin/blacklist', { imei });
}

export function removeBlacklistImei(id) {
  return api.delete(`/admin/blacklist/${id}`);
}

// ----- payments -----
export function getPayments(params) {
  return api.get('/admin/payments', { params });
}

export function updatePaymentStatus(id, status, reason) {
  return api.patch(`/admin/payments/${id}/status`, { status, reason });
}

// ----- activity log -----
export function getAuditLog(params) {
  return api.get('/admin/audit-log', { params });
}