# Ayavelisa Human Settlements

## Run locally

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Install packages: `pnpm install`
4. Start the API and web app: `pnpm dev`
5. Open `http://localhost:3000`.

The API applies the Prisma schema on startup. Vite proxies `/api` requests to the API on port 4000.

## Run the full app with Docker

Run `docker compose up --build`, then open `http://localhost:3000`. The app waits for PostgreSQL, applies the schema, and serves the web UI and API together. PostgreSQL data is kept in the `pgdata` Docker volume.

The app's current screens share one persisted workspace document in PostgreSQL. Writes use a version check to detect concurrent changes; when a conflict is reported, reload the page to load the latest shared data before continuing. Browser storage remains a local cache and is not the shared source of truth.

## Case and visit workflows

- Visit evidence-source choices are interactive, and editable visit/case forms expose a free-text field when an "Other" option is selected.
- Cases can be created, edited, assigned individually or in bulk, and archived/restored. Archive is a soft delete.
- Reviewers can record a VerifyNow request from a review or case screen. The provider API is not configured in this demo, so requests are explicitly marked `not_configured`; no external check is performed and no result is fabricated.
- Cases and reports can be exported as Excel, PDF, or CSV. A department packet export is a draft download only; it is not submitted to a department system.
- A case is not department-ready based on a recorded request alone. Configure and integrate the real VerifyNow provider before treating external verification as complete.

This is a development/demo setup. It does not yet include user authentication or authorization, and the sample database credentials must be replaced before any network-exposed deployment.
