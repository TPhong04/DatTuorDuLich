const { registerUser, loginUser } = require('../services/user.service');

// GET /register
function showRegisterForm(req, res) {
  res.render('register', { title: 'Đăng ký', layout: 'auth' });
}

// POST /register
async function register(req, res) {
  const { fullname, email, phone, password, confirmPassword } = req.body;

  try {
    await registerUser({ fullname, email, phone, password, confirmPassword });
    console.log('Đăng ký mới:', { fullname, email, phone });
    res.redirect('/login');
  } catch (err) {
    // Lỗi nghiệp vụ (sai mật khẩu / email trùng) do service ném ra
    if (err.code === 'PASSWORD_MISMATCH') {
      return res.render('register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: err.message,
        fullname,
        email,
        phone
      });
    }

    if (err.code === 'EMAIL_EXISTED') {
      return res.render('register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: err.message,
        fullname,
        phone
      });
    }

    console.error('Lỗi đăng ký:', err.message);
    res.render('register', {
      title: 'Đăng ký',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại sau.',
      fullname,
      email,
      phone
    });
  }
}

// GET /login
function showLoginForm(req, res) {
  res.render('login', { title: 'Đăng nhập', layout: 'auth' });
}

// POST /login
async function login(req, res) {
  const { email, password, remember } = req.body;

  try {
    const user = await loginUser({ email, password });

    if (!user) {
      return res.render('login', {
        title: 'Đăng nhập',
        layout: 'auth',
        error: 'Email hoặc mật khẩu không đúng.',
        email
      });
    }

    // Tạo session lưu thông tin user (không lưu password)
    req.session.user = {
      id: user._id,
      fullname: user.fullname,
      email: user.email
    };

    // Nếu tick "Ghi nhớ đăng nhập" thì kéo dài thời gian sống của cookie
    if (remember) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 ngày
    }

    res.redirect('/home');
  } catch (err) {
    console.error('Lỗi đăng nhập:', err.message);
    res.render('login', {
      title: 'Đăng nhập',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại sau.',
      email
    });
  }
}

// GET /logout
function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

module.exports = { showRegisterForm, register, showLoginForm, login, logout };