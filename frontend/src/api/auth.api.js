import api from './axios';

export function signup(data) {
  return api.post('/auth/signup', data);
}

export function verifyOtp(data) {
  return api.post('/auth/verify-otp', data);
}

export function login(data) {
  return api.post('/auth/login', data);
}
export function forgotPassword(data) {
  return api.post('/auth/forgot-password', data);
}

export function resetPassword(data) {
  return api.post('/auth/reset-password', data);
}