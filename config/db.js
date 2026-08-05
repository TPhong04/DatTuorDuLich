const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/tourdulich';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Đã kết nối MongoDB:', MONGO_URI);
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;