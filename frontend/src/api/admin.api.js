import api from './axios';

export function getOverview() {
  return api.get('/admin/overview');
}

export function getNeedsAttention() {
  return api.get('/admin/needs-attention');
}

export function getMoneyOverview() {
  return api.get('/admin/money-overview');
}

export function getTrends(days = 7) {
  return api.get('/admin/trends', { params: { days } });
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

export function getRiskSignals(ids) {
  return api.post('/admin/risk-signals', { ids });
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
export function getBlacklist(params) {
  return api.get('/admin/blacklist', { params });
}

export function addBlacklistImei(imei, reason, source) {
  return api.post('/admin/blacklist', { imei, reason, source });
}

export function bulkAddBlacklist(text, reason, source) {
  return api.post('/admin/blacklist/bulk', { text, reason, source });
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

// ----- CSV export (kind is 'payments' or 'users') -----
export function downloadExport(kind, params) {
  return api.get(`/admin/export/${kind}.csv`, { params, responseType: 'blob' });
}

// ----- meetup spots -----
export function getSafeZonesAdmin() {
  return api.get('/admin/safe-zones');
}

export function createSafeZone(name) {
  return api.post('/admin/safe-zones', { name });
}

export function updateSafeZone(id, payload) {
  return api.patch(`/admin/safe-zones/${id}`, payload);
}

export function deleteSafeZone(id) {
  return api.delete(`/admin/safe-zones/${id}`);
}

// ----- announcements -----
export function getAnnouncements(params) {
  return api.get('/admin/announcements', { params });
}

export function sendAnnouncement(payload) {
  return api.post('/admin/announcements', payload);
}

// ----- disputes -----
export function getAdminList() {
  return api.get('/admin/admin-list');
}

export function getDisputes(params) {
  return api.get('/admin/disputes', { params });
}

export function createDispute(payload) {
  return api.post('/admin/disputes', payload);
}

export function updateDispute(id, payload) {
  return api.patch(`/admin/disputes/${id}`, payload);
}

export function addDisputeNote(id, text) {
  return api.post(`/admin/disputes/${id}/notes`, { text });
}

// ----- activity log -----
export function getAuditLog(params) {
  return api.get('/admin/audit-log', { params });
}