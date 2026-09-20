const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { generateOtp, storeOtp, verifyOtp, sendOtpEmail, isUniversityEmail } = require('../utils/otp');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/signup
async function signup(req, res) {
  try {
    const { fullName, studentRegNo, email, password, phone } = req.body;

    if (!fullName || !studentRegNo || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationPath = isUniversityEmail(email) ? 'university_email' : 'fallback';

    const user = await User.create({
      fullName,
      studentRegNo,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      verificationPath,
    });

    const otp = generateOtp();
    await storeOtp(user.email, otp);
    await sendOtpEmail(user.email, otp);

    res.status(201).json({
      message: 'Signup successful. Check your email for a verification code.',
      verificationPath,
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/verify-otp
async function verifyOtpHandler(req, res) {
  try {
    const { email, otp } = req.body;
    const isValid = await verifyOtp(email.toLowerCase(), otp);
    if (!isValid) return res.status(400).json({ error: 'Invalid or expired code' });

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { emailVerified: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = signToken(user._id);
    res.json({
      message: 'Email verified',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        verificationPath: user.verificationPath,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found for this email' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email already verified' });

    const otp = generateOtp();
    await storeOtp(user.email, otp);
    await sendOtpEmail(user.email, otp);

    res.json({ message: 'A new code has been sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'No account found with this email' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }
    if (user.isBanned) return res.status(403).json({ error: 'Account banned' });

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        trustScore: user.trustScore,
        verificationPath: user.verificationPath,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  res.json({
    id: req.user._id,
    fullName: req.user.fullName,
    email: req.user.email,
    role: req.user.role,
    trustScore: req.user.trustScore,
    verificationPath: req.user.verificationPath,
  });
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      const token = generateOtp();
      await PasswordResetToken.deleteMany({ email: user.email });
      await PasswordResetToken.create({ email: user.email, token });
      await sendOtpEmail(user.email, token);
    }

    res.json({ message: 'If an account exists for this email, a reset code has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character',
      });
    }

    const record = await PasswordResetToken.findOne({ email: email.toLowerCase(), token });
    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { password: hashedPassword },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    await PasswordResetToken.deleteOne({ _id: record._id });

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { signup, verifyOtpHandler, login, getMe, resendOtp, forgotPassword, resetPassword };