const mongoose = require('mongoose');

// A meetup spot buyers and sellers can pick. Admins manage these from the dashboard.
const safeZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60, unique: true },
    active: { type: Boolean, default: true }, // hidden zones stay on old listings but can't be picked
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SafeZone', safeZoneSchema);