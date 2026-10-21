const Setting = require('../models/Setting');

const RATES_KEY = 'feeRates';
const LEGACY_KEY = 'feePercent'; // the single rate from the first version, still honoured if present
const DEFAULT_RATES = { phone: 0, general: 0 }; // no fee until the admin sets one
const MAX_FEE_PERCENT = 30;

let cached = null;
let cachedAt = 0;

function isValidFee(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_FEE_PERCENT;
}

// The fee rates, as percentages of the agreed price: { phone, general }
async function getFeeRates() {
  if (cached && Date.now() - cachedAt < 30 * 1000) return { ...cached };
  try {
    let rates = null;
    const row = await Setting.findOne({ key: RATES_KEY }).lean();
    if (row && row.value && typeof row.value === 'object') {
      const phone = Number(row.value.phone);
      const general = Number(row.value.general);
      if (isValidFee(phone) && isValidFee(general)) rates = { phone, general };
    }
    if (!rates) {
      const legacy = await Setting.findOne({ key: LEGACY_KEY }).lean();
      const n = legacy ? Number(legacy.value) : NaN;
      rates = isValidFee(n) ? { phone: n, general: n } : { ...DEFAULT_RATES };
    }
    cached = rates;
    cachedAt = Date.now();
    return { ...cached };
  } catch (err) {
    return { ...DEFAULT_RATES };
  }
}

// Phones have their own rate. Everything else uses the "general" rate.
function rateFor(rates, category) {
  return category === 'phone' ? rates.phone : rates.general;
}

// true once an admin has saved a fee (even 0), so the page can tell "never set" from "set to 0"
async function isFeeConfigured() {
  try {
    return !!(await Setting.exists({ key: { $in: [RATES_KEY, LEGACY_KEY] } }));
  } catch (err) {
    return false;
  }
}

async function setFeeRates(rates) {
  const value = { phone: rates.phone, general: rates.general };
  await Setting.findOneAndUpdate({ key: RATES_KEY }, { value }, { upsert: true, new: true });
  cached = value;
  cachedAt = Date.now();
}

module.exports = {
  getFeeRates,
  setFeeRates,
  rateFor,
  isFeeConfigured,
  isValidFee,
  DEFAULT_RATES,
  MAX_FEE_PERCENT,
};