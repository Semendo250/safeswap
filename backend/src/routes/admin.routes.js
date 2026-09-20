const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const ctrl = require('../controllers/admin.controller');

router.use(authMiddleware, adminMiddleware); // every admin route requires admin role

router.get('/overview', ctrl.getOverview);

router.get('/flagged-listings', ctrl.getFlaggedListings);
router.patch('/listings/:id/approve', ctrl.approveListing);
router.patch('/listings/:id/remove', ctrl.removeListing);

router.get('/verification-queue', ctrl.getVerificationQueue);
router.patch('/verification/:userId/approve', ctrl.approveFallbackVerification);

router.get('/blacklist', ctrl.getBlacklist);
router.post('/blacklist', ctrl.addBlacklistImei);
router.delete('/blacklist/:id', ctrl.removeBlacklistImei);

module.exports = router;