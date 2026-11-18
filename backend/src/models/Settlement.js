const mongoose = require('mongoose');

// One M-Pesa send-confirmation saved against a payout or refund
const receiptSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true },
  amount: { type: Number, required: true, min: 0 },
  phone: { type: String }, // recipient number from the SMS (2547...), empty when the SMS had none
  recipientName: { type: String, trim: true },
  paidAtSms: { type: Date }, // payment time from the SMS
  cost: { type: Number, default: 0, min: 0 }, // M-Pesa transaction cost
  rawText: { type: String, maxlength: 2000 }, // the pasted SMS, kept as proof
  manual: { type: Boolean, default: false }, // fields typed by hand
  partial: { type: Boolean, default: false }, // admin confirmed this is a part payment
  phoneConfirmed: { type: Boolean, default: false }, // SMS had no number; admin confirmed the recipient
  overridden: { type: Boolean, default: false },
  overrideReason: { type: String, trim: true, maxlength: 300 },
  failedChecks: [{ type: String }],
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedByName: { type: String },
  addedAt: { type: Date, default: Date.now },
});

// One row per payment that has left "held":
//   payout = payment was released, so the seller is owed their share (sale minus our fee)
//   refund = payment was refunded, so the buyer is owed the full amount back
// Changing a payment's status never moves money, so this row tracks whether the money
// was actually sent, with one receipt (M-Pesa confirmation SMS) per send.
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
    reference: { type: String, trim: true }, // legacy single confirmation code (older rows)
    receipts: { type: [receiptSchema], default: undefined },
    paidTotal: { type: Number, default: 0 }, // sum of the receipts
    note: { type: String, trim: true, maxlength: 300 },

    eventAt: { type: Date, required: true }, // when the payment was released or refunded
    paidAt: { type: Date }, // set when the receipts add up to the full amount
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidByName: { type: String },
    // How a paid row was sent: through M-Pesa from the Finance page, or by hand
    via: { type: String, enum: ['mpesa', 'manual'] },

    // Automatic M-Pesa sending. Used once someone presses "Send now".
    transfer: {
      state: { type: String, enum: ['sending', 'failed'] },
      attempts: { type: Number, default: 0 },
      amount: { type: Number },
      phone: { type: String },
      conversationId: { type: String },
      originatorConversationId: { type: String },
      message: { type: String },
      initiatedAt: { type: Date },
      initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      initiatedByName: { type: String },
    },
  },
  { timestamps: true }
);

settlementSchema.index({ status: 1, type: 1, eventAt: 1 });
settlementSchema.index({ seller: 1, status: 1 });
settlementSchema.index({ paidAt: -1 });
settlementSchema.index({ reference: 1 }, { unique: true, sparse: true });
// A receipt code can only ever be saved once. Partial index so rows with no receipts don't collide.
settlementSchema.index(
  { 'receipts.code': 1 },
  { unique: true, partialFilterExpression: { 'receipts.code': { $exists: true } } }
);

module.exports = mongoose.model('Settlement', settlementSchema);