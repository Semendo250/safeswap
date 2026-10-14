import api from './axios';

export function submitDispute(subject, details) {
  return api.post('/disputes', { subject, details });
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