const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    askingPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'replaced', 'expired', 'closed', 'paid'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

offerSchema.index({ listing: 1, buyer: 1, status: 1 });
offerSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Offer', offerSchema);