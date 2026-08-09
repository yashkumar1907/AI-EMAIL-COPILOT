const {
    summarizeEmail,
    generateDraftReply,
    extractActionItems,
    translateEmail,
    improveTone,
    composeEmail,
} = require("../services/geminiService");

// --------------------------------------------------
// Summarize Email
// --------------------------------------------------

const summarize = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email content is required.",
            });
        }

        const summary = await summarizeEmail(email.trim());

        return res.status(200).json({
            success: true,
            summary,
        });
    } catch (error) {
        console.error("❌ Summarize Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to summarize email.",
        });
    }
};

// --------------------------------------------------
// Draft Reply
// --------------------------------------------------

const draftReply = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email content is required.",
            });
        }

        const reply = await generateDraftReply(email.trim());

        return res.status(200).json({
            success: true,
            reply,
        });
    } catch (error) {
        console.error("❌ Draft Reply Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to generate reply.",
        });
    }
};

// --------------------------------------------------
// Extract Action Items
// --------------------------------------------------

const actionItems = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email content is required.",
            });
        }

        const actions = await extractActionItems(email.trim());

        return res.status(200).json({
            success: true,
            actions,
        });
    } catch (error) {
        console.error("❌ Action Items Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to extract action items.",
        });
    }
};

// --------------------------------------------------
// Translate Email
// --------------------------------------------------

const translate = async (req, res) => {
    try {
        const { email, language } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email content is required.",
            });
        }

        const selectedLanguage =
            typeof language === "string" && language.trim()
                ? language.trim()
                : "Hindi";

        const translation = await translateEmail(
            email.trim(),
            selectedLanguage
        );

        return res.status(200).json({
            success: true,
            translation,
        });
    } catch (error) {
        console.error("❌ Translation Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to translate email.",
        });
    }
};

// --------------------------------------------------
// Improve Tone
// --------------------------------------------------

const tone = async (req, res) => {
    try {
        const { email, tone: requestedTone } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email content is required.",
            });
        }

        const selectedTone =
            typeof requestedTone === "string" &&
            requestedTone.trim()
                ? requestedTone.trim()
                : "Professional";

        const improved = await improveTone(
            email.trim(),
            selectedTone
        );

        return res.status(200).json({
            success: true,
            improved,
        });
    } catch (error) {
        console.error("❌ Improve Tone Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to improve tone.",
        });
    }
};

// --------------------------------------------------
// Compose Email
// --------------------------------------------------

const compose = async (req, res) => {
    try {
        const {
            prompt,
            recipient,
            subject,
        } = req.body;

        if (
            !prompt ||
            typeof prompt !== "string" ||
            !prompt.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Prompt is required.",
            });
        }

        const body = await composeEmail(
            prompt.trim(),
            typeof recipient === "string"
                ? recipient.trim()
                : "",
            typeof subject === "string"
                ? subject.trim()
                : ""
        );

        return res.status(200).json({
            success: true,
            body,
        });
    } catch (error) {
        console.error("❌ Compose Email Error:", error.message);

        return res.status(error.statusCode || 500).json({
            success: false,
            message:
                error.statusCode
                    ? error.message
                    : "Failed to generate email.",
        });
    }
};

module.exports = {
    summarize,
    draftReply,
    actionItems,
    translate,
    tone,
    compose,
};