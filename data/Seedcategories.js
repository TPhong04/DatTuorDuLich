// Chạy script này 1 lần để tạo sẵn category mặc định:
//   node seed/seedCategories.js
// Gồm 2 category chính (Trong nước, Nước ngoài) + vài category con ví dụ cho mỗi loại.
// Sau này muốn thêm loại con khác thì vào giao diện /categories để thêm, không cần sửa file này.

const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Category = require('../models/Category_model');

async function upsertCategory(data) {
  const doc = await Category.findOneAndUpdate(
    { slug: data.slug },
    data,
    { upsert: true, new: true }
  );
  return doc;
}

async function seed() {
  await connectDB();

  // ----- 2 category chính (mặc định) -----
  const trongNuoc = await upsertCategory({ name: 'Trong nước', slug: 'trong-nuoc', type: 'main' });
  console.log(`✔ Category chính: ${trongNuoc.name}`);

  const nuocNgoai = await upsertCategory({ name: 'Nước ngoài', slug: 'nuoc-ngoai', type: 'main' });
  console.log(`✔ Category chính: ${nuocNgoai.name}`);

  // ----- Category con ví dụ, thuộc "Trong nước" -----
  const trongNuocRegions = [
    { name: 'Miền Bắc', slug: 'mien-bac' },
    { name: 'Miền Trung', slug: 'mien-trung' },
    { name: 'Miền Nam', slug: 'mien-nam' },
    { name: 'TP.HCM', slug: 'tphcm' }
  ];

  for (const region of trongNuocRegions) {
    const doc = await upsertCategory({
      ...region,
      type: 'region',
      parent: trongNuoc._id
    });
    console.log(`  ↳ Thuộc Trong nước: ${doc.name}`);
  }

  // ----- Category con ví dụ, thuộc "Nước ngoài" -----
  const nuocNgoaiRegions = [
    { name: 'Châu Á', slug: 'chau-a' },
    { name: 'Châu Âu', slug: 'chau-au' },
    { name: 'Châu Mỹ', slug: 'chau-my' }
  ];

  for (const region of nuocNgoaiRegions) {
    const doc = await upsertCategory({
      ...region,
      type: 'region',
      parent: nuocNgoai._id
    });
    console.log(`  ↳ Thuộc Nước ngoài: ${doc.name}`);
  }

  console.log('\n✅ Seed category hoàn tất. Muốn thêm loại khác thì vào /categories.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Lỗi khi seed category:', err);
  process.exit(1);
});