const crypto = require('crypto');
const { initiateStkPush } = require('../utils/mpesa');
const Listing = require('../models/Listing');
const paymentStore = require('../utils/paymentStore');

// Checks the secret that we put on the callback URL (see MPESA_CALLBACK_SECRET).
// Until the secret is configured this lets callbacks through, so existing payments
// keep working, but it warns loudly. Set the secret before real payments go live.
function callbackTokenIsValid(provided) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) {
    console.warn('MPESA_CALLBACK_SECRET is not set: M-Pesa callbacks are NOT authenticated');
    return true;
  }
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/payments/stk-push
async function initiatePayment(req, res) {
  try {
    const { listingId, phone } = req.body;
    if (!listingId || !phone) {
      return res.status(400).json({ error: 'listingId and phone are required' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You can't buy your own listing" });
    }
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    // Money is already held for this item: a second payment would strand one of them.
    // This also stops the same buyer paying twice.
    const held = await paymentStore.getHeldByListingId(listing._id.toString());
    if (held) {
      return res.status(409).json({ error: 'A payment for this item is already in progress' });
    }

    const result = await initiateStkPush({
      phone,
      amount: listing.price,
      accountReference: listing._id.toString(),
      transactionDesc: `SafeSwap: ${listing.title}`,
    });

    await paymentStore.createPending(result.CheckoutRequestID, {
      listingId: listing._id.toString(),
      buyerId: req.user._id.toString(),
      amount: listing.price,
      phone,
    });

    res.json({
      message: 'STK push sent - check your phone',
      checkoutRequestId: result.CheckoutRequestID,
    });
  } catch (err) {
    const safaricomError = err.response?.data;
    res.status(500).json({ error: safaricomError || err.message });
  }
}

// POST /api/payments/callback
// Called by Safaricom, not by the app. Protected by a secret in the URL.
async function handleCallback(req, res) {
  try {
    if (!callbackTokenIsValid(req.query.token)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ error: 'Invalid callback payload' });

    const { CheckoutRequestID, ResultCode } = callback;

    // On success Safaricom includes the M-Pesa receipt number; keep it so admins
    // can find the transaction later (refunds, disputes)
    let mpesaReceipt;
    const items = callback.CallbackMetadata?.Item;
    if (Array.isArray(items)) {
      const found = items.find((i) => i && i.Name === 'MpesaReceiptNumber');
      if (found && found.Value) mpesaReceipt = String(found.Value);
    }

    // Only a pending payment can change state, so a repeated or replayed callback
    // can't reopen a payment that was already released or failed.
    await paymentStore.settlePending(
      CheckoutRequestID,
      ResultCode === 0 ? 'held' : 'failed',
      { mpesaReceipt }
    );
    // ResultCode 0 = success. Status moves to 'held' - this is the
    // escrow-lite state: payment confirmed but not yet released to the
    // seller until handover is confirmed (see confirmMeetup in listings).

    res.json({ ResultCode: 0, ResultDesc: 'Received' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/payments/status/:checkoutRequestId
async function getPaymentStatus(req, res) {
  try {
    const record = await paymentStore.getByCheckoutId(req.params.checkoutRequestId);
    if (!record) return res.status(404).json({ error: 'No record found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { initiatePayment, handleCallback, getPaymentStatus };