const isUserAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'user') {
    return next()
  }
  return res.redirect('/user/login')
}

const isLoggedout=(req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return res.redirect('/user/landinghome');
  }
  next();
};

module.exports = {isUserAuthenticated,isLoggedout}