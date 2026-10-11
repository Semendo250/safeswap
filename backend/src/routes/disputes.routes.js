const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/disputes.controller');

router.use(authMiddleware);

router.post('/', ctrl.submitDispute);

module.exports = router;