# Ayavelisa Human Settlements

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BOOTSTRAP_ADMIN_EMAILS`, and the matching `VITE_SUPABASE_*` values.
2. For local-only development without Supabase, leave the Supabase variables unset; the development UI uses demo data and the API remains unauthenticated on localhost.
3. If using a Supabase project, create the initial administrator in Supabase Auth and add its email to `SUPABASE_BOOTSTRAP_ADMIN_EMAILS`.
4. Install packages: `pnpm install`
5. Start the API and web app: `pnpm dev`
6. Open `http://localhost:3000`.

Vite proxies `/api` requests to the API on port 4000. For Supabase, use the transaction-pooler URI (port 6543) for `DATABASE_URL` at runtime and the session-pooler URI (port 5432) for `DIRECT_URL`, which Prisma uses for migrations. Both values are private.

## Run the full app with Docker

Run `docker compose up --build`, then open `http://localhost:3000`. The app waits for PostgreSQL, applies the schema, and serves the web UI and API together. PostgreSQL data is kept in the `pgdata` Docker volume.

The app's current screens share one persisted workspace document in PostgreSQL. Writes use a version check to detect concurrent changes; when a conflict is reported, reload the page to load the latest shared data before continuing. Browser storage remains a local cache and is not the shared source of truth.

## Protected demo deployment

- The repository includes a Render Blueprint for a free demo web service. Connect the GitHub repository in Render and provide the environment variables from `.env.example` in the Render dashboard; never commit live values. Free instances can sleep when idle and take time to wake.
- The Render start command runs `prisma migrate deploy` against Supabase using `DIRECT_URL`; do not apply the same migration manually in the Supabase SQL Editor.
- Enable email/password sign-in in Supabase Auth and keep public sign-ups disabled. Create the first admin user in Supabase Auth; set its exact email in `SUPABASE_BOOTSTRAP_ADMIN_EMAILS`. On its first sign-in, that account is provisioned as an Ayavelisa administrator.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` for session validation, and `SUPABASE_SERVICE_ROLE_KEY` for server-side invitations, linking existing Auth accounts, and looking up managed users to resend access emails. The service-role secret must be a private Render environment variable and must never be exposed to the browser or committed.
- Configure `SUPABASE_BOOTSTRAP_ADMIN_EMAILS`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` in Render. `SUPABASE_SERVICE_ROLE_KEY` is required for invitations, existing-account linking and access-email resends; without it, sign-in and role management still work. The browser build additionally needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. All Supabase variables must refer to the same project.
- In Supabase Auth, configure a production SMTP provider (the default email service is rate-limited and intended for testing), set the production app URL as the Site URL, and add the app URL plus any local development URL to the redirect URL allow-list. Keep email/password sign-in enabled and public sign-ups disabled. Admins can resend signup confirmation to unconfirmed accounts or send a password-recovery email to confirmed accounts; recovery links return to the app, where users set a new password. Never ask for or display an existing password.
- Administrators can invite users by email, link an existing Supabase Auth account when the invitation address is already registered, assign roles, and deactivate/reactivate accounts. User role/status changes are checked by the API and recorded in the user audit table. At least one active administrator must remain.
- Roles are Administrator, Supervisor, Reviewer and Fieldworker. Fieldworkers may update field/intake sections, reviewers may update review/case sections, and supervisors/admins may update all workspace sections. The UI persona switch is available only in local development.
- All authorized accounts share the same workspace data. This demo does not isolate individual cases by user or restrict records by geography/project. Do not enter real beneficiary records until per-record authorization, data minimization, and operational security are implemented and independently validated.

## Case and visit workflows

- Visit evidence-source choices are interactive, and editable visit/case forms expose a free-text field when an "Other" option is selected.
- Cases can be created, edited, assigned individually or in bulk, and archived/restored. Archive is a soft delete.
- Reviewers can record a VerifyNow request from a review or case screen. The provider API is not configured in this demo, so requests are explicitly marked `not_configured`; no external check is performed and no result is fabricated.
- Cases and reports can be exported as Excel, PDF, or CSV. A department packet export is a draft download only; it is not submitted to a department system.
- A case is not department-ready based on a recorded request alone. Configure and integrate the real VerifyNow provider before treating external verification as complete.

Production requires authentication and server-checked role permissions, but all authorized users share the demo workspace. Do not enter real beneficiary records until per-record authorization and data scoping are implemented and independently validated.
