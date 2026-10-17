const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, "../.env"),
    quiet: true,
});

const { GEMINI_MODEL } = require("../config/gemini");

const categoryForStatus = (status) => {
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

const safeMessageFor = (error) => {
    let message = String(error.message || "Gemini request failed");

    try {
        const parsed = JSON.parse(message);
        message =
            parsed.error?.message ||
            parsed.message ||
            "Gemini request failed";
    } catch {
        // Continue with key redaction and length limits.
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

const main = async () => {
    if (!process.env.GEMINI_API_KEY) {
        console.error(
            JSON.stringify({
                ok: false,
                category: "configuration",
                message:
                    "GEMINI_API_KEY is missing. Configure it in server/.env or the server environment.",
            })
        );
        process.exitCode = 2;
        return;
    }

    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: "Respond with exactly: OK",
        });

        if (!response.text?.trim()) {
            console.error(
                JSON.stringify({
                    ok: false,
                    status: 502,
                    category: "empty_response",
                    model: GEMINI_MODEL,
                    message: "Gemini returned an empty response.",
                })
            );
            process.exitCode = 1;
            return;
        }

        console.log(
            JSON.stringify({
                ok: true,
                status: 200,
                model: GEMINI_MODEL,
                responseReceived: true,
            })
        );
    } catch (error) {
        const statusCandidates = [
            error.status,
            error.statusCode,
            error.response?.status,
            error.code,
        ];
        const status = statusCandidates
            .map(Number)
            .find((value) => Number.isInteger(value) && value > 0) || null;

        console.error(
            JSON.stringify({
                ok: false,
                status,
                category: categoryForStatus(status),
                model: GEMINI_MODEL,
                message: safeMessageFor(error),
            })
        );
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error(
        JSON.stringify({
            ok: false,
            category: "diagnostic_failure",
            message: safeMessageFor(error),
        })
    );
    process.exitCode = 1;
});
