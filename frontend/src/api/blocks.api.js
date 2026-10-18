import api from './axios';

export function getBlockStatus(userId) {
  return api.get(`/blocks/status/${userId}`);
}

export function blockUser(userId) {
  return api.post(`/blocks/${userId}`);
}

export function unblockUser(userId) {
  return api.delete(`/blocks/${userId}`);
}