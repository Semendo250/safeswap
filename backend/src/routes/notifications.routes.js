const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notifications.controller');

router.use(authMiddleware); // every notification route requires a logged-in user

router.get('/', ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.patch('/:id/read', ctrl.markOneRead);
router.patch('/read-all', ctrl.markAllRead);
router.post('/token', ctrl.registerToken);
router.delete('/token', ctrl.removeToken);

module.exports = router;