// Accepts 0712345678, 0112345678, +254712345678, 254712345678, 712345678
// (spaces, dashes and brackets are ignored) and returns 2547XXXXXXXX, or null if invalid.
function normalizeKenyanPhone(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[\s\-().]/g, '');
  const m = cleaned.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

module.exports = { normalizeKenyanPhone };