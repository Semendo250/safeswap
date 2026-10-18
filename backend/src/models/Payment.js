const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    checkoutRequestId: { type: String, required: true, unique: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number },
    askingPrice: { type: Number },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    phone: { type: String },
    mpesaReceipt: { type: String },
    status: {
      type: String,
      enum: ['pending', 'held', 'released', 'failed', 'refunded'],
      default: 'pending',
    },
    needsReview: { type: Boolean, default: false },
    reviewNote: { type: String },
  },
  { timestamps: true }
);

paymentSchema.index({ listing: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ needsReview: 1 });

module.exports = mongoose.model('Payment', paymentSchema);