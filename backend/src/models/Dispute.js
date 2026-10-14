const mongoose = require('mongoose');

// Private admin notes. Students never see these.
const noteSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Conversation messages. Both the student and the admins can see these.
const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['student', 'admin'], required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A complaint or conversation. Logged by an admin (WhatsApp, email), sent by a student in the
// app, or started by an admin from the Users page.
const disputeSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true, unique: true }, // short code like D-7K3QX
    source: { type: String, enum: ['whatsapp', 'email', 'in_app', 'other', 'admin'], required: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, trim: true, maxlength: 2000 },
    contactName: { type: String, trim: true, maxlength: 80 },
    contactInfo: { type: String, trim: true, maxlength: 120 }, // phone or email
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // linked account, if known
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: [noteSchema],
    messages: [messageSchema],
    lastMessageAt: { type: Date },
    lastMessageFrom: { type: String, enum: ['student', 'admin'] },
    resolution: { type: String, trim: true, maxlength: 500 },
    resolvedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ assignedTo: 1 });
disputeSchema.index({ user: 1, updatedAt: -1 });

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newRef() {
  let s = '';
  for (let i = 0; i < 5; i += 1) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `D-${s}`;
}

// Creates a dispute with a unique short reference code (retries on the rare clash)
disputeSchema.statics.createWithRef = async function createWithRef(data) {
  for (let i = 0; i < 5; i += 1) {
    try {
      return await this.create({ ...data, ref: newRef() });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('Could not generate a reference code. Try again.');
};

module.exports = mongoose.model('Dispute', disputeSchema);