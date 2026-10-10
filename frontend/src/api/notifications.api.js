import api from './axios';

export function getNotifications(page = 1) {
  return api.get('/notifications', { params: { page } });
}

export function getUnreadCount() {
  return api.get('/notifications/unread-count');
}

export function markOneRead(id) {
  return api.patch(`/notifications/${id}/read`);
}

export function markAllRead() {
  return api.patch('/notifications/read-all');
}

export function registerPushToken(token) {
  return api.post('/notifications/token', { token });
}

export function removePushToken(token) {
  return api.delete('/notifications/token', { data: { token } });
}