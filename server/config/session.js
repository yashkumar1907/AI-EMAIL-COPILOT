const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");

const SESSION_TTL_SECONDS = 24 * 60 * 60;

const createMongoClientPromise = () =>
    new Promise((resolve) => {
        const resolveClient = () => resolve(mongoose.connection.getClient());
        if (mongoose.connection.readyState === 1) {
            resolveClient();
        } else {
            mongoose.connection.once("connected", resolveClient);
        }
    });

const createSessionStore = () =>
    MongoStore.create({
        clientPromise: createMongoClientPromise(),
        collectionName: "sessions",
        ttl: SESSION_TTL_SECONDS,
        autoRemove: "native",
    });

const createSessionOptions = ({ secret, isProduction, store }) => ({
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        maxAge: SESSION_TTL_SECONDS * 1000,
    },
});

module.exports = {
    SESSION_TTL_SECONDS,
    createSessionStore,
    createSessionOptions,
};
