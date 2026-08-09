const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");

// --------------------------------------------------
// Validate Google OAuth configuration
// --------------------------------------------------

if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not defined");
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET is not defined");
}

if (!process.env.GOOGLE_CALLBACK_URL) {
    throw new Error("GOOGLE_CALLBACK_URL is not defined");
}

// --------------------------------------------------
// Google OAuth Strategy
// --------------------------------------------------

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },

        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || null;
                const profilePicture = profile.photos?.[0]?.value || null;

                if (!email) {
                    return done(
                        new Error("Google account email could not be retrieved"),
                        null
                    );
                }

                let user = await User.findOne({
                    googleId: profile.id,
                });

                // ----------------------------------------------
                // Create new user
                // ----------------------------------------------

                if (!user) {
                    user = await User.create({
                        googleId: profile.id,
                        name: profile.displayName,
                        email,
                        profilePicture,
                        accessToken,
                        refreshToken: refreshToken || null,
                    });
                }

                // ----------------------------------------------
                // Update existing user
                // ----------------------------------------------

                else {
                    user.name = profile.displayName;
                    user.email = email;
                    user.profilePicture = profilePicture;
                    user.accessToken = accessToken;

                    // Google may not return a refresh token
                    // on every login. Preserve the existing one.
                    if (refreshToken) {
                        user.refreshToken = refreshToken;
                    }

                    await user.save();
                }

                return done(null, user);
            } catch (error) {
                console.error("❌ Google OAuth Error:", error.message);
                return done(error, null);
            }
        }
    )
);

// --------------------------------------------------
// Serialize User
// --------------------------------------------------

passport.serializeUser((user, done) => {
    done(null, user.id);
});

// --------------------------------------------------
// Deserialize User
// --------------------------------------------------

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);

        if (!user) {
            return done(null, false);
        }

        done(null, user);
    } catch (error) {
        console.error("❌ User Deserialization Error:", error.message);
        done(error, null);
    }
});