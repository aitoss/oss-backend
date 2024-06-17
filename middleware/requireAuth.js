const requireAuth = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    } else {
        res.redirect('/admin/login');
    }
};

module.exports = requireAuth;