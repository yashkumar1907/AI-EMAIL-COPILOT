require("dotenv").config();

const mongoose = require("mongoose");
const { prepareTokenMigration } = require("../services/userTokenService");
const { validateTokenEncryptionKey } = require("../config/tokenCrypto");

const apply = process.argv.includes("--apply");

const run = async () => {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
    validateTokenEncryptionKey();
    await mongoose.connect(process.env.MONGO_URI);

    const users = await mongoose.connection.db
        .collection("users")
        .find({
            $or: [
                { accessToken: { $exists: true, $ne: null } },
                { refreshToken: { $exists: true, $ne: null } },
            ],
        })
        .project({
            accessToken: 1,
            refreshToken: 1,
            accessTokenEncrypted: 1,
            refreshTokenEncrypted: 1,
        })
        .toArray();

    const updates = users
        .map((user) => ({ user, update: prepareTokenMigration(user) }))
        .filter(({ update }) =>
            Object.keys(update.set).length || Object.keys(update.unset).length
        );

    if (apply) {
        for (const { user, update } of updates) {
            await mongoose.connection.db.collection("users").updateOne(
                { _id: user._id },
                {
                    ...(Object.keys(update.set).length ? { $set: update.set } : {}),
                    ...(Object.keys(update.unset).length ? { $unset: update.unset } : {}),
                }
            );
        }
    }

    console.log(
        apply
            ? `OAuth token migration completed for ${updates.length} user record(s).`
            : `Dry run verified ${updates.length} user record(s); no database values changed. Run with --apply to migrate.`
    );
};

run()
    .catch((error) => {
        console.error("OAuth token migration failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
