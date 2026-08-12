# oss-backend

Backend service for Anubhav, serves a server-rendered admin panel and a REST API consumed by the frontend.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Auth**: SuperTokens (EmailPassword + Session recipes) for frontend user auth
- **Admin Auth**: Custom session-based auth (express-session + connect-mongo) for the admin panel
- **Templating**: EJS — used exclusively for the admin panel
- **Deployment**: Vercel (serverless)

## Architecture

How the code itself is organised — the `routes → services → models` layering,
where new code belongs, and the conventions we hold PRs to — lives in
[ARCHITECTURE.md](./ARCHITECTURE.md). Read it before your first contribution.

The rest of this section covers the URL surfaces the server exposes.

### API (`/api/anubhav/*`)
REST endpoints consumed by the frontend. CORS is scoped only to these routes — allowed origins are maintained in `constants.js`.

### Auth (`/auth/*`)
SuperTokens handles all frontend authentication routes here. CORS is also applied to this prefix.

### Admin Panel (`/admin/*`)
Server-rendered EJS pages. No CORS — same-origin requests only. Protected by `express-session` backed by MongoDB via `connect-mongo` so sessions persist across Vercel serverless invocations.

## Environments

| Env | URL | `NODE_ENV` |
|-----|-----|------------|
| Staging | `https://oss-backend-staging.vercel.app` | `staging` |
| Production | `https://oss-backend.vercel.app` | `prod` |
| Local | `http://localhost:3000` | `staging` |

## Running Locally

```bash
npm run server
```

Copy `.env.example` to `.env` and fill in the values before running.

## API Docs

Staging: `https://oss-backend-staging.vercel.app/api-docs/`

Use staging for all frontend development and testing.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGOURI` | MongoDB connection string |
| `SESSION_SECRET` | Secret for express-session |
| `ADMINMAIL` | Admin panel login email |
| `ADMINHASH` | Bcrypt hash of admin password |
| `BACKEND_URL` | Internal API base URL (e.g. `http://localhost:3000/api/anubhav` for local) |
| `API_DOMAIN` | Domain this server runs on (used by SuperTokens) |
| `WEBSITE_DOMAIN` | Frontend domain (used by SuperTokens) |
| `SUPERTOKENS_CONNECTION_URI` | SuperTokens managed service URI |
| `SUPERTOKENS_API_KEY` | SuperTokens API key |
| `NODE_ENV` | `staging` locally, `prod` on Vercel |
| `PORT` | Local port (default 3000) |
| `GEMINI_API_KEY` | Gemini key for AI article summaries. Without it the summary endpoints return 503 |

Optional summary tuning: `GEMINI_MODEL` (default `gemini-2.5-flash`),
`GEMINI_TIMEOUT_MS` (default 20000), `SUMMARY_PROCESSING_STALE_MS` (default
120000), `SUMMARY_DEBUG` (`true` logs full summary bodies).
