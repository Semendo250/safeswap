const crypto = require('crypto');
const { initiateStkPush } = require('../utils/mpesa');
const Listing = require('../models/Listing');
const paymentStore = require('../utils/paymentStore');
const { notify, notifyAdmins } = require('../utils/notify');
const { getAgreedOffer, agreedAmount, parsePrice, onPaymentHeld } = require('../utils/offers');

const STALE_PENDING_MS = 10 * 60 * 1000;

function callbackTokenIsValid(provided) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('MPESA_CALLBACK_SECRET is not set: rejecting M-Pesa callback');
      return false;
    }
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

    const listingKey = listing._id.toString();
    await paymentStore.failStalePending(listingKey, STALE_PENDING_MS);
    const active = await paymentStore.getActiveByListingId(listingKey);
    if (active) {
      return res.status(409).json({ error: 'A payment for this item is already in progress' });
    }

    const buyerId = req.user._id.toString();
    const agreed = await getAgreedOffer(listing._id, buyerId);
    const amount = parsePrice(agreed ? agreedAmount(agreed, listing) : listing.price);
    if (amount === null) {
      return res.status(400).json({ error: 'This listing has an invalid price' });
    }

    const result = await initiateStkPush({
      phone,
      amount,
      accountReference: listingKey,
      transactionDesc: `SafeSwap: ${listing.title}`,
    });

    await paymentStore.createPending(result.CheckoutRequestID, {
      listingId: listingKey,
      buyerId,
      amount,
      phone,
    });

    res.json({
      message: 'STK push sent - check your phone',
      checkoutRequestId: result.CheckoutRequestID,
      amount,
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
    const ack = { ResultCode: 0, ResultDesc: 'Received' };

    const existing = await paymentStore.getByCheckoutId(String(CheckoutRequestID));
    if (!existing) return res.json(ack);

    let mpesaReceipt;
    let paidAmount;
    const items = callback.CallbackMetadata?.Item;
    if (Array.isArray(items)) {
      const receipt = items.find((i) => i && i.Name === 'MpesaReceiptNumber');
      if (receipt && receipt.Value) mpesaReceipt = String(receipt.Value);
      const amt = items.find((i) => i && i.Name === 'Amount');
      if (amt && amt.Value !== undefined) paidAmount = Number(amt.Value);
    }

    if (ResultCode === 0 && existing.status === 'failed') {
      await notifyAdmins({
        type: 'payment_status',
        title: 'Late payment needs review',
        body: `Checkout ${CheckoutRequestID} was paid after it was marked failed.`,
        link: '/admin/payments',
      });
    }

    let newStatus = ResultCode === 0 ? 'held' : 'failed';
    if (
      newStatus === 'held' &&
      paidAmount !== undefined &&
      existing.amount !== undefined &&
      paidAmount !== Number(existing.amount)
    ) {
      newStatus = 'failed';
      console.error(`Payment amount mismatch for ${CheckoutRequestID}: expected ${existing.amount}, got ${paidAmount}`);
      await notifyAdmins({
        type: 'payment_status',
        title: 'Payment amount mismatch',
        body: `Checkout ${CheckoutRequestID}: expected KES ${existing.amount}, received KES ${paidAmount}.`,
        link: '/admin/payments',
      });
    }

    const result = await paymentStore.settlePending(CheckoutRequestID, newStatus, { mpesaReceipt });

    if (result) {
      const listing = await Listing.findById(result.listingId).select('title seller');
      if (newStatus === 'held' && listing) {
        await onPaymentHeld(result.listingId, result.buyerId);
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

    res.json(ack);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/payments/status/:checkoutRequestId
async function getPaymentStatus(req, res) {
  try {
    const record = await paymentStore.getByCheckoutId(String(req.params.checkoutRequestId));
    if (!record) return res.status(404).json({ error: 'No record found' });

    const me = String(req.user._id);
    let allowed = req.user.role === 'admin' || String(record.buyerId) === me;

    if (!allowed) {
      const listing = await Listing.findById(record.listingId).select('seller').lean();
      allowed = !!listing && String(listing.seller) === me;
    }

    if (!allowed) return res.status(404).json({ error: 'No record found' });

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { initiatePayment, handleCallback, getPaymentStatus };