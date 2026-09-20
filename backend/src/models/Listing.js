const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true },
    category: { type: String, enum: ['phone', 'general'], required: true },

    photos: [{ type: String }], // Cloudinary URLs, at least 1 required for both categories

    // Phone-only fields (validated conditionally in the controller, not required at schema level
    // for 'general' category)
    imei: { type: String, trim: true },
    imeiStatus: {
      type: String,
      enum: ['unchecked', 'clean', 'flagged', 'blacklisted'],
      default: 'unchecked',
    },
    proofPhoto: { type: String }, // phone next to student ID, phone category only

    status: {
      type: String,
      enum: ['active', 'under_review', 'removed', 'sold'],
      default: 'active',
    },
    reportCount: { type: Number, default: 0 },

    // Handover
    meetupSafeZone: { type: String },
    meetupConfirmed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Listing', listingSchema);
