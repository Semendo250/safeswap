const { initiateStkPush } = require('../utils/mpesa');
const Listing = require('../models/Listing');
const paymentStore = require('../utils/paymentStore');

// POST /api/payments/stk-push
async function initiatePayment(req, res) {
  try {
    const { listingId, phone } = req.body;
    if (!listingId || !phone) {
      return res.status(400).json({ error: 'listingId and phone are required' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const result = await initiateStkPush({
      phone,
      amount: listing.price,
      accountReference: listing._id.toString(),
      transactionDesc: `SafeSwap: ${listing.title}`,
    });

    paymentStore.createPending(result.CheckoutRequestID, {
      listingId: listing._id.toString(),
      buyerId: req.user._id.toString(),
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
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ error: 'Invalid callback payload' });

    const { CheckoutRequestID, ResultCode } = callback;
    paymentStore.updateStatusByCheckoutId(
      CheckoutRequestID,
      ResultCode === 0 ? 'held' : 'failed'
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
  const record = paymentStore.getByCheckoutId(req.params.checkoutRequestId);
  if (!record) return res.status(404).json({ error: 'No record found' });
  res.json(record);
}

module.exports = { initiatePayment, handleCallback, getPaymentStatus };