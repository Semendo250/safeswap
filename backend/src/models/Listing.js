const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true },
    category: { type: String, enum: ['phone', 'general'], required: true },

    photos: [{ type: String }],

    imei: { type: String, trim: true },
    imeiStatus: {
      type: String,
      enum: ['unchecked', 'clean', 'flagged', 'blacklisted'],
      default: 'unchecked',
    },
    proofPhoto: { type: String },

    status: {
      type: String,
      enum: ['active', 'under_review', 'removed', 'sold', 'unavailable', 'expired'],
      default: 'active',
    },
    unavailableReason: { type: String, enum: ['sold_elsewhere', 'other'] },
    renewedAt: { type: Date },
    expiryWarned: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },

    meetupSafeZone: { type: String },
    meetupConfirmed: { type: Boolean, default: false },

    paymentLockUntil: { type: Date },
    paymentLockBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Listing', listingSchema);