const crypto = require('crypto');
const { initiateStkPush, queryStkStatus } = require('../utils/mpesa');
const { normalizeKenyanPhone } = require('../utils/phone');
const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const paymentStore = require('../utils/paymentStore');
const { notify, notifyAdmins } = require('../utils/notify');
const { getAgreedOffer, agreedAmount, parsePrice, onPaymentHeld } = require('../utils/offers');

const STALE_PENDING_MS = 10 * 60 * 1000;
const PAYMENT_LOCK_MS = 60 * 1000;
const CANCEL_AFTER_SECONDS = 60; // the phone prompt is gone by then
const QUERY_AFTER_MS = 20 * 1000; // before this, the normal callback is still expected
const QUERY_GAP_MS = 10 * 1000; // at most one question to Safaricom per payment every 10 seconds
const lastQueryAt = new Map();

function callbackTokenIsValid(provided) {
  const secret = process.env.MPESA_CALLBACK_SECRET;
  if (!secret) {
    console.error('MPESA_CALLBACK_SECRET is not set: rejecting M-Pesa callback');
    return false;
  }
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Safaricom's result codes, in words a buyer understands
function friendlyReason(code, desc) {
  switch (Number(code)) {
    case 1:
      return 'Your M-Pesa balance was not enough for this payment.';
    case 1001:
      return 'Another M-Pesa request is still open on your phone. Wait a minute, then try again.';
    case 1019:
      return 'The request expired before you responded.';
    case 1025:
      return 'We could not send the prompt to your phone. Check the number and try again.';
    case 1032:
      return 'You cancelled the request on your phone.';
    case 1037:
      return "The prompt timed out. Your phone didn't respond in time.";
    case 2001:
      return 'The M-Pesa PIN entered was wrong.';
    default:
      return desc || "The payment didn't go through.";
  }
}

// What the app shows: the record, the reason when it failed, and how long it has been waiting
function shapePayment(record) {
  const created = record.createdAt ? new Date(record.createdAt).getTime() : Date.now();
  return {
    ...record,
    message: record.status === 'failed' ? friendlyReason(record.resultCode, record.resultDesc) : '',
    waitingSeconds: Math.max(Math.floor((Date.now() - created) / 1000), 0),
    cancelAfterSeconds: CANCEL_AFTER_SECONDS,
  };
}

// Settles a pending payment from a result that came from Safaricom: the callback, or our own status check
async function applyStkResult({ checkoutRequestId, resultCode, resultDesc, items, fromQuery = false }) {
  const id = String(checkoutRequestId);
  const existing = await paymentStore.getByCheckoutId(id);
  if (!existing) return null;

  let mpesaReceipt;
  let paidAmount;
  if (Array.isArray(items)) {
    const receipt = items.find((i) => i && i.Name === 'MpesaReceiptNumber');
    if (receipt && receipt.Value) mpesaReceipt = String(receipt.Value);
    const amt = items.find((i) => i && i.Name === 'Amount');
    if (amt && amt.Value !== undefined) paidAmount = Number(amt.Value);
  }

  // The late callback of a payment that a status check already marked as paid brings the receipt number
  if (existing.status === 'held' && resultCode === 0 && mpesaReceipt && !existing.mpesaReceipt) {
    await paymentStore.attachReceipt(id, mpesaReceipt);
  }

  if (resultCode === 0 && existing.status === 'failed') {
    await paymentStore.flagReview(id, 'Paid after it was marked failed or cancelled', { mpesaReceipt });
    await notifyAdmins({
      type: 'payment_status',
      title: 'Late payment needs review',
      body: `Checkout ${id} was paid after it was marked failed or cancelled.`,
      link: '/admin/payments',
    });
  }

  let newStatus = resultCode === 0 ? 'held' : 'failed';
  let reviewNote;
  if (
    newStatus === 'held' &&
    paidAmount !== undefined &&
    existing.amount !== undefined &&
    paidAmount !== Number(existing.amount)
  ) {
    newStatus = 'failed';
    reviewNote = `Amount mismatch: expected KES ${existing.amount}, received KES ${paidAmount}`;
    console.error(`Payment amount mismatch for ${id}: expected ${existing.amount}, got ${paidAmount}`);
    await notifyAdmins({
      type: 'payment_status',
      title: 'Payment amount mismatch',
      body: `Checkout ${id}: expected KES ${existing.amount}, received KES ${paidAmount}.`,
      link: '/admin/payments',
    });
  }
  if (newStatus === 'held' && fromQuery) {
    reviewNote = 'Confirmed by M-Pesa status check; receipt number not received yet';
  }

  const result = await paymentStore.settlePending(id, newStatus, {
    mpesaReceipt,
    reviewNote,
    resultCode,
    resultDesc,
  });
  lastQueryAt.delete(id);

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
      const reason = friendlyReason(resultCode, resultDesc);
      await notify({
        userId: result.buyerId,
        type: 'payment_status',
        title: "Your payment didn't go through",
        body: listing
          ? `Your payment for "${listing.title}" didn't go through. ${reason}`
          : `Your payment didn't go through. ${reason}`,
        link: listing ? `/listings/${listing._id}` : '/browse',
      });
    }
  }
  return result;
}

// If the callback is late or missing, ask Safaricom what happened to the prompt
async function syncPending(record) {
  if (!record || record.status !== 'pending') return record;
  const id = record.checkoutRequestId;
  const age = Date.now() - new Date(record.createdAt).getTime();
  if (age < QUERY_AFTER_MS) return record;
  if (Date.now() - (lastQueryAt.get(id) || 0) < QUERY_GAP_MS) return record;
  lastQueryAt.set(id, Date.now());
  try {
    const q = await queryStkStatus(id);
    if (q.state === 'success' || q.state === 'failed') {
      await applyStkResult({
        checkoutRequestId: id,
        resultCode: q.resultCode,
        resultDesc: q.resultDesc,
        fromQuery: true,
      });
      return (await paymentStore.getByCheckoutId(id)) || record;
    }
  } catch (err) {
    console.error('STK status check failed:', (err.response && err.response.data) || err.message);
  }
  return record;
}

// POST /api/payments/stk-push
async function initiatePayment(req, res) {
  let lockedListingId = null;
  try {
    const { listingId, phone } = req.body;
    if (!listingId || !phone) {
      return res.status(400).json({ error: 'listingId and phone are required' });
    }
    const msisdn = normalizeKenyanPhone(String(phone).trim());
    if (!msisdn) {
      return res.status(400).json({ error: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' });
    }
    if (!/^[a-f\d]{24}$/i.test(String(listingId))) {
      return res.status(400).json({ error: 'Invalid listing' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (listing.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You can't buy your own listing" });
    }
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    const now = new Date();
    const locked = await Listing.findOneAndUpdate(
      {
        _id: listing._id,
        status: 'active',
        $or: [
          { paymentLockUntil: { $exists: false } },
          { paymentLockUntil: null },
          { paymentLockUntil: { $lt: now } },
        ],
      },
      {
        paymentLockUntil: new Date(now.getTime() + PAYMENT_LOCK_MS),
        paymentLockBy: req.user._id,
      },
      { new: true }
    );
    if (!locked) {
      return res.status(409).json({ error: 'A payment for this item is already in progress' });
    }
    lockedListingId = listing._id;

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
      phone: msisdn,
      amount,
      accountReference: listingKey,
      transactionDesc: `SafeSwap: ${listing.title}`,
    });

    await paymentStore.createPending(result.CheckoutRequestID, {
      listingId: listingKey,
      buyerId,
      amount,
      phone: msisdn,
      askingPrice: listing.price,
      offerId: agreed ? agreed._id.toString() : undefined,
    });

    res.json({
      message: 'STK push sent - check your phone',
      checkoutRequestId: result.CheckoutRequestID,
      amount,
      cancelAfterSeconds: CANCEL_AFTER_SECONDS,
    });
  } catch (err) {
    console.error('STK push failed:', (err.response && err.response.data) || err.message);
    const safaricomError = err.response && err.response.data;
    const message =
      (safaricomError && (safaricomError.errorMessage || safaricomError.ResponseDescription)) ||
      'Could not start the M-Pesa payment. Please try again.';
    res.status(500).json({ error: message });
  } finally {
    if (lockedListingId) {
      try {
        await Listing.updateOne(
          { _id: lockedListingId, paymentLockBy: req.user._id },
          { $unset: { paymentLockUntil: 1, paymentLockBy: 1 } }
        );
      } catch (e) {
        console.error('Could not release payment lock:', e.message);
      }
    }
  }
}

// POST /api/payments/callback
async function handleCallback(req, res) {
  try {
    if (!callbackTokenIsValid(req.query.token)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const callback = req.body && req.body.Body && req.body.Body.stkCallback;
    if (!callback) return res.status(400).json({ error: 'Invalid callback payload' });

    await applyStkResult({
      checkoutRequestId: callback.CheckoutRequestID,
      resultCode: Number(callback.ResultCode),
      resultDesc: String(callback.ResultDesc || ''),
      items: callback.CallbackMetadata && callback.CallbackMetadata.Item,
    });

    res.json({ ResultCode: 0, ResultDesc: 'Received' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/payments/status/:checkoutRequestId
async function getPaymentStatus(req, res) {
  try {
    let record = await paymentStore.getByCheckoutId(String(req.params.checkoutRequestId));
    if (!record) return res.status(404).json({ error: 'No record found' });

    const me = String(req.user._id);
    let allowed = req.user.role === 'admin' || String(record.buyerId) === me;

    if (!allowed) {
      const listing = await Listing.findById(record.listingId).select('seller').lean();
      allowed = !!listing && String(listing.seller) === me;
    }

    if (!allowed) return res.status(404).json({ error: 'No record found' });

    record = await syncPending(record);
    res.json(shapePayment(record));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/payments/listing/:listingId/mine
// The buyer's open payment for a listing (waiting or paid), so the page can show the right button after a reload
async function getMyPaymentForListing(req, res) {
  try {
    const listingId = String(req.params.listingId);
    if (!/^[a-f\d]{24}$/i.test(listingId)) return res.json({ payment: null });

    await paymentStore.failStalePending(listingId, STALE_PENDING_MS);
    let record = await paymentStore.getLatestByBuyerAndListing(listingId, String(req.user._id));
    if (!record) return res.json({ payment: null });

    record = await syncPending(record);
    if (record.status !== 'pending' && record.status !== 'held') return res.json({ payment: null });

    res.json({ payment: shapePayment(record) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/payments/cancel/:checkoutRequestId
// The buyer stops waiting for a prompt they missed. We ask Safaricom first, so a payment that
// already went through is never cancelled.
async function cancelPayment(req, res) {
  try {
    const id = String(req.params.checkoutRequestId);
    let record = await paymentStore.getByCheckoutId(id);
    if (!record || String(record.buyerId) !== String(req.user._id)) {
      return res.status(404).json({ error: 'No record found' });
    }
    if (record.status !== 'pending') return res.json(shapePayment(record)); // already settled: show the real state

    const waited = (Date.now() - new Date(record.createdAt).getTime()) / 1000;
    if (waited < CANCEL_AFTER_SECONDS) {
      return res.status(409).json({
        error: `Please wait ${Math.ceil(CANCEL_AFTER_SECONDS - waited)} more seconds before cancelling.`,
      });
    }

    lastQueryAt.delete(id);
    const q = await queryStkStatus(id);
    if (q.state === 'success' || q.state === 'failed') {
      await applyStkResult({
        checkoutRequestId: id,
        resultCode: q.resultCode,
        resultDesc: q.resultDesc,
        fromQuery: true,
      });
      record = await paymentStore.getByCheckoutId(id);
      return res.json(shapePayment(record));
    }
    if (q.state === 'unknown') {
      return res.status(503).json({
        error: "We couldn't check with M-Pesa right now. Try again in a moment.",
      });
    }

    // Safaricom says the customer never answered: safe to close it
    await paymentStore.cancelPending(id);
    record = await paymentStore.getByCheckoutId(id);
    res.json({ ...shapePayment(record), cancelled: true });
  } catch (err) {
    console.error('Cancel payment failed:', (err.response && err.response.data) || err.message);
    res.status(500).json({ error: 'Could not cancel. Try again in a moment.' });
  }
}

// GET /api/payments/mine
async function getMyPurchases(req, res) {
  try {
    const payments = await Payment.find({ buyer: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({
        path: 'listing',
        select: 'title photos status meetupSafeZone meetupConfirmed seller',
        populate: { path: 'seller', select: 'fullName' },
      })
      .lean();

    res.json({
      purchases: payments.map((p) => ({
        _id: p._id,
        status: p.status,
        amount: p.amount != null ? p.amount : null,
        askingPrice: p.askingPrice != null ? p.askingPrice : null,
        mpesaReceipt: p.mpesaReceipt || '',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        listing: p.listing
          ? {
              _id: p.listing._id,
              title: p.listing.title,
              photo: p.listing.photos && p.listing.photos[0],
              status: p.listing.status,
              meetupSafeZone: p.listing.meetupSafeZone || '',
              sellerName: p.listing.seller ? p.listing.seller.fullName : '',
            }
          : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  initiatePayment,
  handleCallback,
  getPaymentStatus,
  getMyPaymentForListing,
  cancelPayment,
  getMyPurchases,
};