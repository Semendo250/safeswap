const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { createReport, getAllReports } = require('../controllers/reports.controller');

router.post('/', authMiddleware, createReport);
router.get('/', authMiddleware, adminMiddleware, getAllReports);

module.exports = router;