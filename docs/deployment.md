# Deployment

The application is designed for Vercel (Next.js) plus Supabase (Postgres/Auth). It can also run on any Node host with a Postgres database.

## Prerequisites

- A Supabase project (or any PostgreSQL 14+ database).
- A Vercel project connected to this repository.
- Node 20+ for local build and maintenance scripts.

## 1. Database

Create the schema in the hosted database:

```bash
DATABASE_URL="postgresql://postgres.<project>:<password>@<host>:5432/postgres" npm run db:migrate
```

- Use a **direct/session** connection for migrations if the transaction pooler rejects DDL. The runtime can then use the pooled connection string.
- Migrations create all 20 tables, constraints, indexes, RLS policies, helper functions and the default settings. Applied files are recorded in `public._migrations`, so the command is idempotent.
- The local bootstrap (`auth.users` shim, `auth.uid()`) is **not** applied to hosted Postgres; Supabase provides those.

## 2. Supabase Auth (optional but recommended)

If you want Supabase to own credentials:

1. Enable the Email provider in Supabase Authentication.
2. Collect the project URL and publishable/anon key for the browser-side auth client.
3. Keep the service-role secret server-side only.

The application uses Supabase Auth when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key) are present. On sign-in it validates against Supabase, then maps the Supabase user to `profiles` by id or email.

If you prefer the built-in bcrypt + JWT sign-in, omit the Supabase Auth variables. `AUTH_SECRET` then signs the `ca_session` cookie.

## 3. First Super Admin

Demo accounts are refused on a hosted database. Create the first admin:

```bash
DATABASE_URL="postgresql://..." \
SUPABASE_SECRET_KEY="..." \
npm run admin:bootstrap -- \
  --email=admin@company-a.example \
  --password="A-long-unique-password" \
  --name="Operations Admin"
```

- With Supabase Auth configured, the script creates/links the Supabase user through the Admin API.
- Without it, the script writes a bcrypt hash and the local sign-in path is used.
- Re-running with the same email promotes/repairs the existing profile.
- Create every other user, buyer, unit, stage and template from the UI.

## 4. Vercel environment

Set these in **Project → Settings → Environment Variables** for Production and Preview:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase pooler connection string, server-only |
| `AUTH_SECRET` | Yes | Long random value; the app refuses the insecure default in production on Vercel |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-domain`; used for share links and redirects |
| `BUSINESS_TIMEZONE` | Recommended | `Asia/Kolkata` default |
| `NEXT_PUBLIC_SUPABASE_URL` | If using Supabase Auth | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | If using Supabase Auth | Public publishable/anon key |
| `SUPABASE_SECRET_KEY` | If using Supabase Auth + bootstrap | Server-only service role |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Recommended | Durable photo storage |
| `OPENAI_API_KEY` | Optional | Enables AI classification/transcription |
| `AI_CLASSIFICATION_ENABLED` / `AI_VOICE_ENABLED` | Optional | Explicit feature switches |
| `MAX_UPLOAD_MB` | Optional | Image limit, default 8 |

Never add `NEXT_PUBLIC_` to a secret, and never commit `.env.local`.

## 5. Build and deploy

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Vercel runs the build automatically. The Next config marks `pg` and `@electric-sql/pglite` as server externals and includes `supabase/migrations/**/*.sql` in the server output trace.

After the first deploy, verify:

- `GET /api/health` returns `{ "status": "ok", "database": "postgres" }`.
- `/login` accepts the bootstrapped admin.
- A created order appears with its TNA milestones.
- Reports download as xlsx and pdf.
- A share link resolves in a private window and 404s after revocation.

## Embedded database is local-only

Without `DATABASE_URL`, the app uses PGlite at `.data/pgdata`. On Vercel (`VERCEL=1`) `assertDatabaseConfigured()` throws instead of silently writing to an ephemeral filesystem. Do not attempt to run PGlite in a serverless deployment.

## Storage on serverless

The local storage fallback writes to `.data/uploads`, which is **not durable** on Vercel: instances are ephemeral and the filesystem is not shared. Configure Cloudinary for production photo and voice-note storage. Without it, uploads may disappear after a deploy or between instances.

## PWA deployment

- The manifest is served by `src/app/manifest.ts` at `/manifest.webmanifest`.
- `public/sw.js` is a static file; the service worker is registered only when `NODE_ENV=production`, so it activates on Vercel but not in `npm run dev`.
- Service workers require HTTPS (Vercel provides it) or localhost.
- Bump `CACHE_VERSION` in `public/sw.js` when changing cached shell assets.
- The offline page is precached at install; application data is queued in IndexedDB per device, not synced across devices.

## Alerts and scheduling

There is no background worker in this deployment. `scanDelayAlerts` runs when an internal user opens `/alerts` or presses **Scan now**, and alert state is also refreshed during alert actions. If you need scans without anyone visiting the app, add an external scheduler that triggers the scan (for example a protected route or serverless cron) before relying on unattended alerting.

## Backups and retention

- Use Supabase's automated backups/PITR for the database.
- Audit and date-history rows are append-only from the app; retention is controlled by your database policy.
- `.data/pgdata` is local development data and is git-ignored. Back it up only if you need to preserve a local evaluation state.

## Rollback

- Application rollback: redeploy a previous Vercel deployment.
- Database: migrations are forward-only and additive in this version. Restore from a Supabase backup if a schema rollback is required.
- Environment: changing `AUTH_SECRET` invalidates all existing sessions (users must sign in again).

## Related reading

- [Environment](environment.md)
- [Operations](operations.md)
- [Troubleshooting](troubleshooting.md)
