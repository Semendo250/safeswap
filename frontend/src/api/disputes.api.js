import api from './axios';

export function submitDispute(subject, details) {
  return api.post('/disputes', { subject, details });
}