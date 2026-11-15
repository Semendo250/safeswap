import api from './axios';

export function getRequests(params) {
  return api.get('/requests', { params });
}

export function getMyRequests() {
  return api.get('/requests/mine');
}

export function getRequestById(id) {
  return api.get(`/requests/${id}`);
}

export function createRequest(payload) {
  return api.post('/requests', payload);
}

export function respondToRequest(id, payload) {
  return api.post(`/requests/${id}/respond`, payload);
}

export function setRequestStatus(id, status) {
  return api.patch(`/requests/${id}/status`, { status });
}