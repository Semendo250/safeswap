const crypto = require('crypto');
const { initiateStkPush } = require('../utils/mpesa');
const Listing = require('../models/Listing');
const paymentStore = require('../utils/paymentStore');
const { notify } = require('../utils/notify');

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
async function handleCallback(req, res) {
  try {
    if (!callbackTokenIsValid(req.query.token)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ error: 'Invalid callback payload' });

    const { CheckoutRequestID, ResultCode } = callback;

    let mpesaReceipt;
    const items = callback.CallbackMetadata?.Item;
    if (Array.isArray(items)) {
      const found = items.find((i) => i && i.Name === 'MpesaReceiptNumber');
      if (found && found.Value) mpesaReceipt = String(found.Value);
    }

    const newStatus = ResultCode === 0 ? 'held' : 'failed';
    // settlePending only transitions a payment that is still 'pending', so a
    // repeated or duplicate callback for the same payment returns null here
    // and nothing is notified twice.
    const result = await paymentStore.settlePending(CheckoutRequestID, newStatus, { mpesaReceipt });

    if (result) {
      const listing = await Listing.findById(result.listingId).select('title seller');
      if (newStatus === 'held' && listing) {
        await notify({
          userId: listing.seller,
          type: 'payment_status',
          title: 'Payment received',
          body: `A buyer has paid for "${listing.title}" — arrange the meetup.`,
          link: `/listings/${listing._id}`,
        });
      } else if (newStatus === 'failed') {
        await notify({
          userId: result.buyerId,
          type: 'payment_status',
          title: "Your payment didn't go through",
          body: listing ? `Your payment for "${listing.title}" didn't go through.` : "Your payment didn't go through.",
          link: listing ? `/listings/${listing._id}` : '/browse',
        });
      }
    }

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