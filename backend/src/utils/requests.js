const REQUEST_TTL_DAYS = 30;
const MAX_OPEN_PER_USER = 5;
const MAX_RESPONSES = 30;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'with', 'me', 'my', 'i', 'is', 'are',
  'any', 'anyone', 'someone', 'somebody', 'who', 'has', 'have', 'got', 'sell', 'selling', 'buy',
  'buying', 'need', 'needed', 'needs', 'want', 'wanted', 'wants', 'looking', 'look', 'searching',
  'search', 'seeking', 'urgent', 'urgently', 'please', 'pls', 'plz', 'cheap', 'affordable', 'good',
  'condition', 'used', 'second', 'hand', 'secondhand', 'new', 'clean', 'quality', 'under', 'below',
  'around', 'about', 'max', 'budget', 'kes', 'ksh', 'bob', 'price', 'at', 'near', 'campus',
  'maseno', 'from', 'that', 'this', 'it', 'one', 'pcs', 'piece', 'pieces',
]);

// "Looking for a used HP laptop" and "HP laptop needed" both become "hp laptop"
function keywordFrom(title) {
  const words = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d{4,}$/.test(w));
  const key = [...new Set(words)].sort().join(' ').slice(0, 80);
  return key || String(title || '').toLowerCase().trim().slice(0, 80);
}

// Phone numbers, emails and links are kept out so deals stay inside SafeSwap
function hasContactInfo(text) {
  const s = String(text || '');
  if (/@|https?:\/\/|www\./i.test(s)) return true;
  const digits = s.replace(/[\s.\-()]/g, '');
  return /(?:\+?254|0)[17]\d{8}/.test(digits);
}

function expiryFromNow() {
  return new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
}

module.exports = { REQUEST_TTL_DAYS, MAX_OPEN_PER_USER, MAX_RESPONSES, keywordFrom, hasContactInfo, expiryFromNow };