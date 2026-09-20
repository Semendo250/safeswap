const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  signup,
  verifyOtpHandler,
  login,
  getMe,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');

router.get('/me', authMiddleware, getMe);

router.post('/signup', signup);
router.post('/verify-otp', verifyOtpHandler);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;