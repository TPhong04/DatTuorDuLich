// GET /contact
function showContactForm(req, res) {
  res.render('contact', { title: 'Liên hệ' });
}

// POST /contact
function submitContact(req, res) {
  const { name, email, message } = req.body;
  console.log('Liên hệ mới:', { name, email, message });
  // TODO: lưu vào database hoặc gửi email nếu cần
  res.render('contact', {
    title: 'Liên hệ',
    success: true,
    successMessage: 'Cảm ơn bạn đã liên hệ, chúng tôi sẽ phản hồi sớm nhất!'
  });
}

// POST /newsletter
function subscribeNewsletter(req, res) {
  const { email } = req.body;
  console.log('Đăng ký nhận ưu đãi:', email);
  res.redirect('/home');
}

module.exports = { showContactForm, submitContact, subscribeNewsletter };