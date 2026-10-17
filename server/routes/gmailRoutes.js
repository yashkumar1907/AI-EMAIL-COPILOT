const express = require("express");
const requireAuth = require("../middleware/requireAuth");

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
    requireAuth,
    getEmails
);

// --------------------------------------------------
// Get Single Email
// --------------------------------------------------

router.get(
    "/email/:id",
    requireAuth,
    getEmail
);

// --------------------------------------------------
// Reply to Email
// --------------------------------------------------

router.post(
    "/reply",
    requireAuth,
    sendReply
);

// --------------------------------------------------
// Send New Email
// --------------------------------------------------

router.post(
    "/send",
    requireAuth,
    sendEmail
);

module.exports = router;
