const mongoose = require('mongoose');

// NOTE: This is a simulated blacklist for demo/academic purposes.
// A production version would integrate with Kenya's Communications Authority
// stolen-device registry via a formal API partnership.
const blacklistImeiSchema = new mongoose.Schema(
  {
    imei: { type: String, required: true, unique: true, trim: true },
    reportedDate: { type: Date, default: Date.now },
    source: { type: String, default: 'simulated' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who added it
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlacklistIMEI', blacklistImeiSchema);
