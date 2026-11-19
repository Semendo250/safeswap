const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedForEveryone: { type: Boolean, default: false },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'offer'], default: 'text' },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// Indexes for the chat thread, the inbox and the unread counts
messageSchema.index({ listing: 1, sender: 1, receiver: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, read: 1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);