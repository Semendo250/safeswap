import api from './axios';

export function getConversation(listingId) {
  return api.get(`/chat/${listingId}`);
}

export function sendMessage(listingId, receiverId, content) {
  return api.post(`/chat/${listingId}`, { receiverId, content });
}

export function markAsRead(messageId) {
  return api.patch(`/chat/${messageId}/read`);
}
export function getConversations() {
  return api.get('/chat');
}
export function deleteMessage(messageId, forEveryone) {
  return api.delete(`/chat/message/${messageId}`, { data: { forEveryone } });
}