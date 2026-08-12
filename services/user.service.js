const User = require('../models/User');

// Đăng ký tài khoản mới. Ném lỗi dạng { code, message } để controller xử lý hiển thị.
async function registerUser({ fullname, email, phone, password, confirmPassword }) {
  if (password !== confirmPassword) {
    throw { code: 'PASSWORD_MISMATCH', message: 'Mật khẩu xác nhận không khớp, vui lòng thử lại.' };
  }

  const existed = await User.findOne({ email });
  if (existed) {
    throw { code: 'EMAIL_EXISTED', message: 'Email này đã được đăng ký.' };
  }

  // Mật khẩu tự động được mã hoá nhờ middleware pre('save') trong model User
  const newUser = new User({ fullname, email, phone, password });
  await newUser.save();

  return newUser;
}

// Kiểm tra đăng nhập, trả về user nếu hợp lệ, null nếu sai email/mật khẩu
async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  return user;
}

module.exports = { registerUser, loginUser };