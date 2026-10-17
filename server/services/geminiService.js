const { GoogleGenAI } = require("@google/genai");
const { GEMINI_MODEL } = require("../config/gemini");

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

const MODEL = GEMINI_MODEL;

const getGeminiStatus = (error) => {
    const candidates = [
        error.status,
        error.statusCode,
        error.response?.status,
        error.code,
    ];

    for (const candidate of candidates) {
        const status = Number(candidate);

        if (Number.isInteger(status) && status > 0) {
            return status;
        }
    }

    return null;
};

const getGeminiCategory = (status) => {
    if (status === 400) return "invalid_request";
    if (status === 401) return "authentication";
    if (status === 403) return "access_or_billing";
    if (status === 404) return "model_or_endpoint";
    if (status === 429) return "quota_or_rate_limit";
    if (status === 503 || status === 504) {
        return "temporarily_unavailable";
    }
    if (status >= 500) return "provider_failure";
    if (!status) return "network_or_sdk";
    return "provider_error";
};

const getSafeGeminiMessage = (error) => {
    let message = String(error.message || "Gemini request failed");

    try {
        const parsed = JSON.parse(message);
        message =
            parsed.error?.message ||
            parsed.message ||
            "Gemini request failed";
    } catch {
        // SDK messages are still redacted and bounded below.
    }

    if (process.env.GEMINI_API_KEY) {
        message = message.replaceAll(
            process.env.GEMINI_API_KEY,
            "[redacted]"
        );
    }

    return message
        .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[redacted]")
        .replace(/AIza[\w-]{20,}/g, "[redacted]")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
        .slice(0, 400);
};

const getUserFacingGeminiError = (category) => {
    switch (category) {
        case "authentication":
        case "access_or_billing":
            return {
                statusCode: 503,
                message:
                    "Gemini access is not configured correctly. Check the API key permissions and billing settings.",
            };
        case "model_or_endpoint":
            return {
                statusCode: 503,
                message:
                    "The configured Gemini model is unavailable. Check the server model configuration.",
            };
        case "quota_or_rate_limit":
            return {
                statusCode: 429,
                message:
                    "Gemini rate limit or quota reached. Check the API plan or try again later.",
            };
        case "temporarily_unavailable":
            return {
                statusCode: 503,
                message:
                    "Gemini is temporarily busy. Please try again shortly.",
            };
        case "invalid_request":
            return {
                statusCode: 502,
                message:
                    "Gemini could not process this request. Review the input and try again.",
            };
        default:
            return {
                statusCode: 502,
                message:
                    "Gemini is temporarily unavailable. Please try again shortly.",
            };
    }
};

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
            error.category = "empty_response";
            throw error;
        }

        return text;
    } catch (error) {
        // Preserve errors that we have already classified.
        if (error.category === "empty_response") {
            throw error;
        }

        const status = getGeminiStatus(error);
        const category = getGeminiCategory(status);
        const safeMessage = getSafeGeminiMessage(error);
        const userFacingError = getUserFacingGeminiError(category);

        console.error(
            "Gemini API request failed:",
            JSON.stringify({
                model: MODEL,
                status,
                category,
                message: safeMessage,
            })
        );

        const apiError = new Error(userFacingError.message);
        apiError.statusCode = userFacingError.statusCode;
        apiError.category = category;

        throw apiError;
    }
};

// --------------------------------------------------
// Email Summary
// --------------------------------------------------

const summarizeEmail = async (email) => {
    return generateContent(
        `${SUMMARY_PROMPT}\n${email}\n</email>`
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
    const response = await generateContent(
        `${ACTION_ITEMS_PROMPT}\n${email}\n</email>`
    );

    // Keep the existing API response type (string) while normalizing the
    // model's requested empty-list representation for the dashboard.
    if (/^\[\]$/.test(response.trim())) {
        return "No action items found.";
    }

    return response;
};

// --------------------------------------------------
// Translate Email
// --------------------------------------------------

const translateEmail = async (email, language) => {
    const prompt = `${TRANSLATE_PROMPT} ${language}

<email>
${email}
</email>`;

    return generateContent(prompt);
};

// --------------------------------------------------
// Improve Tone
// --------------------------------------------------

const improveTone = async (email, tone) => {
    const prompt = `${TONE_PROMPT} ${tone}

<email>
${email}
</email>`;

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
    MODEL,
};
