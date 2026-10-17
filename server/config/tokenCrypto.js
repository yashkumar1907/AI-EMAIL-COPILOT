const crypto = require("node:crypto");

const TOKEN_PREFIX = "enc:v1:";

const getKey = () => {
    const encoded = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encoded) {
        throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
    }

    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
    }
    return key;
};

const encryptToken = (value) => {
    if (value == null || value === "") return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(String(value), "utf8"),
        cipher.final(),
    ]);
    return `${TOKEN_PREFIX}${iv.toString("base64url")}:${cipher
        .getAuthTag()
        .toString("base64url")}:${encrypted.toString("base64url")}`;
};

const decryptToken = (value) => {
    if (value == null || value === "") return null;
    if (!String(value).startsWith(TOKEN_PREFIX)) {
        // Supports legacy records during migration.
        return String(value);
    }

    const [ivPart, tagPart, dataPart, extra] = String(value)
        .slice(TOKEN_PREFIX.length)
        .split(":");
    if (!ivPart || !tagPart || !dataPart || extra !== undefined) {
        throw new Error("Stored OAuth token has an invalid encrypted format.");
    }

    try {
        const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            getKey(),
            Buffer.from(ivPart, "base64url")
        );
        decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
        return Buffer.concat([
            decipher.update(Buffer.from(dataPart, "base64url")),
            decipher.final(),
        ]).toString("utf8");
    } catch {
        throw new Error("Could not decrypt a stored OAuth token; check the encryption key.");
    }
};

module.exports = {
    TOKEN_PREFIX,
    encryptToken,
    decryptToken,
    validateTokenEncryptionKey: getKey,
};
