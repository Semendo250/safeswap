// Works out the fee for an agreed price, the same way the server does.
// table is what /api/fees returns. Returns null when there is nothing to show.
export function feeQuote(table, category, amount) {
  const gross = Number(amount);
  if (!table || !table.configured || !Number.isFinite(gross) || gross < 1) return null;

  const list = category === 'phone' ? table.rates.phone : table.rates.general;
  let index = 0;
  for (let i = table.buckets.length - 1; i > 0; i -= 1) {
    if (gross >= table.buckets[i].min) {
      index = i;
      break;
    }
  }

  const percent = Number(list[index]) || 0;
  const fee = percent > 0 ? Math.min(gross, Math.round((gross * percent) / 100)) : 0;
  return { percent, fee, net: gross - fee };
}