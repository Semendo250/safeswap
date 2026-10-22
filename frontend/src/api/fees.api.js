import api from './axios';

export function getFeeTable() {
  return api.get('/fees');
}