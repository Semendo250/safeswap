import api from './axios';

// `data` is a FormData (fields + optional profilePicture file)
export function signup(data) {
  return api.post('/auth/signup', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// Used on the signup success screen and the login page while waiting for approval
export function getApprovalStatus(userId) {
  return api.get(`/auth/approval-status/${userId}`);
}

export function verifyOtp(data) {
  return api.post('/auth/verify-otp', data);
}

export function login(data) {
  return api.post('/auth/login', data);
}

// `formData` holds phone, location and an optional profilePicture file
export function updateProfile(formData) {
  return api.patch('/auth/me', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function forgotPassword(data) {
  return api.post('/auth/forgot-password', data);
}

export function resetPassword(data) {
  return api.post('/auth/reset-password', data);
}