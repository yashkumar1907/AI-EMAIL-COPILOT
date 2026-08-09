// --------------------------------------------------
// Login Success
// --------------------------------------------------

const loginSuccess = (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "User not authenticated",
        });
    }

    return res.status(200).json({
        success: true,
        message: "Login successful",
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            profilePicture: req.user.profilePicture,
        },
    });
};

// --------------------------------------------------
// Logout
// --------------------------------------------------

const logout = (req, res) => {
    req.logout((logoutError) => {
        if (logoutError) {
            console.error("❌ Logout Error:", logoutError);

            return res.status(500).json({
                success: false,
                message: "Logout failed",
            });
        }

        req.session.destroy((sessionError) => {
            if (sessionError) {
                console.error("❌ Session Destroy Error:", sessionError);

                return res.status(500).json({
                    success: false,
                    message: "Failed to destroy session",
                });
            }

            res.clearCookie("connect.sid");

            return res.status(200).json({
                success: true,
                message: "Logged out successfully",
            });
        });
    });
};

module.exports = {
    loginSuccess,
    logout,
};