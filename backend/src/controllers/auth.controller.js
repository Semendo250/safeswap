const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const cloudinary = require('../config/cloudinary');
const { normalizeKenyanPhone } = require('../utils/phone');
const { generateOtp, storeOtp, verifyOtp, sendOtpEmail, isUniversityEmail } = require('../utils/otp');

const PHONE_ERROR = 'Enter a valid Kenyan phone number, e.g. 0712 345 678';

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// One consistent user shape for login, verify-otp, /me and profile updates
function publicUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    trustScore: user.trustScore,
    verificationPath: user.verificationPath,
    emailVerified: user.emailVerified,
    phone: user.phone || '',
    location: user.location || '',
    profilePicture: user.profilePicture || '',
  };
}

// If a request fails after its picture was already uploaded, remove the orphan
async function discardUpload(file) {
  if (!file?.filename) return;
  try {
    await cloudinary.uploader.destroy(file.filename);
  } catch (err) {
    // best effort only
  }
}

// Only ever deletes images inside our own profile-picture folder
function publicIdFromUrl(url) {
  const m = /\/upload\/(?:v\d+\/)?(safeswap-profiles\/[^.]+)\.[A-Za-z0-9]+$/.exec(url || '');
  return m ? m[1] : null;
}

// POST /api/auth/signup  (JSON, or multipart when a profile picture is attached)
async function signup(req, res) {
  try {
    const { fullName, studentRegNo, email, password } = req.body;
    const rawPhone = (req.body.phone || '').trim();

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    let error = null;
    let status = 400;

    if (!fullName || !studentRegNo || !email || !password) {
      error = 'Missing required fields';
    } else if (!passwordRegex.test(password)) {
      error =
        'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';
    } else if (rawPhone && !normalizeKenyanPhone(rawPhone)) {
      error = PHONE_ERROR;
    } else {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        error = 'Email already registered';
        status = 409;
      }
    }

    if (error) {
      await discardUpload(req.file);
      return res.status(status).json({ error });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationPath = isUniversityEmail(email) ? 'university_email' : 'fallback';

    const user = await User.create({
      fullName,
      studentRegNo,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: rawPhone ? normalizeKenyanPhone(rawPhone) : undefined,
      profilePicture: req.file ? req.file.path : undefined,
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
    await discardUpload(req.file);
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
      user: publicUser(user),
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
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  res.json(publicUser(req.user));
}

// PATCH /api/auth/me  (multipart: phone, location, optional profilePicture)
async function updateProfile(req, res) {
  try {
    const updates = {};
    const { phone, location } = req.body;

    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed === '') {
        updates.phone = ''; // clearing the number is allowed
      } else {
        const normalized = normalizeKenyanPhone(trimmed);
        if (!normalized) {
          await discardUpload(req.file);
          return res.status(400).json({ error: PHONE_ERROR });
        }
        updates.phone = normalized;
      }
    }

    if (location !== undefined) {
      const trimmed = String(location).trim();
      if (trimmed.length > 100) {
        await discardUpload(req.file);
        return res.status(400).json({ error: 'Location must be 100 characters or fewer' });
      }
      updates.location = trimmed;
    }

    const oldPicture = req.user.profilePicture;
    if (req.file) updates.profilePicture = req.file.path;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    // Replace the old picture so Cloudinary doesn't fill up with unused images
    if (req.file && oldPicture) {
      const oldId = publicIdFromUrl(oldPicture);
      if (oldId) {
        try {
          await cloudinary.uploader.destroy(oldId);
        } catch (err) {
          // best effort only
        }
      }
    }

    res.json(publicUser(user));
  } catch (err) {
    await discardUpload(req.file);
    res.status(500).json({ error: err.message });
  }
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

module.exports = {
  signup,
  verifyOtpHandler,
  login,
  getMe,
  updateProfile,
  resendOtp,
  forgotPassword,
  resetPassword,
};