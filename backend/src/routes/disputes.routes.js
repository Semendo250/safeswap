const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/disputes.controller');

router.use(authMiddleware);

router.post('/', ctrl.submitDispute);
router.get('/mine', ctrl.getMine); // must stay above '/:id'
router.get('/:id', ctrl.getOne);
router.post('/:id/messages', ctrl.addMessage);

module.exports = router;