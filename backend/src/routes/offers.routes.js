const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { createOffer, acceptOffer, declineOffer, counterOffer } = require('../controllers/offers.controller');

router.use(authMiddleware);

router.post('/:listingId', createOffer);
router.post('/:offerId/accept', acceptOffer);
router.post('/:offerId/decline', declineOffer);
router.post('/:offerId/counter', counterOffer);

module.exports = router;