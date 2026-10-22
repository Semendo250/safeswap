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

export function markSettlementPaid(id, reference, note) {
  return api.post(`/admin/finance/settlements/${id}/paid`, { reference, note });
}

export function undoSettlement(id, reason) {
  return api.post(`/admin/finance/settlements/${id}/undo`, { reason });
}

export function setFeeRate(rates, reason, applyToDue) {
  return api.patch('/admin/finance/settings/fee', { rates, reason, applyToDue });
}