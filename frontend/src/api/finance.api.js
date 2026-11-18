import api from './axios';

export function getFinanceOverview() {
  return api.get('/admin/finance/overview');
}

export function getFinanceSettlements(params) {
  return api.get('/admin/finance/settlements', { params });
}

export function getFinanceHeld(params) {
  return api.get('/admin/finance/held', { params });
}

export function getFinanceTrends(days = 30) {
  return api.get('/admin/finance/trends', { params: { days } });
}

// Reads and checks a pasted M-Pesa SMS (or hand-typed fields) without saving anything
export function checkReceipt(id, payload) {
  return api.post(`/admin/finance/settlements/${id}/receipt/check`, payload);
}

// Saves the receipt. The server runs every check again.
export function addReceipt(id, payload) {
  return api.post(`/admin/finance/settlements/${id}/receipt`, payload);
}

export function removeReceipt(id, receiptId, reason) {
  return api.post(`/admin/finance/settlements/${id}/receipt/${receiptId}/remove`, { reason });
}

export function undoSettlement(id, reason) {
  return api.post(`/admin/finance/settlements/${id}/undo`, { reason });
}

export function setFeeRate(rates, reason, applyToDue) {
  return api.patch('/admin/finance/settings/fee', { rates, reason, applyToDue });
}

export function sendSettlement(id, amount) {
  return api.post(`/admin/finance/settlements/${id}/send`, { amount });
}

export function resetTransfer(id, reason) {
  return api.post(`/admin/finance/settlements/${id}/reset-transfer`, { reason });
}