const express = require("express");
const passport = require("passport");

const {
    getEmails,
    getEmail,
    sendReply,
    sendEmail,
} = require("../controllers/gmailController");

const router = express.Router();

// --------------------------------------------------
// Get Emails
// --------------------------------------------------

router.get(
    "/emails",
    passport.authenticate("session"),
    getEmails
);

// --------------------------------------------------
// Get Single Email
// --------------------------------------------------

router.get(
    "/email/:id",
    passport.authenticate("session"),
    getEmail
);

// --------------------------------------------------
// Reply to Email
// --------------------------------------------------

router.post(
    "/reply",
    passport.authenticate("session"),
    sendReply
);

// --------------------------------------------------
// Send New Email
// --------------------------------------------------

router.post(
    "/send",
    passport.authenticate("session"),
    sendEmail
);

module.exports = router;