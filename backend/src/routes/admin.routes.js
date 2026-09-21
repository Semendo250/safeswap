const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const ctrl = require('../controllers/admin.controller');

router.use(authMiddleware, adminMiddleware); // every admin route requires admin role

router.get('/overview', ctrl.getOverview);

router.get('/users', ctrl.getUsers);
router.get('/users/:id', ctrl.getUserById);
router.patch('/users/:id/ban', ctrl.setUserBan);
router.patch('/users/:id/verify', ctrl.verifyUserEmail);
router.delete('/users/:id', ctrl.deleteUser);

router.get('/flagged-listings', ctrl.getFlaggedListings);
router.get('/listings', ctrl.getAllListings);
router.patch('/listings/:id/approve', ctrl.approveListing);
router.patch('/listings/:id/remove', ctrl.removeListing);

router.get('/verification-queue', ctrl.getVerificationQueue);
router.patch('/verification/:userId/approve', ctrl.approveFallbackVerification);
router.patch('/verification/:userId/reject', ctrl.rejectFallbackVerification);

router.get('/blacklist', ctrl.getBlacklist);
router.post('/blacklist', ctrl.addBlacklistImei);
router.delete('/blacklist/:id', ctrl.removeBlacklistImei);

router.get('/payments', ctrl.getPayments);
router.patch('/payments/:id/status', ctrl.updatePaymentStatus);

router.get('/audit-log', ctrl.getAuditLog);

module.exports = router;