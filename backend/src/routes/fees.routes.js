const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { getFeeTable } = require('../controllers/fees.controller');

router.get('/', authMiddleware, getFeeTable);

module.exports = router;