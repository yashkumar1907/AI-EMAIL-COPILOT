const { google } = require("googleapis");
const { readGoogleTokens, writeGoogleTokens } = require("./userTokenService");

const getOAuthClient = () => {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
        const error = new Error("Google OAuth is not configured on the server.");
        error.statusCode = 503;
        throw error;
    }

    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );
};

const validateEmailFields = (to, subject, message) => {
    const error = new Error("A valid recipient, subject, and message are required.");
    error.statusCode = 400;

    const recipient = typeof to === "string" ? to.trim() : "";
    const angleAddress = recipient.match(/^[^<>\r\n]*<([^<>\s]+)>$/);
    const address = angleAddress ? angleAddress[1] : recipient;

    if (!recipient || recipient.length > 320 || /[\r\n]/.test(recipient) ||
        !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) {
        throw error;
    }
    if (typeof subject !== "string" || !subject.trim() || subject.length > 998 || /[\r\n]/.test(subject)) {
        throw error;
    }
    if (typeof message !== "string" || !message.trim() || message.length > 100000) {
        throw error;
    }
};

const mapGmailError = (error, fallbackMessage) => {
    if (error.statusCode) return error;

    const candidate = error.response?.status || error.status || error.code;
    const status = Number(candidate);
    const mapped = new Error(
        status === 401
            ? "Gmail authorization expired. Please sign in with Google again."
            : status === 403
              ? "Gmail denied this request. Check the account permissions and Gmail API access."
              : status === 429
                ? "Gmail rate limit reached. Please try again shortly."
                : fallbackMessage
    );
    mapped.statusCode = status === 401 || status === 403 || status === 429
        ? status
        : status === 503 || status === 504
          ? 503
          : 502;
    return mapped;
};

const validateReplyHeaders = (inReplyTo, references) => {
    const error = new Error("This email is missing valid reply headers. Refresh the message and try again.");
    error.statusCode = 400;

    if (
        typeof inReplyTo !== "string" ||
        inReplyTo.length > 998 ||
        !/^<[^<>\s]+>$/.test(inReplyTo.trim())
    ) {
        throw error;
    }

    const safeReferences = typeof references === "string" ? references.trim() : "";
    if (
        safeReferences.length > 8000 ||
        /[\r\n]/.test(safeReferences) ||
        (safeReferences && !/^(?:<[^<>\s]+>\s*)+$/.test(safeReferences))
    ) {
        throw error;
    }

    return [safeReferences, inReplyTo.trim()].filter(Boolean).join(" ");
};

// --------------------------------------------------
// Create Gmail OAuth Client
// --------------------------------------------------

const createOAuthClient = async (user) => {
    if (!user) {
        const error = new Error("User is not authenticated.");
        error.statusCode = 401;
        throw error;
    }

    const savedTokens = readGoogleTokens(user);
    if (!savedTokens.accessToken && !savedTokens.refreshToken) {
        const error = new Error(
            "Gmail authorization is missing. Please log in with Google again."
        );
        error.statusCode = 401;
        throw error;
    }

    const oauth2Client = getOAuthClient();

    oauth2Client.setCredentials({
        access_token: savedTokens.accessToken || undefined,
        refresh_token: savedTokens.refreshToken || undefined,
    });

    // Save newly generated tokens when Google refreshes them.
    oauth2Client.on("tokens", async (tokens) => {
        try {
            writeGoogleTokens(user, {
                ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
                ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            });

            await user.save();
        } catch (error) {
            console.error(
                "❌ Failed to save refreshed Gmail tokens:",
                error.message
            );
        }
    });

    return oauth2Client;
};

// --------------------------------------------------
// Get Gmail Client
// --------------------------------------------------

const getGmailClient = async (user) => {
    const oauth2Client = await createOAuthClient(user);

    return google.gmail({
        version: "v1",
        auth: oauth2Client,
    });
};

// --------------------------------------------------
// Get Recent Emails
// --------------------------------------------------

const getRecentEmails = async (user) => {
    try {
        const gmail = await getGmailClient(user);

        const response = await gmail.users.messages.list({
            userId: "me",
            labelIds: ["INBOX"],
            maxResults: 10,
        });

        const messages = response.data.messages || [];

        const emails = [];

        for (const message of messages) {
            const email = await gmail.users.messages.get({
                userId: "me",
                id: message.id,
                format: "metadata",
                metadataHeaders: ["Subject", "From", "Date"],
            });

            const headers = email.data.payload?.headers || [];

            const subject =
                headers.find(
                    (header) =>
                        header.name.toLowerCase() === "subject"
                )?.value || "";

            const from =
                headers.find(
                    (header) =>
                        header.name.toLowerCase() === "from"
                )?.value || "";

            const date =
                headers.find(
                    (header) =>
                        header.name.toLowerCase() === "date"
                )?.value || "";

            emails.push({
                id: message.id,
                threadId: email.data.threadId,
                subject,
                from,
                date,
                snippet: email.data.snippet || "",
            });
        }

        return emails;
    } catch (error) {
        console.error("Gmail fetch failed", {
            status: error.response?.status || error.status || null,
        });

        throw mapGmailError(
            error,
            "Unable to access Gmail. Please try again shortly."
        );
    }
};

// --------------------------------------------------
// Get Single Email
// --------------------------------------------------

const getEmailById = async (user, emailId) => {
    if (!emailId) {
        const error = new Error("Email ID is required.");
        error.statusCode = 400;
        throw error;
    }

    try {
        const gmail = await getGmailClient(user);

        const email = await gmail.users.messages.get({
            userId: "me",
            id: emailId,
            format: "full",
        });

        return email.data;
    } catch (error) {
        console.error("Gmail message retrieval failed", {
            status: error.response?.status || error.status || null,
        });

        if (error.code === 404 || error.response?.status === 404) {
            const notFoundError = new Error("Email not found.");
            notFoundError.statusCode = 404;
            throw notFoundError;
        }

        throw mapGmailError(error, "Unable to retrieve the email.");
    }
};

// --------------------------------------------------
// Reply to Email
// --------------------------------------------------

const replyToEmail = async (
    user,
    threadId,
    to,
    subject,
    message,
    inReplyTo,
    references
) => {
    if (typeof threadId !== "string" || !threadId.trim()) {
        const error = new Error(
            "Thread ID is required."
        );

        error.statusCode = 400;

        throw error;
    }

    validateEmailFields(to, subject, message);
    const replyReferences = validateReplyHeaders(inReplyTo, references);

    try {
        const gmail = await getGmailClient(user);

        const safeSubject = subject.trim();
        const emailLines = [
            `To: ${to.trim()}`,
            `Subject: ${safeSubject}`,
            `In-Reply-To: ${inReplyTo.trim()}`,
            `References: ${replyReferences}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            message,
        ];

        const email = emailLines.join("\r\n");

        const encodedMessage = Buffer.from(email)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
                threadId,
            },
        });

        return true;
    } catch (error) {
        console.error("Gmail reply failed", {
            status: error.response?.status || error.status || null,
        });
        throw mapGmailError(error, "Unable to send the reply.");
    }
};

// --------------------------------------------------
// Send New Email
// --------------------------------------------------

const sendEmail = async (
    user,
    to,
    subject,
    message
) => {
    validateEmailFields(to, subject, message);

    try {
        const gmail = await getGmailClient(user);

        const emailLines = [
            `To: ${to.trim()}`,
            `Subject: ${subject.trim()}`,
            "Content-Type: text/plain; charset=utf-8",
            "",
            message,
        ];

        const email = emailLines.join("\r\n");

        const encodedMessage = Buffer.from(email)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });

        return true;
    } catch (error) {
        console.error("Gmail send failed", {
            status: error.response?.status || error.status || null,
        });
        throw mapGmailError(error, "Unable to send the email.");
    }
};

module.exports = {
    getRecentEmails,
    getEmailById,
    replyToEmail,
    sendEmail,
};
