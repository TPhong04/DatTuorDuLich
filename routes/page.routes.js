const express = require('express');
const router = express.Router();
const pageController = require('../controllers/page.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.get('/', pageController.showEntry);
router.get('/home', requireAuth, pageController.showHome);
router.get('/tours', requireAuth, pageController.showTours);
router.get('/about', pageController.showAbout);

module.exports = router;