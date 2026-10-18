const Setting = require('../models/Setting');

const DEFAULT_OFFER_HOURS = 48;
let cached = null;
let cachedAt = 0;

async function getOfferHours() {
  if (cached !== null && Date.now() - cachedAt < 60 * 1000) return cached;
  try {
    const row = await Setting.findOne({ key: 'offerHours' }).lean();
    const n = Number(row && row.value);
    cached = Number.isInteger(n) && n >= 1 && n <= 168 ? n : DEFAULT_OFFER_HOURS;
  } catch (err) {
    cached = DEFAULT_OFFER_HOURS;
  }
  cachedAt = Date.now();
  return cached;
}

async function setOfferHours(hours) {
  await Setting.findOneAndUpdate({ key: 'offerHours' }, { value: hours }, { upsert: true, new: true });
  cached = hours;
  cachedAt = Date.now();
}

async function getOfferTtlMs() {
  return (await getOfferHours()) * 60 * 60 * 1000;
}

module.exports = { getOfferHours, setOfferHours, getOfferTtlMs, DEFAULT_OFFER_HOURS };