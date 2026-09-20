const nodemailer = require('nodemailer');
const Otp = require('../models/Otp');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

async function storeOtp(email, otp) {
  // Remove any existing unexpired code for this email first, so only the
  // latest one is valid
  await Otp.deleteMany({ email: email.toLowerCase() });
  await Otp.create({ email: email.toLowerCase(), code: otp });
}

async function verifyOtp(email, submittedOtp) {
  const record = await Otp.findOne({ email: email.toLowerCase(), code: submittedOtp });
  if (!record) return false;
  await Otp.deleteOne({ _id: record._id }); // one-time use
  return true;
}

async function sendOtpEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `SafeSwap <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your SafeSwap verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
}

function isUniversityEmail(email) {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN || 'maseno.ac.ke';
  return email.toLowerCase().endsWith(`@${domain}`);
}

module.exports = { generateOtp, storeOtp, verifyOtp, sendOtpEmail, isUniversityEmail };