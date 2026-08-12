const Category = require('../models/Category_model');

// Trả về mảng category chính, mỗi cái kèm danh sách category con (miền/khu vực) nếu có
async function getCategoryTree() {
  const mainCategories = await Category.find({ type: 'main' }).lean();
  const subCategories = await Category.find({ type: 'region' }).lean();

  return mainCategories.map(main => ({
    ...main,
    children: subCategories.filter(c => String(c.parent) === String(main._id))
  }));
}

// Lấy toàn bộ category (dùng để đổ vào <select> chọn category cha khi thêm mới)
async function getAllMainCategories() {
  return Category.find({ type: 'main' }).lean();
}

// Tự sinh slug từ tên, ví dụ "Miền Bắc" -> "mien-bac"
function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Tạo category mới từ dữ liệu người dùng nhập trên giao diện
async function createCategory({ name, type, parent }) {
  if (!name || !name.trim()) {
    throw { code: 'INVALID_NAME', message: 'Vui lòng nhập tên category.' };
  }

  const slug = slugify(name);

  const existed = await Category.findOne({ slug });
  if (existed) {
    throw { code: 'DUPLICATE', message: 'Category này đã tồn tại.' };
  }

  const categoryData = {
    name: name.trim(),
    slug,
    type: type === 'region' ? 'region' : 'main'
  };

  // Nếu là category con (vd: miền) thì bắt buộc phải chọn category cha
  if (categoryData.type === 'region') {
    if (!parent) {
      throw { code: 'MISSING_PARENT', message: 'Vui lòng chọn category cha cho loại con.' };
    }
    categoryData.parent = parent;
  }

  const newCategory = new Category(categoryData);
  await newCategory.save();
  return newCategory;
}

module.exports = { getCategoryTree, getAllMainCategories, createCategory };