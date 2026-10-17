const { decryptToken, encryptToken } = require("../config/tokenCrypto");

const readGoogleTokens = (user) => ({
    accessToken: decryptToken(user.accessTokenEncrypted || user.accessToken),
    refreshToken: decryptToken(user.refreshTokenEncrypted || user.refreshToken),
});

const writeGoogleTokens = (user, { accessToken, refreshToken }) => {
    if (accessToken !== undefined) {
        user.accessTokenEncrypted = encryptToken(accessToken);
        user.accessToken = null;
    }
    if (refreshToken !== undefined) {
        user.refreshTokenEncrypted = encryptToken(refreshToken);
        user.refreshToken = null;
    }
};

const prepareTokenMigration = (document) => {
    const set = {};
    const unset = {};

    for (const [plainField, encryptedField] of [
        ["accessToken", "accessTokenEncrypted"],
        ["refreshToken", "refreshTokenEncrypted"],
    ]) {
        const currentEncrypted = document[encryptedField];
        const legacyPlain = document[plainField];
        if (currentEncrypted) {
            if (legacyPlain && decryptToken(currentEncrypted) !== legacyPlain) {
                throw new Error("Encrypted and legacy OAuth token values do not match.");
            }
            if (legacyPlain) unset[plainField] = "";
            continue;
        }
        if (legacyPlain) {
            const encrypted = encryptToken(legacyPlain);
            if (decryptToken(encrypted) !== legacyPlain) {
                throw new Error("OAuth token encryption verification failed.");
            }
            set[encryptedField] = encrypted;
            unset[plainField] = "";
        }
    }

    return { set, unset };
};

module.exports = {
    readGoogleTokens,
    writeGoogleTokens,
    prepareTokenMigration,
};
