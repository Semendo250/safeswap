const mongoose = require('mongoose');

// One row per (user, device/browser). A user can have several if logged in
// on more than one device; each gets its own push token from Firebase.
const fcmTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    userAgent: { type: String },
  },
  { timestamps: true }
);

fcmTokenSchema.index({ user: 1 });

module.exports = mongoose.model('FcmToken', fcmTokenSchema);