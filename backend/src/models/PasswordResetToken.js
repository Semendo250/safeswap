const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 900 }, // 15 minutes
});

module.exports = mongoose.model('PasswordResetToken', resetTokenSchema);