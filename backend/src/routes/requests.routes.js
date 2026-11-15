const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/requests.controller');

router.get('/', authMiddleware, ctrl.getRequests);
router.get('/mine', authMiddleware, ctrl.getMyRequests);
router.get('/:id', authMiddleware, ctrl.getRequestById);
router.post('/', authMiddleware, ctrl.createRequest);
router.post('/:id/respond', authMiddleware, ctrl.respond);
router.patch('/:id/status', authMiddleware, ctrl.setStatus);

module.exports = router;