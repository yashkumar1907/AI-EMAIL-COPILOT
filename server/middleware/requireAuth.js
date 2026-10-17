const requireAuth = (req, res, next) => {
    if (req.isAuthenticated?.()) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "User is not authenticated.",
    });
};

module.exports = requireAuth;
