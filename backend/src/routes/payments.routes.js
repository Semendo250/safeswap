const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { initiatePayment, handleCallback, getPaymentStatus } = require('../controllers/payments.controller');

router.post('/stk-push', authMiddleware, initiatePayment);
router.post('/callback', handleCallback); // no auth - Safaricom calls this directly
router.get('/status/:checkoutRequestId', authMiddleware, getPaymentStatus);

module.exports = router;