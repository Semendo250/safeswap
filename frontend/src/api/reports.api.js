import api from './axios';

export function createReport(listingId, reason, details) {
  return api.post('/reports', { listingId, reason, details });
}