const { google } = require("googleapis");

// --------------------------------------------------
// Create Gmail OAuth Client
// --------------------------------------------------

const createOAuthClient = async (user) => {
    if (!user) {
        const error = new Error("User is not authenticated.");
        error.statusCode = 401;
        throw error;
    }

    if (!user.accessToken && !user.refreshToken) {
        const error = new Error(
            "Gmail authorization is missing. Please log in with Google again."
        );
        error.statusCode = 401;
        throw error;
    }

    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({
        access_token: user.accessToken || undefined,
        refresh_token: user.refreshToken || undefined,
    });

    // Save newly generated tokens when Google refreshes them.
    oauth2Client.on("tokens", async (tokens) => {
        try {
            if (tokens.access_token) {
                user.accessToken = tokens.access_token;
            }

            if (tokens.refresh_token) {
                user.refreshToken = tokens.refresh_token;
            }

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
        console.error(
            "❌ Gmail Fetch Emails Error:",
            error.message
        );

        if (error.statusCode) {
            throw error;
        }

        const gmailError = new Error(
            "Unable to access Gmail. Please sign in with Google again if the problem continues."
        );

        gmailError.statusCode = 401;

        throw gmailError;
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
        console.error(
            "❌ Gmail Get Email Error:",
            error.message
        );

        if (error.code === 404) {
            const notFoundError = new Error("Email not found.");
            notFoundError.statusCode = 404;
            throw notFoundError;
        }

        if (error.statusCode) {
            throw error;
        }

        const gmailError = new Error(
            "Unable to retrieve the email."
        );

        gmailError.statusCode = 500;

        throw gmailError;
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
    message
) => {
    if (!threadId || !to || !subject || !message) {
        const error = new Error(
            "Thread ID, recipient, subject, and message are required."
        );

        error.statusCode = 400;

        throw error;
    }

    try {
        const gmail = await getGmailClient(user);

        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
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
        console.error(
            "❌ Gmail Reply Error:",
            error.message
        );

        if (error.statusCode) {
            throw error;
        }

        const gmailError = new Error(
            "Unable to send the reply."
        );

        gmailError.statusCode = 500;

        throw gmailError;
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
    if (!to || !subject || !message) {
        const error = new Error(
            "Recipient, subject, and message are required."
        );

        error.statusCode = 400;

        throw error;
    }

    try {
        const gmail = await getGmailClient(user);

        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
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
        console.error(
            "❌ Gmail Send Email Error:",
            error.message
        );

        if (error.statusCode) {
            throw error;
        }

        const gmailError = new Error(
            "Unable to send the email."
        );

        gmailError.statusCode = 500;

        throw gmailError;
    }
};

module.exports = {
    getRecentEmails,
    getEmailById,
    replyToEmail,
    sendEmail,
};