const mongoose = require('mongoose');

const buyRequestSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    category: { type: String, enum: ['phone', 'general'], required: true },
    budget: { type: Number, required: true },
    // The main words of the title in alphabetical order, used to group "most requested" items
    keyword: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ['open', 'fulfilled', 'closed', 'removed'], default: 'open' },
    expiresAt: { type: Date, required: true },
    responseCount: { type: Number, default: 0 },
    removedReason: { type: String },
  },
  { timestamps: true }
);

buyRequestSchema.index({ status: 1, expiresAt: 1, createdAt: -1 });
buyRequestSchema.index({ buyer: 1, createdAt: -1 });
buyRequestSchema.index({ keyword: 1, createdAt: -1 });

module.exports = mongoose.model('BuyRequest', buyRequestSchema);