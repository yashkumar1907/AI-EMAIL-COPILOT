const express = require("express");
const requireAuth = require("../middleware/requireAuth");

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
    requireAuth,
    summarize
);

// --------------------------------------------------
// AI Draft Reply
// --------------------------------------------------

router.post(
    "/draft-reply",
    requireAuth,
    draftReply
);

// --------------------------------------------------
// AI Action Items
// --------------------------------------------------

router.post(
    "/action-items",
    requireAuth,
    actionItems
);

// --------------------------------------------------
// AI Translation
// --------------------------------------------------

router.post(
    "/translate",
    requireAuth,
    translate
);

// --------------------------------------------------
// AI Improve Tone
// --------------------------------------------------

router.post(
    "/improve-tone",
    requireAuth,
    tone
);

// --------------------------------------------------
// AI Compose Email
// --------------------------------------------------

router.post(
    "/compose",
    requireAuth,
    compose
);

module.exports = router;
