const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    // 'main'  -> loại chính, ví dụ: Trong nước, Nước ngoài
    // 'region' -> loại con (miền/khu vực), ví dụ: Miền Bắc, Miền Trung, Miền Nam
    type: {
      type: String,
      enum: ['main', 'region'],
      default: 'main'
    },
    // Category con sẽ trỏ về category cha qua field này (chỉ dùng khi type = 'region')
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Category', categorySchema);