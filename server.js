const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const morgan = require('morgan');
const { engine } = require('express-handlebars');

const connectDB = require('./config/db');
const User = require('./models/user_model');
const categoryRoutes = require('./routes/category.routes');

// Kết nối tới MongoDB (mongodb://localhost:27017/tourdulich)
connectDB();

// Cho phép truy cập file tĩnh (ảnh, gif, css...) trong thư mục "picture"
app.use('/picture', express.static(path.join(__dirname, 'picture')));

// Cấp quyền truy cập cho thư mục public
app.use(express.static(path.join(__dirname, 'public')));

app.use(morgan('combined'));

// Đọc dữ liệu từ form (đăng ký / đăng nhập / liên hệ)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình Handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  helpers: {
    eq: function (a, b) {
      return a === b;
    }
  }
}));
app.set('view engine', 'hbs');
app.set('views', './views');

// ----- Danh sách tour -----
const products = [
  {
    name: 'Hạ Long - Đảo Ti Tốp 3N2Đ',
    price: '2.590.000',
    category: 'Trong nước',
    image: '/picture/halong.jpg'
  },
  {
    name: 'Đà Lạt Mộng Mơ 2N1Đ',
    price: '1.890.000',
    category: 'Trong nước',
    image: '/picture/dalat.jpg'
  },
  {
    name: 'Phú Quốc Biển Xanh 3N2Đ',
    price: '3.290.000',
    category: 'Trong nước',
    image: '/picture/phuquoc.jpg'
  },
  {
    name: 'Sapa Săn Mây 2N1Đ',
    price: '2.190.000',
    category: 'Trong nước',
    image: '/picture/sapa.jpg'
  },
  {
    name: 'Thái Lan - Bangkok Pattaya 4N3Đ',
    price: '6.990.000',
    category: 'Nước ngoài',
    image: '/picture/thailan.jpg'
  },
  {
    name: 'Singapore - Malaysia 5N4Đ',
    price: '9.590.000',
    category: 'Nước ngoài',
    image: '/picture/singapore.jpg'
  }
];

// ----- Lý do nên chọn Viet Travel Tour -----
const whyChooseUs = [
  {
    icon: 'coffee',
    title: 'Giá tốt nhất thị trường',
    desc: 'Cam kết giá tour cạnh tranh, minh bạch, không phát sinh chi phí ẩn trong suốt hành trình.'
  },
  {
    icon: 'heart',
    title: 'Hướng dẫn viên tận tâm',
    desc: 'Đội ngũ hướng dẫn viên giàu kinh nghiệm, am hiểu địa phương, luôn đồng hành cùng bạn.'
  },
  {
    icon: 'clock',
    title: 'Lịch trình linh hoạt',
    desc: 'Dễ dàng tùy chỉnh lịch trình, hỗ trợ đặt tour nhanh chóng, xác nhận trong thời gian ngắn nhất.'
  }
];

// Trang vào đầu tiên -> Đăng ký
app.get('/', (req, res) => {
  res.render('register', { title: 'Đăng ký', layout: 'auth' });
});

// Trang chủ (danh sách tour)
app.get('/home', (req, res) => {
  res.render('home', {
    title: 'Trang chủ',
    products: products,
    whyChooseUs: whyChooseUs
  });
});

// Trang danh sách tour (dùng chung dữ liệu với trang chủ)
app.get('/tours', (req, res) => {
  res.render('home', {
    title: 'Danh sách tour',
    products: products,
    whyChooseUs: whyChooseUs
  });
});

// Giới thiệu công ty
app.get('/about', (req, res) => {
  res.render('about', { title: 'Giới thiệu' });
});

// Liên hệ
app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Liên hệ' });
});

app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Liên hệ mới:', { name, email, message });
  // TODO: lưu vào database hoặc gửi email nếu cần
  res.render('contact', {
    title: 'Liên hệ',
    success: true,
    successMessage: 'Cảm ơn bạn đã liên hệ, chúng tôi sẽ phản hồi sớm nhất!'
  });
});

// ----- Đăng ký -----
app.get('/register', (req, res) => {
  res.render('register', { title: 'Đăng ký', layout: 'auth' });
});

app.post('/register', async (req, res) => {
  const { fullname, email, phone, password, confirmPassword } = req.body;

  try {
    if (password !== confirmPassword) {
      return res.render('register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Mật khẩu xác nhận không khớp, vui lòng thử lại.',
        fullname,
        email,
        phone
      });
    }

    const existed = await User.findOne({ email });
    if (existed) {
      return res.render('register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Email này đã được đăng ký.',
        fullname,
        phone
      });
    }

    // Mật khẩu sẽ tự động được mã hoá nhờ middleware pre('save') trong model User
    const newUser = new User({ fullname, email, phone, password });
    await newUser.save();

    console.log('Đăng ký mới:', { fullname, email, phone });
    res.redirect('/login');
  } catch (err) {
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
});

// ----- Đăng nhập -----
app.get('/login', (req, res) => {
  res.render('login', { title: 'Đăng nhập', layout: 'auth' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    const isMatch = user ? await user.comparePassword(password) : false;

    if (!user || !isMatch) {
      return res.render('login', {
        title: 'Đăng nhập',
        layout: 'auth',
        error: 'Email hoặc mật khẩu không đúng.',
        email
      });
    }

    // TODO: tạo session thực tế nếu cần đăng nhập bền vững
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
});

// ----- Tìm kiếm tour -----
app.get('/search', (req, res) => {
  const keyword = (req.query.q || '').trim();
  let results = [];

  if (keyword) {
    results = products.filter(p =>
      p.name.toLowerCase().includes(keyword.toLowerCase()) ||
      p.category.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  res.render('search', {
    title: 'Tìm kiếm',
    keyword,
    results,
    resultsCount: results.length,
    hasResults: results.length > 0,
    searched: keyword.length > 0
  });
});

// ----- Đăng ký nhận ưu đãi (newsletter) -----
app.post('/newsletter', (req, res) => {
  const { email } = req.body;
  console.log('Đăng ký nhận ưu đãi:', email);
  res.redirect('/home');
});

// ----- CATEGORY (đã tách riêng ra routes/controllers/services) -----
app.use('/', categoryRoutes);

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});