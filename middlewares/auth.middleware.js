// Gắn thông tin user hiện tại (nếu có) vào mọi view thông qua res.locals
function attachCurrentUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

// Chặn truy cập nếu chưa đăng nhập
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

module.exports = { attachCurrentUser, requireAuth };