const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: ['suspected_stolen', 'price_suspicious', 'fake_listing', 'other'],
      required: true,
    },
    details: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'reviewed_upheld', 'reviewed_dismissed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
