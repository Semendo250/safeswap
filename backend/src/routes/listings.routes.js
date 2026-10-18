const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const optionalAuth = require('../middleware/optionalAuth.middleware');
const upload = require('../middleware/upload.middleware');
const listingsCtrl = require('../controllers/listings.controller');
const safeZonesCtrl = require('../controllers/safeZones.controller');

router.get('/', optionalAuth, listingsCtrl.getListings);
router.get('/mine', authMiddleware, listingsCtrl.getMyListings);
router.get('/safe-zones', safeZonesCtrl.getPublicZones);
router.get('/:id', optionalAuth, listingsCtrl.getListingById);

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
router.patch('/:id/availability', authMiddleware, listingsCtrl.setAvailability);
router.post('/:id/renew', authMiddleware, listingsCtrl.renewListing);
router.patch('/:id/meetup', authMiddleware, listingsCtrl.setMeetup);
router.patch('/:id/meetup/confirm', authMiddleware, listingsCtrl.confirmMeetup);

module.exports = router;