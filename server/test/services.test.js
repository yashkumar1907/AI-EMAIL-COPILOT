const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

process.env.GEMINI_API_KEY = "test-gemini-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:5000/auth/google/callback";
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const gmailState = {
    calls: [],
    oauthClients: [],
    api: null,
};

class MockOAuth2 {
    constructor(...args) {
        this.args = args;
        this.tokenListener = null;
        this.credentials = null;
        gmailState.oauthClients.push(this);
    }

    setCredentials(credentials) {
        this.credentials = credentials;
    }

    on(event, listener) {
        if (event === "tokens") this.tokenListener = listener;
    }
}

const mockedGoogleapis = {
    google: {
        auth: { OAuth2: MockOAuth2 },
        gmail: ({ auth }) => {
            gmailState.auth = auth;
            return gmailState.api;
        },
    },
};

const geminiState = {
    calls: [],
    handler: async () => ({ text: "test response" }),
    apiKey: null,
};

class MockGoogleGenAI {
    constructor({ apiKey }) {
        geminiState.apiKey = apiKey;
        this.models = {
            generateContent: async (request) => {
                geminiState.calls.push(request);
                return geminiState.handler(request);
            },
        };
    }
}

function requireWithMock(relativePath, mocks) {
    const target = require.resolve(relativePath);
    delete require.cache[target];
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (parent?.filename === target && Object.hasOwn(mocks, request)) {
            return mocks[request];
        }
        return originalLoad.call(this, request, parent, isMain);
    };
    try {
        return require(target);
    } finally {
        Module._load = originalLoad;
    }
}

const gmailService = requireWithMock(path.join(__dirname, "../services/gmailService"), {
    googleapis: mockedGoogleapis,
});
const geminiService = requireWithMock(path.join(__dirname, "../services/geminiService"), {
    "@google/genai": { GoogleGenAI: MockGoogleGenAI },
});

const makeGmailApi = (overrides = {}) => ({
    users: {
        messages: {
            list: async (request) => {
                gmailState.calls.push({ method: "list", request });
                return { data: { messages: [{ id: "message-1" }] } };
            },
            get: async (request) => {
                gmailState.calls.push({ method: "get", request });
                if (request.format === "full") {
                    return { data: { id: request.id, threadId: "thread-1", payload: {} } };
                }
                return {
                    data: {
                        threadId: "thread-1",
                        snippet: "short preview",
                        payload: {
                            headers: [
                                { name: "Subject", value: "A subject" },
                                { name: "From", value: "Sender <sender@example.com>" },
                                { name: "Date", value: "Sat, 17 Oct 2026 10:00:00 +0000" },
                            ],
                        },
                    },
                };
            },
            send: async (request) => {
                gmailState.calls.push({ method: "send", request });
                return { data: { id: "sent-message" } };
            },
            ...overrides,
        },
    },
});

const makeUser = () => ({
    accessToken: "stored-access-token",
    refreshToken: "stored-refresh-token",
    saves: 0,
    async save() { this.saves += 1; },
});

const silenceServiceLogs = async (callback) => {
    const original = console.error;
    console.error = () => {};
    try {
        return await callback();
    } finally {
        console.error = original;
    }
};

test("Gmail OAuth client uses configured credentials and persists refreshed tokens", async () => {
    gmailState.calls = [];
    gmailState.oauthClients = [];
    gmailState.api = makeGmailApi({ list: async () => ({ data: { messages: [] } }) });
    const user = makeUser();

    assert.deepEqual(await gmailService.getRecentEmails(user), []);
    const oauth = gmailState.oauthClients.at(-1);
    assert.deepEqual(oauth.args, [
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL,
    ]);
    assert.deepEqual(oauth.credentials, {
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
    });
    await oauth.tokenListener({ access_token: "refreshed-access-token" });
    const { readGoogleTokens } = require("../services/userTokenService");
    assert.equal(readGoogleTokens(user).accessToken, "refreshed-access-token");
    assert.equal(user.accessToken, null);
    assert.equal(user.saves, 1);
});

test("OAuth token encryption authenticates ciphertext and supports verified plaintext migration", () => {
    const { encryptToken, decryptToken } = require("../config/tokenCrypto");
    const { prepareTokenMigration } = require("../services/userTokenService");
    const encrypted = encryptToken("sensitive-google-token");
    assert.notEqual(encrypted, "sensitive-google-token");
    assert.equal(decryptToken(encrypted), "sensitive-google-token");
    const parts = encrypted.split(":");
    parts[4] = `${parts[4][0] === "A" ? "B" : "A"}${parts[4].slice(1)}`;
    assert.throws(() => decryptToken(parts.join(":")), /Could not decrypt/);

    const migration = prepareTokenMigration({
        _id: "user-id",
        accessToken: "legacy-access",
        refreshToken: "legacy-refresh",
    });
    assert.equal(decryptToken(migration.set.accessTokenEncrypted), "legacy-access");
    assert.equal(decryptToken(migration.set.refreshTokenEncrypted), "legacy-refresh");
    assert.deepEqual(migration.unset, { accessToken: "", refreshToken: "" });
});

test("Gmail inbox and detail requests preserve the expected API fields", async () => {
    gmailState.calls = [];
    gmailState.api = makeGmailApi();
    const user = makeUser();

    const messages = await gmailService.getRecentEmails(user);
    assert.deepEqual(messages, [{
        id: "message-1",
        threadId: "thread-1",
        subject: "A subject",
        from: "Sender <sender@example.com>",
        date: "Sat, 17 Oct 2026 10:00:00 +0000",
        snippet: "short preview",
    }]);
    assert.deepEqual(gmailState.calls[0], {
        method: "list",
        request: { userId: "me", labelIds: ["INBOX"], maxResults: 10 },
    });
    assert.equal(gmailState.calls[1].request.format, "metadata");

    const email = await gmailService.getEmailById(user, "message-1");
    assert.equal(email.id, "message-1");
    assert.equal(gmailState.calls.at(-1).request.format, "full");
});

test("Gmail send and reply create plain-text MIME requests without making real calls", async () => {
    gmailState.calls = [];
    gmailState.api = makeGmailApi();
    const user = makeUser();

    await gmailService.sendEmail(user, "person@example.com", "Hello", "Plain body");
    await gmailService.replyToEmail(
        user,
        "thread-1",
        "Sender <sender@example.com>",
        "Hello",
        "Reply body",
        "<original@example.com>",
        "<older@example.com>"
    );

    const sends = gmailState.calls.filter((call) => call.method === "send");
    const decode = (raw) => Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const composeMime = decode(sends[0].request.requestBody.raw);
    const replyMime = decode(sends[1].request.requestBody.raw);
    assert.match(composeMime, /To: person@example\.com/);
    assert.match(composeMime, /Subject: Hello/);
    assert.match(composeMime, /Content-Type: text\/plain; charset=utf-8/);
    assert.match(composeMime, /Plain body$/);
    assert.match(replyMime, /To: Sender <sender@example\.com>/);
    assert.match(replyMime, /Subject: Hello/);
    assert.match(replyMime, /In-Reply-To: <original@example\.com>/);
    assert.match(replyMime, /References: <older@example\.com> <original@example\.com>/);
    assert.equal(sends[1].request.requestBody.threadId, "thread-1");
});

test("Gmail rejects malformed recipient, header injection, empty body, and oversized message", async () => {
    const newline = String.fromCharCode(13, 10);
    const invalid = [
        ["not-an-address", "Subject", "Body"],
        ["person@example.com", "", "Body"],
        ["person@example.com", `Hello${newline}Bcc: victim@example.com`, "Body"],
        ["person@example.com", "Subject", "  "],
        ["person@example.com", "Subject", "x".repeat(100001)],
    ];
    for (const fields of invalid) {
        await assert.rejects(gmailService.sendEmail(makeUser(), ...fields), { statusCode: 400 });
    }
    await assert.rejects(
        gmailService.replyToEmail(makeUser(), "thread-1", "person@example.com", "Subject", "Body", "bad-message-id", ""),
        { statusCode: 400 }
    );
    await assert.rejects(
        gmailService.replyToEmail(makeUser(), "thread-1", "person@example.com", "Subject", "Body", "<message@example.com>", `ok${newline}Bcc: victim@example.com`),
        { statusCode: 400 }
    );
});

test("Gmail provider errors map to useful safe HTTP statuses", async () => {
    for (const [providerStatus, expectedStatus, expectedMessage] of [
        [401, 401, /authorization expired/i],
        [403, 403, /permissions/i],
        [429, 429, /rate limit/i],
        [503, 503, /try again shortly/i],
    ]) {
        gmailState.api = makeGmailApi({
            list: async () => { throw Object.assign(new Error("private@example.com provider detail"), { response: { status: providerStatus } }); },
        });
        const error = await silenceServiceLogs(() => gmailService.getRecentEmails(makeUser()).catch((caught) => caught));
        assert.equal(error.statusCode, expectedStatus);
        assert.match(error.message, expectedMessage);
        assert.doesNotMatch(error.message, /private@example\.com|provider detail/);
    }

    gmailState.api = makeGmailApi({
        get: async () => { throw Object.assign(new Error("not found"), { response: { status: 404 } }); },
    });
    await assert.rejects(gmailService.getEmailById(makeUser(), "missing"), { statusCode: 404 });
    await assert.rejects(gmailService.getRecentEmails(null), { statusCode: 401 });
    await assert.rejects(gmailService.getRecentEmails({}), { statusCode: 401 });
});

test("Gemini workflows send the configured model and normalize action items", async () => {
    geminiState.calls = [];
    geminiState.handler = async () => ({ text: "generated result" });
    assert.equal(geminiState.apiKey, process.env.GEMINI_API_KEY);

    assert.equal(await geminiService.summarizeEmail("summary source"), "generated result");
    assert.equal(await geminiService.generateDraftReply("reply source"), "generated result");
    geminiState.handler = async () => ({ text: "[]" });
    assert.equal(await geminiService.extractActionItems("actions source"), "No action items found.");
    geminiState.handler = async () => ({ text: "generated result" });
    assert.equal(await geminiService.translateEmail("translation source", "Hindi"), "generated result");
    assert.equal(await geminiService.improveTone("tone source", "Friendly"), "generated result");
    assert.equal(await geminiService.composeEmail("compose request", "to@example.com", "Subject"), "generated result");

    assert.equal(geminiState.calls.length, 6);
    assert.ok(geminiState.calls.every((call) => call.model === geminiService.MODEL));
    assert.match(geminiState.calls[0].contents, /summary source/);
    assert.match(geminiState.calls[1].contents, /reply source/);
    assert.match(geminiState.calls[3].contents, /Target language: Hindi/);
    assert.match(geminiState.calls[4].contents, /Requested tone: Friendly/);
    assert.match(geminiState.calls[5].contents, /compose request/);
});

test("Gemini errors are categorized and do not expose the API key or email addresses", async () => {
    geminiState.handler = async () => {
        throw Object.assign(new Error(`key=${process.env.GEMINI_API_KEY} person@example.com`), { status: 429 });
    };
    const original = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args.join(" "));
    try {
        await assert.rejects(geminiService.summarizeEmail("source"), (error) => {
            assert.equal(error.statusCode, 429);
            assert.equal(error.category, "quota_or_rate_limit");
            assert.doesNotMatch(error.message, /test-gemini-secret|person@example\.com/);
            return true;
        });
    } finally {
        console.error = original;
    }
    assert.doesNotMatch(logs.join(" "), /test-gemini-secret|person@example\.com/);

    geminiState.handler = async () => ({ text: "   " });
    await assert.rejects(geminiService.summarizeEmail("source"), {
        statusCode: 502,
        category: "empty_response",
    });

    for (const [providerStatus, expectedStatus, category] of [
        [401, 503, "authentication"],
        [403, 503, "access_or_billing"],
        [404, 503, "model_or_endpoint"],
        [429, 429, "quota_or_rate_limit"],
        [503, 503, "temporarily_unavailable"],
        [500, 502, "provider_failure"],
    ]) {
        geminiState.handler = async () => {
            throw Object.assign(new Error("safe provider detail"), { status: providerStatus });
        };
        const error = await silenceServiceLogs(() => geminiService.summarizeEmail("source").catch((caught) => caught));
        assert.equal(error.statusCode, expectedStatus);
        assert.equal(error.category, category);
        assert.match(error.message, /Gemini|quota/i);
    }
});

test("Google OAuth strategy uses a session-backed state store", () => {
    const target = require.resolve("../config/passport");
    delete require.cache[target];
    const passport = require("passport");
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
        if (parent?.filename === target && request === "../models/User") return {};
        return originalLoad.call(this, request, parent, isMain);
    };
    try {
        require(target);
    } finally {
        Module._load = originalLoad;
    }
    assert.equal(passport._strategy("google")._stateStore.constructor.name, "SessionStore");
});

test("email inline-style sanitizer preserves basic formatting and strips active CSS", () => {
    const dashboard = fs.readFileSync(path.join(__dirname, "../../client/js/dashboard.js"), "utf8");
    const start = dashboard.indexOf("function sanitizeEmailStyle(styleText) {");
    const end = dashboard.indexOf("\n}\n\nfunction sanitizeEmailHTML", start) + 2;
    assert.ok(start >= 0 && end > start, "style sanitizer source should be present");
    const getSanitizer = vm.runInNewContext(`(() => { ${dashboard.slice(start, end)}; return sanitizeEmailStyle; })()`);

    const safe = getSanitizer("color: #123456; font-size: 14px; padding: 8px; background-image: url(https://tracker.example/pixel); position: fixed; display: none");
    assert.match(safe, /color: #123456/);
    assert.match(safe, /font-size: 14px/);
    assert.match(safe, /padding: 8px/);
    assert.doesNotMatch(safe, /url\(|position|display/);
});

test("frontend selectors are present and Gemini secrets stay backend-only", () => {
    const dashboard = fs.readFileSync(path.join(__dirname, "../../client/js/dashboard.js"), "utf8");
    const markup = fs.readFileSync(path.join(__dirname, "../../client/dashboard.html"), "utf8");
    const selectors = [...dashboard.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
    const missing = [...new Set(selectors)].filter((id) => !new RegExp(`\\bid=["']${id}["']`).test(markup));
    assert.equal(missing.length, 0, `missing dashboard IDs: ${missing.join(", ")}`);

    const clientFiles = ["dashboard.html", "login.html", "js/dashboard.js", "js/login.js"];
    for (const file of clientFiles) {
        const source = fs.readFileSync(path.join(__dirname, "../../client", file), "utf8");
        assert.doesNotMatch(source, /GEMINI_API_KEY|GOOGLE_CLIENT_SECRET/);
    }
});
