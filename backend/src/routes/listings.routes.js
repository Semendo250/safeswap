const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const listingsCtrl = require('../controllers/listings.controller');

// Public: anyone can browse listings without logging in
router.get('/', listingsCtrl.getListings);
router.get('/mine', authMiddleware, listingsCtrl.getMyListings);
router.get('/:id', listingsCtrl.getListingById);

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