const mongoose = require('mongoose');

// Powers the bell: one row per notification, shown in the dropdown and counted
// for the unread badge, independent of whether the push itself was delivered.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'verification_approved',
        'verification_rejected',
        'listing_approved',
        'listing_rejected',
        'payment_status',
        'new_message',
        'new_listing_review', // admin-only: a new listing needs attention
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String },
    // Where tapping the notification should take the user, e.g. /listings/123 or /chat/123
    link: { type: String },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);