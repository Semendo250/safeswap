const mongoose = require('mongoose');

// A record of every broadcast an admin has sent to all users
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 300 },
    link: { type: String, trim: true, maxlength: 200 },
    recipientCount: { type: Number, default: 0 },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sentByName: { type: String },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);