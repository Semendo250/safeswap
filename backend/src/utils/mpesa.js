const axios = require('axios');

// Live Safaricom Daraja API. The sandbox has been removed on purpose.
const BASE_URL = 'https://api.safaricom.co.ke';

// Public Daraja sandbox values. If any of these show up in the config, we refuse to run.
const SANDBOX_SHORTCODE = '174379';
const SANDBOX_PASSKEY_PREFIX = 'bfb279f9aa9bdbcf158e';

const REQUIRED_ENV = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
  'MPESA_CALLBACK_SECRET',
];

const TRANSACTION_TYPES = ['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'];

// Throws a clear error if the M-Pesa settings are missing, still sandbox, or unusable.
// Called once when the server starts, and again before every STK push.
function assertMpesaConfig() {
  const missing = REQUIRED_ENV.filter((k) => !String(process.env[k] || '').trim());
  if (missing.length) {
    throw new Error(`Missing M-Pesa settings: ${missing.join(', ')}`);
  }

  const shortcode = String(process.env.MPESA_SHORTCODE).trim();
  const passkey = String(process.env.MPESA_PASSKEY).trim();
  if (shortcode === SANDBOX_SHORTCODE || passkey.startsWith(SANDBOX_PASSKEY_PREFIX)) {
    throw new Error('M-Pesa is still using the sandbox shortcode or passkey. Put in your production values.');
  }

  let callback;
  try {
    callback = new URL(String(process.env.MPESA_CALLBACK_URL).trim());
  } catch (e) {
    throw new Error('MPESA_CALLBACK_URL is not a valid URL');
  }
  if (callback.protocol !== 'https:') {
    throw new Error('MPESA_CALLBACK_URL must start with https://');
  }
  if (/m-?pesa|safaricom|exe|cmd|sql|query/i.test(callback.hostname + callback.pathname)) {
    throw new Error(
      'MPESA_CALLBACK_URL contains a word Safaricom blocks in production URLs (mpesa, safaricom, exe, exec, cmd, sql, query)'
    );
  }

  const type = process.env.MPESA_TRANSACTION_TYPE;
  if (type && !TRANSACTION_TYPES.includes(type)) {
    throw new Error(`MPESA_TRANSACTION_TYPE must be one of: ${TRANSACTION_TYPES.join(', ')}`);
  }
}

// Fetch an OAuth access token using Consumer Key + Secret
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` }, timeout: 15000 }
  );

  return res.data.access_token;
}

// Generates the timestamp + Base64 password required by STK Push,
// per Daraja's format: Base64(Shortcode + Passkey + Timestamp)
function generateTimestampAndPassword() {
  const now = new Date();
  const timestamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');

  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  return { timestamp, password };
}

function callbackUrlWithToken() {
  const base = String(process.env.MPESA_CALLBACK_URL || '').trim();
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) return base;
  const u = new URL(base);
  u.searchParams.set('token', secret);
  return u.toString();
}

// Initiates an STK Push - the "enter your M-Pesa PIN" prompt on the buyer's phone
async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  assertMpesaConfig();

  // Live M-Pesa only accepts whole shillings
  const wholeAmount = Math.round(Number(amount));
  if (!Number.isFinite(wholeAmount) || wholeAmount < 1) {
    throw new Error('Invalid payment amount');
  }

  const accessToken = await getAccessToken();
  const { timestamp, password } = generateTimestampAndPassword();

  const shortcode = String(process.env.MPESA_SHORTCODE).trim();
  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    // Paybill = CustomerPayBillOnline (default). Till number = CustomerBuyGoodsOnline.
    TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    Amount: wholeAmount,
    PartyA: phone, // buyer's phone, format 2547XXXXXXXX
    // For a Paybill this is the same as the shortcode. For a Till, set MPESA_PARTY_B to the till number.
    PartyB: String(process.env.MPESA_PARTY_B || shortcode).trim(),
    PhoneNumber: phone,
    CallBackURL: callbackUrlWithToken(),
    AccountReference: String(accountReference || 'SafeSwap').slice(0, 12), // Daraja allows 12 characters
    TransactionDesc: String(transactionDesc || 'SafeSwap payment').slice(0, 13), // Daraja allows 13 characters
  };

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 30000 }
  );

  const data = res.data;
  if (!data || String(data.ResponseCode) !== '0' || !data.CheckoutRequestID) {
    throw new Error((data && data.ResponseDescription) || 'M-Pesa did not accept the payment request');
  }

  return data; // includes CheckoutRequestID, used to match the later callback
}
// Asks Safaricom what happened to a payment prompt. Used when the callback is late or missing.
// Returns { state: 'success' | 'failed' | 'processing' | 'unknown', resultCode, resultDesc }
async function queryStkStatus(checkoutRequestId) {
  assertMpesaConfig();
  const accessToken = await getAccessToken();
  const { timestamp, password } = generateTimestampAndPassword();
  try {
    const res = await axios.post(
      `${BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: String(process.env.MPESA_SHORTCODE).trim(),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 }
    );
    const d = res.data || {};
    if (d.ResultCode === undefined || d.ResultCode === null) return { state: 'unknown' };
    const code = Number(d.ResultCode);
    return {
      state: code === 0 ? 'success' : 'failed',
      resultCode: code,
      resultDesc: String(d.ResultDesc || ''),
    };
  } catch (err) {
    const data = err.response && err.response.data;
    // While the customer has not answered yet, Safaricom replies with an error instead of a result
    if (data && /being processed|under processing/i.test(String(data.errorMessage || ''))) {
      return { state: 'processing' };
    }
    return { state: 'unknown' };
  }
}

module.exports = { getAccessToken, initiateStkPush, queryStkStatus, assertMpesaConfig };