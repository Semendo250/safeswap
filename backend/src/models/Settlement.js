const mongoose = require('mongoose');

// One row per payment that has left "held":
//   payout = payment was released, so the seller is owed their share (sale minus our fee)
//   refund = payment was refunded, so the buyer is owed the full amount back
// Changing a payment's status never moves money, so this row tracks whether the money
// was actually sent (and the M-Pesa confirmation code for it).
const settlementSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    type: { type: String, enum: ['payout', 'refund'], required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
        category: { type: String }, // 'phone' or 'general', copied from the listing when the row is created
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    gross: { type: Number, required: true, min: 0 }, // what the buyer paid
    feePercent: { type: Number, default: 0 }, // fee rate used for this row (kept even if the rate changes later)
    fee: { type: Number, default: 0 }, // our fee in KES (always 0 for refunds)
    net: { type: Number, required: true, min: 0 }, // what has to be sent out

    status: { type: String, enum: ['due', 'paid'], default: 'due' },
    reference: { type: String, trim: true }, // M-Pesa confirmation code of the money sent out
    note: { type: String, trim: true, maxlength: 300 },

    eventAt: { type: Date, required: true }, // when the payment was released or refunded
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidByName: { type: String },
  },
  { timestamps: true }
);

settlementSchema.index({ status: 1, type: 1, eventAt: 1 });
settlementSchema.index({ seller: 1, status: 1 });
settlementSchema.index({ paidAt: -1 });
settlementSchema.index({ reference: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Settlement', settlementSchema);