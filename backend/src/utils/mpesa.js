const axios = require('axios');

const BASE_URL = 'https://sandbox.safaricom.co.ke'; // switch to api.safaricom.co.ke for production

// Fetch an OAuth access token using Consumer Key + Secret
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const res = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
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

// Initiates an STK Push - the "enter your M-Pesa PIN" prompt on the buyer's phone
async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const accessToken = await getAccessToken();
  const { timestamp, password } = generateTimestampAndPassword();

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone, // buyer's phone, format 2547XXXXXXXX
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: accountReference, // e.g. listing ID or a short order ref
    TransactionDesc: transactionDesc || 'SafeSwap payment',
  };

  const res = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return res.data; // includes CheckoutRequestID, used to match the later callback
}

module.exports = { getAccessToken, initiateStkPush };