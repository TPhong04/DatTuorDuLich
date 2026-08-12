const { products, whyChooseUs } = require('../data/tours');

// GET / -> vào thẳng /home nếu đã đăng nhập, ngược lại hiện trang đăng ký
function showEntry(req, res) {
  if (req.session.user) {
    return res.redirect('/home');
  }
  res.render('register', { title: 'Đăng ký', layout: 'auth' });
}

// GET /home
function showHome(req, res) {
  res.render('home', {
    title: 'Trang chủ',
    products,
    whyChooseUs
  });
}

// GET /tours
function showTours(req, res) {
  res.render('home', {
    title: 'Danh sách tour',
    products,
    whyChooseUs
  });
}

// GET /about
function showAbout(req, res) {
  res.render('about', { title: 'Giới thiệu' });
}

module.exports = { showEntry, showHome, showTours, showAbout };