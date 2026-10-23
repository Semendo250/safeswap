const express = require('express');
const router = express.Router();
const { handleResult, handleTimeout } = require('../controllers/b2c.controller');

// Called by Safaricom, so there is no login. The secret token in the address protects them.
router.post('/result', handleResult);
router.post('/timeout', handleTimeout);

module.exports = router;