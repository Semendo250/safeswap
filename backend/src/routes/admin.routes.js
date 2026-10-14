const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const ctrl = require('../controllers/admin.controller');
const stats = require('../controllers/adminStats.controller');
const fraud = require('../controllers/adminFraud.controller');
const comms = require('../controllers/adminComms.controller');
const exp = require('../controllers/adminExport.controller');
const zones = require('../controllers/safeZones.controller');
const audit = require('../controllers/adminAudit.controller');
const payAdmin = require('../controllers/adminPayments.controller');

router.use(authMiddleware, adminMiddleware); // every admin route requires admin role

router.get('/overview', ctrl.getOverview);
router.get('/needs-attention', stats.getNeedsAttention);
router.get('/money-overview', stats.getMoneyOverview);
router.get('/trends', stats.getTrends);

router.get('/users', ctrl.getUsers);
router.get('/users/:id', ctrl.getUserById);
router.patch('/users/:id/ban', ctrl.setUserBan);
router.patch('/users/:id/verify', ctrl.verifyUserEmail);
router.delete('/users/:id', ctrl.deleteUser);

router.get('/flagged-listings', ctrl.getFlaggedListings);
router.get('/listings', ctrl.getAllListings);
router.patch('/listings/:id/approve', ctrl.approveListing);
router.patch('/listings/:id/remove', ctrl.removeListing);
router.post('/risk-signals', fraud.getRiskSignals);

router.get('/verification-queue', ctrl.getVerificationQueue);
router.patch('/verification/:userId/approve', ctrl.approveFallbackVerification);
router.patch('/verification/:userId/reject', ctrl.rejectFallbackVerification);

router.get('/blacklist', fraud.getBlacklist);
router.post('/blacklist', fraud.addBlacklistImei);
router.post('/blacklist/bulk', fraud.bulkAddBlacklist);
router.delete('/blacklist/:id', fraud.removeBlacklistImei);

router.get('/payments', ctrl.getPayments);
router.patch('/payments/:id/status', ctrl.updatePaymentStatus);
router.get('/payments/stale-count', payAdmin.getStaleCount);
router.post('/payments/expire-stale', payAdmin.expireStale);

router.get('/export/payments.csv', exp.exportPayments);
router.get('/export/users.csv', exp.exportUsers);

router.get('/safe-zones', zones.adminList);
router.post('/safe-zones', zones.adminCreate);
router.patch('/safe-zones/:id', zones.adminUpdate);
router.delete('/safe-zones/:id', zones.adminDelete);

router.get('/announcements', comms.getAnnouncements);
router.post('/announcements', comms.sendAnnouncement);
router.delete('/announcements/:id', comms.deleteAnnouncement);

router.get('/admin-list', comms.getAdminList);
router.get('/disputes', comms.getDisputes);
router.post('/disputes', comms.createDispute);
router.patch('/disputes/:id', comms.updateDispute);
router.delete('/disputes/:id', comms.deleteDispute);
router.post('/disputes/:id/notes', comms.addDisputeNote);
router.post('/disputes/:id/reply', comms.replyToDispute);
router.post('/users/:id/message', comms.messageUser);

router.get('/audit-log', audit.getAuditLog);

module.exports = router;