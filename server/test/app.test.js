const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { createSessionOptions, createSessionStore } = require("../config/session");

const appPath = require.resolve("../app");

function loadApp({ production = false, clientUrl = "", localClientUrl = "" } = {}) {
    process.env.NODE_ENV = production ? "production" : "development";
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.GOOGLE_CALLBACK_URL = "http://localhost:5000/auth/google/callback";
    process.env.GEMINI_API_KEY = "test-gemini-secret";
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.CLIENT_URL = clientUrl;
    process.env.LOCAL_CLIENT_URL = localClientUrl;
    delete require.cache[appPath];
    return require(appPath);
}

test("sessions use MongoDB storage and production-only secure cookie settings", () => {
    const store = createSessionStore();
    assert.equal(typeof store.get, "function");
    assert.equal(typeof store.set, "function");
    assert.equal(typeof store.destroy, "function");

    const production = createSessionOptions({
        secret: "test-session-secret",
        isProduction: true,
        store,
    });
    assert.equal(production.store, store);
    assert.deepEqual(production.cookie, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
    });

    const local = createSessionOptions({
        secret: "test-session-secret",
        isProduction: false,
        store,
    });
    assert.equal(local.cookie.secure, false);
    assert.equal(local.cookie.sameSite, "lax");
});

async function withServer(app, callback) {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
        await callback(`http://127.0.0.1:${server.address().port}`, app);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

test("development health, auth middleware, CORS, and request size behavior", async () => {
    const app = loadApp({ localClientUrl: "http://localhost:5501/client" });
    await withServer(app, async (base) => {
        const health = await fetch(`${base}/health`);
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: "ok" });

        const allowed = await fetch(`${base}/health`, {
            headers: { Origin: "http://localhost:5501" },
        });
        assert.equal(allowed.status, 200);
        assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5501");
        assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");

        const originalErrorForCors = console.error;
        console.error = () => {};
        try {
            const denied = await fetch(`${base}/health`, {
                headers: { Origin: "https://untrusted.example" },
            });
            assert.equal(denied.status, 403);
            assert.deepEqual(await denied.json(), {
                success: false,
                message: "CORS policy: Origin is not allowed",
            });
        } finally {
            console.error = originalErrorForCors;
        }

        const protectedRequests = [
            ["GET", "/gmail/emails"],
            ["GET", "/gmail/email/message-1"],
            ["POST", "/gmail/reply"],
            ["POST", "/gmail/send"],
            ["POST", "/ai/summarize"],
            ["POST", "/ai/draft-reply"],
            ["POST", "/ai/action-items"],
            ["POST", "/ai/translate"],
            ["POST", "/ai/improve-tone"],
            ["POST", "/ai/compose"],
        ];
        for (const [method, endpoint] of protectedRequests) {
            const response = await fetch(`${base}${endpoint}`, {
                method,
                ...(method === "POST"
                    ? {
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: "test" }),
                      }
                    : {}),
            });
            assert.equal(response.status, 401, `${method} ${endpoint} must require authentication`);
        }

        const oversizedBody = JSON.stringify({ body: "x".repeat(1024 * 1024) });
        const originalErrorForOversized = console.error;
        console.error = () => {};
        try {
            const oversized = await fetch(`${base}/gmail/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: oversizedBody,
            });
            assert.equal(oversized.status, 413);
        } finally {
            console.error = originalErrorForOversized;
        }
    });
});

test("production CORS allows only configured frontend origin and requires it", async () => {
    const productionApp = loadApp({
        production: true,
        clientUrl: "https://mailmind.example/app",
    });
    assert.equal(productionApp.get("trust proxy"), 1);

    await withServer(productionApp, async (base) => {
        const allowed = await fetch(`${base}/health`, {
            headers: { Origin: "https://mailmind.example" },
        });
        assert.equal(allowed.status, 200);
        assert.equal(allowed.headers.get("access-control-allow-origin"), "https://mailmind.example");

        const originalError = console.error;
        console.error = () => {};
        try {
            const localhost = await fetch(`${base}/health`, {
                headers: { Origin: "http://localhost:5501" },
            });
            assert.equal(localhost.status, 403);
        } finally {
            console.error = originalError;
        }
    });

    assert.throws(
        () => loadApp({ production: true }),
        /CLIENT_URL must be configured in production/
    );
});
