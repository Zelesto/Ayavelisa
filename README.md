# Ayavelisa Human Settlements

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ALLOWED_EMAILS`, and the matching `VITE_SUPABASE_*` values.
2. For local-only development without Supabase, leave the Supabase variables unset; the development UI uses demo data and the API remains unauthenticated on localhost.
3. If using a Supabase project, create the approved demo account in Supabase Auth and add its email to `SUPABASE_ALLOWED_EMAILS`.
4. Install packages: `pnpm install`
5. Start the API and web app: `pnpm dev`
6. Open `http://localhost:3000`.

Vite proxies `/api` requests to the API on port 4000. For a Supabase database, use the project's session-pooler connection string as `DATABASE_URL`.

## Run the full app with Docker

Run `docker compose up --build`, then open `http://localhost:3000`. The app waits for PostgreSQL, applies the schema, and serves the web UI and API together. PostgreSQL data is kept in the `pgdata` Docker volume.

The app's current screens share one persisted workspace document in PostgreSQL. Writes use a version check to detect concurrent changes; when a conflict is reported, reload the page to load the latest shared data before continuing. Browser storage remains a local cache and is not the shared source of truth.

## Protected demo deployment

- The repository includes a Render Blueprint for a free demo web service. Connect the GitHub repository in Render and provide the environment variables from `.env.example` in the Render dashboard; never commit live values. Free instances can sleep when idle and take time to wake.
- The Render start command runs `prisma migrate deploy` against Supabase; do not apply the same migration manually in the Supabase SQL Editor.
- Enable email/password sign-in in Supabase Auth, create or invite demo users, and keep `SUPABASE_ALLOWED_EMAILS` restricted to those approved email addresses. Public sign-up should remain disabled.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are used to verify user sessions; the public key is not a database password. Set `DATABASE_URL` to the Supabase session-pooler URI as a private Render environment variable.
- The production API rejects requests to `/api/state` without a valid Supabase session and an allowlisted email. The health endpoint is public and does not return workspace data.
- This is a shared demo workspace, not role-based data access. The demo UI can switch personas; that is not authorization. Do not enter real beneficiary records until role-based permissions and per-record access controls are implemented and independently validated.

## Case and visit workflows

- Visit evidence-source choices are interactive, and editable visit/case forms expose a free-text field when an "Other" option is selected.
- Cases can be created, edited, assigned individually or in bulk, and archived/restored. Archive is a soft delete.
- Reviewers can record a VerifyNow request from a review or case screen. The provider API is not configured in this demo, so requests are explicitly marked `not_configured`; no external check is performed and no result is fabricated.
- Cases and reports can be exported as Excel, PDF, or CSV. A department packet export is a draft download only; it is not submitted to a department system.
- A case is not department-ready based on a recorded request alone. Configure and integrate the real VerifyNow provider before treating external verification as complete.

This is a development/demo setup. It does not yet include user authentication or authorization, and the sample database credentials must be replaced before any network-exposed deployment.
