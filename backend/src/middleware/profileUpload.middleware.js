const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'safeswap-profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Profile picture must be a JPG, PNG or WebP image'));
  },
});

const single = upload.single('profilePicture');

// Wrapped so upload problems come back as JSON, not an HTML error page.
// JSON requests with no file pass straight through.
function uploadProfilePicture(req, res, next) {
  single(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Profile picture must be 5 MB or smaller'
        : err.message || 'Could not upload the picture';
    res.status(400).json({ error: message });
  });
}

module.exports = uploadProfilePicture;