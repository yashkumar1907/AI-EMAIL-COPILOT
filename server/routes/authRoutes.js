const express = require("express");
const passport = require("passport");

const {
    loginSuccess,
    logout,
} = require("../controllers/authController");

const router = express.Router();

// --------------------------------------------------
// Google Login
// --------------------------------------------------

router.get(
    "/google",
    passport.authenticate("google", {
        scope: [
            "profile",
            "email",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
        ],
        accessType: "offline",
        prompt: "consent",
    })
);

// --------------------------------------------------
// Google Callback
// --------------------------------------------------

router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/auth/login/failed",
        session: true,
    }),
    (req, res) => {
        const clientURL = process.env.CLIENT_URL;

        if (!clientURL) {
            return res.status(500).json({
                success: false,
                message: "CLIENT_URL is not configured",
            });
        }

        res.redirect(`${clientURL}/dashboard.html`);
    }
);

// --------------------------------------------------
// Login Success
// --------------------------------------------------

router.get("/login/success", loginSuccess);

// --------------------------------------------------
// Logout
// --------------------------------------------------

router.get("/logout", logout);

// --------------------------------------------------
// Login Failed
// --------------------------------------------------

router.get("/login/failed", (req, res) => {
    res.status(401).json({
        success: false,
        message: "Google Authentication Failed",
    });
});

module.exports = router;