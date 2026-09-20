const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { getConversation, sendMessage, markAsRead, getConversations, deleteMessage } = require('../controllers/chat.controller');

router.use(authMiddleware); // every chat route requires a logged-in user

router.get('/', getConversations);
router.get('/:listingId', getConversation);
router.post('/:listingId', sendMessage);
router.patch('/:messageId/read', markAsRead);
router.delete('/message/:messageId', deleteMessage);

module.exports = router;