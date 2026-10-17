# AI Email Copilot

AI Email Copilot is a static HTML/CSS/JavaScript frontend with an Express backend. Google OAuth provides Gmail read/send access, MongoDB stores users and sessions, and Gemini powers the email assistance workflows.

## Prerequisites

- Node.js 20 or newer and npm
- MongoDB (Atlas or a reachable MongoDB server)
- Google Cloud OAuth web client with the Gmail API enabled
- Gemini API key

## Local setup

1. Install backend dependencies from the project root:

   ```sh
   npm install --prefix server
   ```

2. Copy `server/.env.example` to `server/.env` and set each required value. Generate a session secret and token encryption key without putting either in source control:

   ```sh
   openssl rand -hex 32
   openssl rand -base64 32
   ```

   Use the hex output for `SESSION_SECRET` and base64 output for `TOKEN_ENCRYPTION_KEY`. Set `MONGO_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GEMINI_API_KEY`. The local callback is `http://localhost:5000/auth/google/callback`.

3. In Google Cloud, enable Gmail API, configure the OAuth consent screen, add your account as a test user if the app is in testing, and register the exact callback URI under the OAuth web client’s **Authorized redirect URIs**.

4. Start the backend and static frontend in separate terminals, from the repository root:

   ```sh
   npm run dev --prefix server
   python3 -m http.server 5501
   ```

5. Open <http://localhost:5501/client/login.html>. Use `localhost` consistently so it matches the configured OAuth callback. Backend health is <http://localhost:5000/health>.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string for users and persistent sessions |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `TOKEN_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte AES-256-GCM key for Google OAuth tokens |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth web client secret; backend only |
| `GOOGLE_CALLBACK_URL` | Yes | Exact OAuth callback URL registered with Google |
| `GEMINI_API_KEY` | Yes | Gemini API key; backend only |
| `CLIENT_URL` | Yes in production | Frontend origin; path is accepted but CORS compares the origin |
| `PORT` | No | Backend listener port; Render supplies this in production, local default is `5000` |
| `NODE_ENV` | No | Set to `production` on Render |
| `LOCAL_CLIENT_URL` | No | Optional local redirect target; defaults to `http://localhost:5501/client` |

The Gemini model is configured in `server/config/gemini.js`. Do not place any backend credentials in `client/` or static-site environment variables.

## Render deployment

Create a Render **Web Service** for the backend:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Environment: `NODE_ENV=production`
- Set `MONGO_URI`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, and `GEMINI_API_KEY` as secret/environment values.
- Set `CLIENT_URL` to the frontend’s origin, for example `https://ai-email-copilot-frontend.onrender.com`.
- Do not set `PORT` manually unless your Render service setup requires it.

Create a Render **Static Site** for the frontend:

- Root directory: `client`
- Build command: leave blank
- Publish directory: `.`
- The site root redirects from `index.html` to `login.html`.

For the currently configured Render host names, use these values if those are the actual service URLs:

- Frontend origin (`CLIENT_URL`): `https://ai-email-copilot-frontend.onrender.com`
- Backend API base: `https://ai-email-copilot-backend.onrender.com` (currently embedded in `client/js/login.js` and `client/js/dashboard.js`)
- Google callback (`GOOGLE_CALLBACK_URL`): `https://ai-email-copilot-backend.onrender.com/auth/google/callback`

Register the production callback URI under the OAuth web client’s **Authorized redirect URIs**. Keep the local callback registered separately for local testing. After deployment, verify `https://<backend-host>/health`, then visit `https://<frontend-host>/login.html` and complete the manual sign-in and email workflow.

## OAuth token encryption and migration

OAuth access and refresh tokens are encrypted with AES-256-GCM before they are written to MongoDB. `TOKEN_ENCRYPTION_KEY` must be the same base64-encoded 32-byte value on every backend instance. Store it in Render’s secret environment settings or a managed secret manager, restrict access, back it up securely, and never log or commit it. Losing it makes encrypted tokens unreadable and users must authorize again. Changing it requires a deliberate decrypt/re-encrypt key-rotation procedure; do not replace it casually.

Existing MongoDB documents may still contain plaintext token fields. The migration supports a dry run and an explicit apply step. Back up MongoDB first, deploy code that can read both old and encrypted token fields, configure the same `TOKEN_ENCRYPTION_KEY`, then run from the backend service shell or a trusted machine using the target database URI:

```sh
cd server
npm run migrate:oauth-tokens
npm run migrate:oauth-tokens -- --apply
```

The first command verifies and reports a count without changing data. The second writes encrypted fields and unsets the legacy plaintext fields. Keep a protected backup until you have confirmed login, inbox access, token refresh, and rollback requirements. Do not run this command against production until the backup and target database have been confirmed.

## Security and release notes

- Sessions use MongoDB’s `sessions` collection rather than Express’s development-only in-memory store.
- Production cookies are `Secure`, `HttpOnly`, and `SameSite=None`; the Express app trusts one proxy hop for Render HTTPS termination.
- Gmail endpoints and AI endpoints require an authenticated session. Production CORS only allows the configured `CLIENT_URL` origin.
- `gmail.readonly` is a restricted Google scope and `gmail.send` is sensitive. Public distribution may require Google OAuth verification; restricted-scope server storage/transmission can also require a security assessment. Review Google’s current [Gmail API scope guidance](https://developers.google.com/workspace/gmail/api/auth/scopes) and [OAuth verification guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
- Automated tests use mocked provider behavior. They do not send mail or access a real mailbox.

Run tests with:

```sh
npm test --prefix server
```
