import api from './axios';

export function submitDispute(subject, details, listingId) {
  return api.post('/disputes', { subject, details, listingId });
}

export function getMyDisputes() {
  return api.get('/disputes/mine');
}

export function getMyDispute(id) {
  return api.get(`/disputes/${id}`);
}

export function sendDisputeMessage(id, text) {
  return api.post(`/disputes/${id}/messages`, { text });
}