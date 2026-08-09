const express = require("express");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");

require("./config/passport");

const authRoutes = require("./routes/authRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// CORS
// --------------------------------------------------

const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5504",
    "http://127.0.0.1:5504",
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header
            // (Postman, server-to-server requests, etc.)
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(
                new Error(`CORS policy: Origin ${origin} is not allowed`)
            );
        },
        credentials: true,
    })
);

// --------------------------------------------------
// Session
// --------------------------------------------------

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not defined in environment variables");
}

const isProduction = process.env.NODE_ENV === "production";

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: isProduction,
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

// --------------------------------------------------
// Passport
// --------------------------------------------------

app.use(passport.initialize());
app.use(passport.session());

// --------------------------------------------------
// Health Check
// --------------------------------------------------

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.use("/auth", authRoutes);
app.use("/gmail", gmailRoutes);
app.use("/ai", aiRoutes);

// --------------------------------------------------
// Root Route
// --------------------------------------------------

app.get("/", (req, res) => {
    res.status(200).send("AI Email Copilot Backend Running 🚀");
});

// --------------------------------------------------
// 404 Handler
// --------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// --------------------------------------------------
// Global Error Handler
// --------------------------------------------------

app.use((err, req, res, next) => {
    console.error("❌ Server Error:", err);

    if (err.message && err.message.startsWith("CORS policy:")) {
        return res.status(403).json({
            success: false,
            message: err.message,
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message:
            process.env.NODE_ENV === "production"
                ? "Internal server error"
                : err.message,
    });
});

module.exports = app;