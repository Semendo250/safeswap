const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favorites.controller');

router.use(authMiddleware);

router.get('/', getFavorites);
router.post('/:listingId', addFavorite);
router.delete('/:listingId', removeFavorite);

module.exports = router;