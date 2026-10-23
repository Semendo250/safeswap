const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const BASES = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

// Kept separate from the STK push setting on purpose, so payouts can't go live by accident
function envName() {
  return process.env.MPESA_B2C_ENV === 'production' ? 'production' : 'sandbox';
}

// The most that can be sent in one go (Safaricom's own per-transaction limit is KES 150,000)
function maxAmount() {
  const n = parseInt(process.env.B2C_MAX_AMOUNT, 10);
  return Number.isInteger(n) && n > 0 ? n : 150000;
}

function consumerKeys() {
  return {
    key: process.env.MPESA_B2C_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY,
    secret: process.env.MPESA_B2C_CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET,
  };
}

// What is still missing before automatic sending can work
function configProblems() {
  const problems = [];
  ['MPESA_B2C_SHORTCODE', 'MPESA_INITIATOR_NAME', 'MPESA_CALLBACK_URL', 'MPESA_CALLBACK_SECRET'].forEach((name) => {
    if (!process.env[name]) problems.push(name);
  });
  const k = consumerKeys();
  if (!k.key || !k.secret) problems.push('MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET');
  const hasCredential = !!process.env.MPESA_SECURITY_CREDENTIAL;
  const hasPasswordAndCert =
    !!process.env.MPESA_INITIATOR_PASSWORD && !!(process.env.MPESA_CERT_PEM || process.env.MPESA_CERT_PATH);
  if (!hasCredential && !hasPasswordAndCert) {
    problems.push('MPESA_SECURITY_CREDENTIAL (or MPESA_INITIATOR_PASSWORD with MPESA_CERT_PEM)');
  }
  return problems;
}

function status() {
  const enabled = process.env.B2C_ENABLED === 'true';
  const problems = enabled ? configProblems() : [];
  return { enabled, ready: enabled && problems.length === 0, env: envName(), problems, maxAmount: maxAmount() };
}

// 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX and 2547XXXXXXXX all become 2547XXXXXXXX
function toMsisdn(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(d)) return d;
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  return null;
}

// The initiator password, encrypted with Safaricom's certificate
function securityCredential() {
  if (process.env.MPESA_SECURITY_CREDENTIAL) return process.env.MPESA_SECURITY_CREDENTIAL;
  const password = process.env.MPESA_INITIATOR_PASSWORD;
  let pem = process.env.MPESA_CERT_PEM;
  if (pem) pem = pem.replace(/\\n/g, '\n');
  else if (process.env.MPESA_CERT_PATH) pem = fs.readFileSync(process.env.MPESA_CERT_PATH, 'utf8');
  if (!password || !pem) throw new Error('The initiator password or certificate is missing');
  return crypto
    .publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password))
    .toString('base64');
}

async function getToken() {
  const { key, secret } = consumerKeys();
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await axios.get(`${BASES[envName()]}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 15000,
  });
  return res.data.access_token;
}

function errorText(err) {
  const data = err && err.response && err.response.data;
  return (data && (data.errorMessage || data.ResponseDescription || data.error_description)) || (err && err.message) || 'Unknown error';
}

// An error raised before anything was sent to M-Pesa, so it is safe to try again
function notSent(message) {
  const e = new Error(message);
  e.notSent = true;
  return e;
}

// Where M-Pesa sends the result. The settlement id and attempt number are in the address so the
// result can be matched even if it arrives before we have saved M-Pesa's own reference.
function callbackUrls(settlementId, attempt) {
  const origin = new URL(process.env.MPESA_CALLBACK_URL).origin;
  const q = `token=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET)}&sid=${settlementId}&a=${attempt}`;
  return { result: `${origin}/api/b2c/result?${q}`, timeout: `${origin}/api/b2c/timeout?${q}` };
}

// Sends money from the business account to a customer's phone.
// Resolves with M-Pesa's acknowledgement (the money is NOT sent yet at that point).
async function sendB2C({ settlementId, attempt, phone, amount, remarks }) {
  const msisdn = toMsisdn(phone);
  if (!msisdn) throw notSent('That phone number is not a valid Kenyan M-Pesa number.');
  if (!Number.isInteger(amount) || amount < 1) throw notSent('The amount must be a whole number of shillings.');

  let token;
  let credential;
  try {
    credential = securityCredential();
    token = await getToken();
  } catch (err) {
    throw notSent(`Could not prepare the request: ${errorText(err)}`);
  }

  const urls = callbackUrls(settlementId, attempt);
  const body = {
    InitiatorName: process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: credential,
    CommandID: 'BusinessPayment',
    Amount: amount,
    PartyA: process.env.MPESA_B2C_SHORTCODE,
    PartyB: msisdn,
    Remarks: String(remarks || 'SafeSwap').slice(0, 100),
    QueueTimeOutURL: urls.timeout,
    ResultURL: urls.result,
  };

  const res = await axios.post(`${BASES[envName()]}/mpesa/b2c/v1/paymentrequest`, body, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });
  return { msisdn, data: res.data };
}

module.exports = { status, toMsisdn, sendB2C, errorText, maxAmount };