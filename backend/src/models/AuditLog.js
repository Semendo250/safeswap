const mongoose = require('mongoose');

// One row per admin action (bans, deletions, payment status changes, ...)
const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String },
    action: { type: String, required: true }, // e.g. 'payment.status', 'user.ban'
    targetType: { type: String }, // 'user' | 'listing' | 'payment'
    targetId: { type: String },
    summary: { type: String },
    reason: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);