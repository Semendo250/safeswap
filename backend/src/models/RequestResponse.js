const mongoose = require('mongoose');

const requestResponseSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyRequest', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// The same listing can only be offered once for a request
requestResponseSchema.index({ request: 1, listing: 1 }, { unique: true });
requestResponseSchema.index({ request: 1, createdAt: -1 });
requestResponseSchema.index({ seller: 1, request: 1 });

module.exports = mongoose.model('RequestResponse', requestResponseSchema);