const Setting = require('../models/Setting');

const TIERS_KEY = 'feeTiers'; // current: one rate per price range, per category
const FLAT_KEY = 'feeRates'; // previous version: one rate per category
const LEGACY_KEY = 'feePercent'; // first version: one rate for everything
const MAX_FEE_PERCENT = 30;

// Price ranges, based on the agreed price in KES. The last range has no upper limit.
// Change the boundaries here if you ever need different ranges.
const RANGES = [
  { min: 1, max: 999 },
  { min: 1000, max: 2999 },
  { min: 3000, max: 4999 },
  { min: 5000, max: 7999 },
  { min: 8000, max: 9999 },
  { min: 10000, max: 14999 },
  { min: 15000, max: 29999 },
  { min: 30000, max: null },
];

const fmt = (n) => Number(n).toLocaleString('en-US');

const FEE_BUCKETS = RANGES.map((r, i) => ({
  min: r.min,
  max: r.max,
  label:
    i === 0
      ? `Under KES ${fmt(RANGES[1].min)}`
      : r.max === null
      ? `KES ${fmt(r.min)} and above`
      : `KES ${fmt(r.min)} to ${fmt(r.max)}`,
}));

const CATEGORIES = ['phone', 'general'];
const CATEGORY_NAME = { phone: 'Phones', general: 'Other items' };

let cached = null;
let cachedAt = 0;

function isValidFee(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_FEE_PERCENT;
}

function filled(n) {
  return { phone: FEE_BUCKETS.map(() => n), general: FEE_BUCKETS.map(() => n) };
}

// Which range an agreed price falls in (index into FEE_BUCKETS)
function bucketIndex(amount) {
  const a = Number(amount) || 0;
  for (let i = FEE_BUCKETS.length - 1; i > 0; i -= 1) {
    if (a >= FEE_BUCKETS[i].min) return i;
  }
  return 0;
}

// The fee percentage for a category and an agreed price
function rateFor(rates, category, amount) {
  const list = category === 'phone' ? rates.phone : rates.general;
  return list[bucketIndex(amount)];
}

function readTiers(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const cat of CATEGORIES) {
    const list = value[cat];
    if (!Array.isArray(list) || list.length !== FEE_BUCKETS.length) return null;
    const nums = list.map(Number);
    if (!nums.every(isValidFee)) return null;
    out[cat] = nums;
  }
  return out;
}

function readFlat(value) {
  if (!value || typeof value !== 'object') return null;
  const phone = Number(value.phone);
  const general = Number(value.general);
  if (!isValidFee(phone) || !isValidFee(general)) return null;
  return {
    phone: FEE_BUCKETS.map(() => phone),
    general: FEE_BUCKETS.map(() => general),
  };
}

// The fee rates: { phone: [one % per range], general: [one % per range] }
async function getFeeRates() {
  if (cached && Date.now() - cachedAt < 30 * 1000) {
    return { phone: [...cached.phone], general: [...cached.general] };
  }
  try {
    let rates = null;
    const tiers = await Setting.findOne({ key: TIERS_KEY }).lean();
    if (tiers) rates = readTiers(tiers.value);

    // Earlier versions stored one rate per category, or one rate for everything
    if (!rates) {
      const flat = await Setting.findOne({ key: FLAT_KEY }).lean();
      if (flat) rates = readFlat(flat.value);
    }
    if (!rates) {
      const legacy = await Setting.findOne({ key: LEGACY_KEY }).lean();
      const n = legacy ? Number(legacy.value) : NaN;
      rates = isValidFee(n) ? filled(n) : filled(0);
    }

    cached = rates;
    cachedAt = Date.now();
    return { phone: [...rates.phone], general: [...rates.general] };
  } catch (err) {
    return filled(0);
  }
}

// Checks rates sent from the page. Returns { rates } or { error }.
function validateRates(input) {
  if (!input || typeof input !== 'object') return { error: 'Fee rates are missing' };
  const rates = {};
  for (const cat of CATEGORIES) {
    const list = input[cat];
    if (!Array.isArray(list) || list.length !== FEE_BUCKETS.length) {
      return { error: `Fee rates for ${CATEGORY_NAME[cat]} are incomplete` };
    }
    const nums = [];
    for (let i = 0; i < list.length; i += 1) {
      const raw = list[i];
      const n = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
      const where = `${CATEGORY_NAME[cat]}, ${FEE_BUCKETS[i].label}`;
      if (!Number.isFinite(n) || n < 0 || n > MAX_FEE_PERCENT) {
        return { error: `Enter a fee from 0 to ${MAX_FEE_PERCENT}% for ${where}` };
      }
      if (Math.round(n * 100) / 100 !== n) {
        return { error: `Use at most 2 decimal places for ${where}` };
      }
      nums.push(n);
    }
    rates[cat] = nums;
  }
  return { rates };
}

// true once an admin has saved fees (even all 0), so the page can tell "never set" from "set to 0"
async function isFeeConfigured() {
  try {
    return !!(await Setting.exists({ key: { $in: [TIERS_KEY, FLAT_KEY, LEGACY_KEY] } }));
  } catch (err) {
    return false;
  }
}

async function setFeeRates(rates) {
  const value = { phone: [...rates.phone], general: [...rates.general] };
  await Setting.findOneAndUpdate({ key: TIERS_KEY }, { value }, { upsert: true, new: true });
  cached = value;
  cachedAt = Date.now();
}

module.exports = {
  getFeeRates,
  setFeeRates,
  rateFor,
  bucketIndex,
  isFeeConfigured,
  validateRates,
  FEE_BUCKETS,
  MAX_FEE_PERCENT,
};