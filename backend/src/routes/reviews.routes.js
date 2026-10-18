const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { getMyReviewStatus, createReview, getSellerReviews } = require('../controllers/reviews.controller');

router.get('/seller/:sellerId', getSellerReviews);
router.get('/listing/:listingId/mine', authMiddleware, getMyReviewStatus);
router.post('/:listingId', authMiddleware, createReview);

module.exports = router;