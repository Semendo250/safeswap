const mongoose = require('mongoose');

// One record per M-Pesa payment attempt. Stored in MongoDB so held payments
// survive server restarts and sleeping free hosts.
const paymentSchema = new mongoose.Schema(
  {
    checkoutRequestId: { type: String, required: true, unique: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number },
    phone: { type: String }, // number the buyer paid from
    mpesaReceipt: { type: String }, // e.g. NLJ7RT61SV, filled in by the M-Pesa callback
    status: {
      type: String,
      enum: ['pending', 'held', 'released', 'failed', 'refunded'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

paymentSchema.index({ listing: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);