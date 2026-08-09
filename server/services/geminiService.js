const { GoogleGenAI } = require("@google/genai");

const {
    SUMMARY_PROMPT,
    DRAFT_REPLY_PROMPT,
    ACTION_ITEMS_PROMPT,
    TRANSLATE_PROMPT,
    TONE_PROMPT,
    COMPOSE_EMAIL_PROMPT,
} = require("../utils/prompts");

// --------------------------------------------------
// Validate Gemini Configuration
// --------------------------------------------------

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined");
}

// --------------------------------------------------
// Gemini Client
// --------------------------------------------------

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// --------------------------------------------------
// Model
// --------------------------------------------------

const MODEL = "gemini-3.5-flash";

// --------------------------------------------------
// Generate Content
// --------------------------------------------------

const generateContent = async (prompt) => {
    if (!prompt || typeof prompt !== "string") {
        const error = new Error("Gemini prompt is required.");
        error.statusCode = 400;
        throw error;
    }

    try {
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: prompt,
        });

        const text = response.text?.trim();

        if (!text) {
            const error = new Error(
                "Gemini returned an empty response."
            );
            error.statusCode = 502;
            throw error;
        }

        return text;
    } catch (error) {
        console.error(
            "❌ Gemini Error:",
            error.message
        );

        // Preserve errors that we have already classified.
        if (error.statusCode) {
            throw error;
        }

        // Gemini quota / rate-limit errors.
        if (
            error.status === 429 ||
            error.code === 429 ||
            error.message?.includes("429") ||
            error.message?.toLowerCase().includes("quota") ||
            error.message?.toLowerCase().includes("rate limit")
        ) {
            const quotaError = new Error(
                "Gemini API rate limit or free-tier quota reached. Please try again later."
            );

            quotaError.statusCode = 429;

            throw quotaError;
        }

        // Authentication / API-key errors.
        if (
            error.status === 401 ||
            error.code === 401 ||
            error.status === 403 ||
            error.code === 403
        ) {
            const authError = new Error(
                "Gemini API authentication failed. Please check the API configuration."
            );

            authError.statusCode = 502;

            throw authError;
        }

        // Other Gemini/API failures.
        const apiError = new Error(
            "Gemini AI service is currently unavailable."
        );

        apiError.statusCode = 502;

        throw apiError;
    }
};

// --------------------------------------------------
// Email Summary
// --------------------------------------------------

const summarizeEmail = async (email) => {
    return generateContent(
        `${SUMMARY_PROMPT}\n\nEmail:\n${email}`
    );
};

// --------------------------------------------------
// Draft Reply
// --------------------------------------------------

const generateDraftReply = async (email) => {
    const prompt = DRAFT_REPLY_PROMPT(email);

    return generateContent(prompt);
};

// --------------------------------------------------
// Extract Action Items
// --------------------------------------------------

const extractActionItems = async (email) => {
    return generateContent(
        `${ACTION_ITEMS_PROMPT}\n\nEmail:\n${email}`
    );
};

// --------------------------------------------------
// Translate Email
// --------------------------------------------------

const translateEmail = async (email, language) => {
    const prompt = `${TRANSLATE_PROMPT}

Target Language:
${language}

Email:
${email}`;

    return generateContent(prompt);
};

// --------------------------------------------------
// Improve Tone
// --------------------------------------------------

const improveTone = async (email, tone) => {
    const prompt = `${TONE_PROMPT}

Desired Tone:
${tone}

Email:
${email}`;

    return generateContent(prompt);
};

// --------------------------------------------------
// Compose Email
// --------------------------------------------------

const composeEmail = async (
    prompt,
    recipient,
    subject
) => {
    return generateContent(
        COMPOSE_EMAIL_PROMPT(
            prompt,
            recipient,
            subject
        )
    );
};

module.exports = {
    summarizeEmail,
    generateDraftReply,
    extractActionItems,
    translateEmail,
    improveTone,
    composeEmail,
};