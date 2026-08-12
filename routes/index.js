const express = require('express');
const router = express.Router();
 
router.use('/', require('./page.routes'));
router.use('/', require('./auth.routes'));
router.use('/', require('./tour.routes'));
router.use('/', require('./contact.routes'));
 
module.exports = router;