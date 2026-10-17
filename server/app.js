const express = require("express");
const session = require("express-session");
const passport = require("passport");
const cors = require("cors");
const {
    createSessionOptions,
    createSessionStore,
} = require("./config/session");
const { validateTokenEncryptionKey } = require("./config/tokenCrypto");

require("./config/passport");

const authRoutes = require("./routes/authRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

// --------------------------------------------------
// Environment
// --------------------------------------------------

const isProduction = process.env.NODE_ENV === "production";

// Render runs the app behind a reverse proxy.
// Required for secure session cookies in production.
if (isProduction) {
    app.set("trust proxy", 1);
}

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --------------------------------------------------
// CORS
// --------------------------------------------------

const getOrigin = (url) => {
    if (!url) {
        return null;
    }

    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
};

const allowedOrigins = isProduction
    ? [getOrigin(process.env.CLIENT_URL)].filter(Boolean)
    : [
          getOrigin(process.env.CLIENT_URL),
          getOrigin(process.env.LOCAL_CLIENT_URL || "http://localhost:5501/client"),
          "http://localhost:5500",
          "http://127.0.0.1:5500",
          "http://localhost:5501",
          "http://127.0.0.1:5501",
          "http://localhost:5504",
          "http://127.0.0.1:5504",
      ].filter(Boolean);

if (isProduction && !allowedOrigins.length) {
    throw new Error("CLIENT_URL must be configured in production.");
}

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

            return callback(new Error("CORS policy: Origin is not allowed"));
        },
        credentials: true,
    })
);

// CORS controls whether browser code can read a response; this Origin check
// also blocks cross-site form submissions to cookie-authenticated endpoints.
app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({
            success: false,
            message: "Origin is not allowed.",
        });
    }
    next();
});

// --------------------------------------------------
// Session
// --------------------------------------------------

if (!process.env.SESSION_SECRET) {
    throw new Error(
        "SESSION_SECRET is not defined in environment variables"
    );
}

validateTokenEncryptionKey();

app.use(
    session(
        createSessionOptions({
            secret: process.env.SESSION_SECRET,
            isProduction,
            store: createSessionStore(),
        })
    )
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
