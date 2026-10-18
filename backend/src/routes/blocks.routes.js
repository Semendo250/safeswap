const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { blockUser, unblockUser, getBlockStatus } = require('../controllers/blocks.controller');

router.use(authMiddleware);

router.get('/status/:userId', getBlockStatus);
router.post('/:userId', blockUser);
router.delete('/:userId', unblockUser);

module.exports = router;