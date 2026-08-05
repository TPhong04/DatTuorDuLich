const { getCategoryTree, getAllMainCategories, createCategory } = require('../services/category.service');

// GET /categories -> hiển thị danh sách category hiện có + form thêm mới
async function showCategoryPage(req, res) {
  try {
    const categories = await getCategoryTree();
    const mainCategories = await getAllMainCategories();

    res.render('categories', {
      title: 'Quản lý Category',
      categories,
      mainCategories
    });
  } catch (err) {
    console.error('Lỗi lấy category:', err.message);
    res.render('categories', {
      title: 'Quản lý Category',
      categories: [],
      mainCategories: [],
      error: 'Không tải được danh sách category.'
    });
  }
}

// POST /categories -> tạo 1 vùng/khu vực mới, luôn thuộc 1 trong 2 loại chính (Trong nước/Nước ngoài)
async function submitCategory(req, res) {
  const { name, parent } = req.body;

  try {
    await createCategory({ name, type: 'region', parent });
    res.redirect('/categories');
  } catch (err) {
    console.error('Lỗi tạo category:', err.message);

    const categories = await getCategoryTree();
    const mainCategories = await getAllMainCategories();

    res.render('categories', {
      title: 'Quản lý Category',
      categories,
      mainCategories,
      error: err.message || 'Đã có lỗi xảy ra, vui lòng thử lại.'
    });
  }
}

// GET /api/categories -> trả JSON (tiện gọi từ frontend/AJAX sau này)
async function listCategoriesJson(req, res) {
  try {
    const categories = await getCategoryTree();
    res.json(categories);
  } catch (err) {
    console.error('Lỗi lấy category:', err.message);
    res.status(500).json({ error: 'Không lấy được danh sách category' });
  }
}

module.exports = { showCategoryPage, submitCategory, listCategoriesJson };