const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const uploadProfilePicture = require('../middleware/profileUpload.middleware');
const {
  signup,
  verifyOtpHandler,
  login,
  getMe,
  updateProfile,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');

router.get('/me', authMiddleware, getMe);
// auth runs first, so logged-out users can't upload anything here
router.patch('/me', authMiddleware, uploadProfilePicture, updateProfile);

router.post('/signup', uploadProfilePicture, signup);
router.post('/verify-otp', verifyOtpHandler);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;