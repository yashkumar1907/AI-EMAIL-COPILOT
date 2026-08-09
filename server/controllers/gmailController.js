const gmailService = require("../services/gmailService");

// --------------------------------------------------
// Get Recent Emails
// --------------------------------------------------

const getEmails = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const emails = await gmailService.getRecentEmails(req.user);

        return res.status(200).json({
            success: true,
            count: emails.length,
            emails,
        });
    } catch (err) {
        console.error("❌ Get Emails Error:", err.message);

        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode
                ? err.message
                : "Failed to fetch emails",
        });
    }
};

// --------------------------------------------------
// Get Single Email
// --------------------------------------------------

const getEmail = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Email ID is required",
            });
        }

        const email = await gmailService.getEmailById(
            req.user,
            id
        );

        return res.status(200).json({
            success: true,
            email,
        });
    } catch (err) {
        console.error("❌ Get Email Error:", err.message);

        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode
                ? err.message
                : "Failed to fetch email",
        });
    }
};

// --------------------------------------------------
// Reply to Email
// --------------------------------------------------

const sendReply = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const {
            threadId,
            to,
            subject,
            message,
        } = req.body;

        if (!threadId || !to || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Thread ID, recipient, subject, and message are required",
            });
        }

        await gmailService.replyToEmail(
            req.user,
            threadId,
            to,
            subject,
            message
        );

        return res.status(200).json({
            success: true,
            message: "Reply sent successfully",
        });
    } catch (err) {
        console.error("❌ Reply Error:", err.message);

        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode
                ? err.message
                : "Reply failed",
        });
    }
};

// --------------------------------------------------
// Send New Email
// --------------------------------------------------

const sendEmail = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const {
            to,
            subject,
            message,
        } = req.body;

        if (!to || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Recipient, subject, and message are required",
            });
        }

        await gmailService.sendEmail(
            req.user,
            to,
            subject,
            message
        );

        return res.status(200).json({
            success: true,
            message: "Email sent successfully",
        });
    } catch (err) {
        console.error("❌ Send Email Error:", err.message);

        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.statusCode
                ? err.message
                : "Failed to send email",
        });
    }
};

module.exports = {
    getEmails,
    getEmail,
    sendReply,
    sendEmail,
};