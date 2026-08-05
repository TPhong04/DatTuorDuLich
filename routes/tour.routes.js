const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.get('/search', requireAuth, tourController.searchTours);

module.exports = router;