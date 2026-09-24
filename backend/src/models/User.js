const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    studentRegNo: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true, maxlength: 100 },
    profilePicture: { type: String }, // Cloudinary URL

    // Verification
    verificationPath: {
      type: String,
      enum: ['university_email', 'fallback'],
      default: 'university_email',
    },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    fallbackIdPhoto: { type: String }, // Cloudinary URL, only used on fallback path
    fallbackApproved: { type: Boolean, default: false }, // admin approves fallback accounts
    fallbackRejected: { type: Boolean, default: false }, // admin rejected the ID

    // Trust
    trustScore: { type: Number, default: 50 },
    completedSales: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },

    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);