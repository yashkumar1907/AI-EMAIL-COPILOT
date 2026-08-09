const express = require("express");
const passport = require("passport");

const {
    summarize,
    draftReply,
    actionItems,
    translate,
    tone,
    compose,
} = require("../controllers/aiController");

const router = express.Router();

// --------------------------------------------------
// AI Summary
// --------------------------------------------------

router.post(
    "/summarize",
    passport.authenticate("session"),
    summarize
);

// --------------------------------------------------
// AI Draft Reply
// --------------------------------------------------

router.post(
    "/draft-reply",
    passport.authenticate("session"),
    draftReply
);

// --------------------------------------------------
// AI Action Items
// --------------------------------------------------

router.post(
    "/action-items",
    passport.authenticate("session"),
    actionItems
);

// --------------------------------------------------
// AI Translation
// --------------------------------------------------

router.post(
    "/translate",
    passport.authenticate("session"),
    translate
);

// --------------------------------------------------
// AI Improve Tone
// --------------------------------------------------

router.post(
    "/improve-tone",
    passport.authenticate("session"),
    tone
);

// --------------------------------------------------
// AI Compose Email
// --------------------------------------------------

router.post(
    "/compose",
    passport.authenticate("session"),
    compose
);

module.exports = router;