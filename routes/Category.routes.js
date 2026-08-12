const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

router.get('/categories', categoryController.showCategoryPage);
router.post('/categories', categoryController.submitCategory);
router.get('/api/categories', categoryController.listCategoriesJson);

module.exports = router;