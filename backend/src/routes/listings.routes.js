const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const optionalAuth = require('../middleware/optionalAuth.middleware');
const upload = require('../middleware/upload.middleware');
const listingsCtrl = require('../controllers/listings.controller');

// Public: anyone can browse listings without logging in
router.get('/', listingsCtrl.getListings);
router.get('/mine', authMiddleware, listingsCtrl.getMyListings);
// Public, but if a valid token is sent we know who is asking (used to show the seller's phone)
router.get('/:id', optionalAuth, listingsCtrl.getListingById);

// Protected: must be logged in to create/edit/delete
router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'proofPhoto', maxCount: 1 },
  ]),
  listingsCtrl.createListing
);
router.patch('/:id', authMiddleware, listingsCtrl.updateListing);
router.delete('/:id', authMiddleware, listingsCtrl.deleteListing);
router.patch('/:id/meetup', authMiddleware, listingsCtrl.setMeetup);
router.patch('/:id/meetup/confirm', authMiddleware, listingsCtrl.confirmMeetup);

module.exports = router;