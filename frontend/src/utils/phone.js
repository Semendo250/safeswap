// Accepts 0712345678, +254712345678, 254712345678, 712345678 (spaces/dashes ignored).
// Returns 2547XXXXXXXX, or null if it isn't a valid Kenyan mobile number.
export function normalizeKenyanPhone(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[\s\-().]/g, '');
  const m = cleaned.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

// 254712345678 -> "0712 345 678". Older numbers saved in another format are shown as they are.
export function formatPhone(phone) {
  const n = normalizeKenyanPhone(phone);
  if (!n) return phone || '';
  const local = '0' + n.slice(3);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

// What to put in an edit box: 254712345678 -> 0712345678
export function phoneForInput(phone) {
  const n = normalizeKenyanPhone(phone);
  return n ? '0' + n.slice(3) : phone || '';
}

// href for a tap-to-call link
export function telHref(phone) {
  const n = normalizeKenyanPhone(phone);
  if (n) return `tel:+${n}`;
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : undefined;
}