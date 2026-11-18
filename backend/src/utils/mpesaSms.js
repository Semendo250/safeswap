const TZ = '+03:00'; // Kenya time; the SMS shows Nairobi time
const pad = (n) => String(n).padStart(2, '0');

// Any Kenyan number (07xx, 01xx, +254..., 254...) -> 2547XXXXXXXX, or '' if it isn't one
function toMsisdn(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  return '';
}

function moneyToNumber(v) {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// "18/11/26" + "8:06 PM" -> a Date in Nairobi time
function smsTime(dateStr, timeStr) {
  const d = String(dateStr).split('/');
  if (d.length !== 3) return null;
  const day = Number(d[0]);
  const month = Number(d[1]);
  let year = Number(d[2]);
  if (year < 100) year += 2000;
  const t = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP])M)?$/i);
  if (!t) return null;
  let hour = Number(t[1]);
  const minute = Number(t[2]);
  if (t[3]) {
    hour %= 12;
    if (t[3].toUpperCase() === 'P') hour += 12;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${TZ}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Looks for the pieces of a Safaricom "sent / paid to" confirmation instead of relying on one fixed sentence
function parseMpesaSms(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  const out = {
    confirmed: false,
    reversal: false,
    direction: '',
    code: '',
    amount: null,
    phone: '',
    name: '',
    paidAt: null,
    cost: null,
    complete: false,
  };
  if (!text) return out;

  out.confirmed = /\bconfirmed\b/i.test(text);
  out.reversal = /\brevers(?:ed|al)\b/i.test(text);

  const codeMatch = text.match(/^([A-Z0-9]{10})\b/) || text.match(/\b([A-Z0-9]{10})\s+Confirmed\b/);
  if (codeMatch) out.code = codeMatch[1];

  const send = text.match(
    /\b(?:sent|paid|transferred)\s+to\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i
  );
  if (send) {
    out.direction = 'out';
    const phoneRx = /(?<!\d)(?:\+?254|0)[17]\d{8}(?!\d)/;
    const ph = send[1].match(phoneRx);
    if (ph) out.phone = toMsisdn(ph[0]);
    out.name = send[1]
      .replace(phoneRx, '')
      .replace(/\s+/g, ' ')
      .replace(/[\s\-–,.]+$/, '')
      .trim();
    out.paidAt = smsTime(send[2], send[3]);
  } else if (/\breceived\b/i.test(text)) {
    out.direction = 'in';
  }

  const amt =
    text.match(/Ksh\.?\s?([\d,]+(?:\.\d+)?)\s+(?:sent|paid|transferred)\s+to/i) ||
    text.match(/Ksh\.?\s?([\d,]+(?:\.\d+)?)/i);
  if (amt) out.amount = moneyToNumber(amt[1]);

  const cost = text.match(/Transaction\s+cost,?\s*Ksh\.?\s?([\d,]+(?:\.\d+)?)/i);
  out.cost = cost ? moneyToNumber(cost[1]) : null;

  out.complete = !!(out.code && out.amount !== null && out.paidAt);
  return out;
}

// Fields typed by hand when the message could not be read
function cleanManualFields(input) {
  const x = input && typeof input === 'object' ? input : {};
  const amount = moneyToNumber(x.amount);
  let paidAt = null;
  if (x.paidAt) {
    let v = String(x.paidAt).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += `:00${TZ}`;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) paidAt = d;
  }
  const cost = x.cost === '' || x.cost === null || x.cost === undefined ? 0 : moneyToNumber(x.cost);
  return {
    code: String(x.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    amount: amount !== null && amount > 0 ? amount : null,
    phone: toMsisdn(x.phone),
    name: String(x.name || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    paidAt,
    cost: cost !== null && cost >= 0 ? cost : 0,
  };
}

module.exports = { toMsisdn, parseMpesaSms, cleanManualFields };