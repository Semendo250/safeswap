const mongoose = require('mongoose');

// One record per M-Pesa payment attempt. Replaces the in-memory store,
// so held payments survive server restarts and sleeping free hosts.
const paymentSchema = new mongoose.Schema(
  {
    checkoutRequestId: { type: String, required: true, unique: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'held', 'released', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

paymentSchema.index({ listing: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);