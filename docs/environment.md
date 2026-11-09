# Environment variables

Configuration is read once per server process by `src/lib/env.ts`. Invalid values abort the first database/server request with a clear message rather than failing silently. `.env.example` contains a commented template; local development needs no variables at all.

## App

| Variable | Default | Purpose / failure mode |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` or `https://$VERCEL_URL` | Absolute origin used in share links and redirects. If set, it must be a valid URL; an empty value is invalid. |
| `BUSINESS_TIMEZONE` | `Asia/Kolkata` | IANA timezone used for the business date and "today" validation. An invalid zone falls through to runtime date errors; set a real zone. |

## Database

| Variable | Default | Purpose / failure mode |
| --- | --- | --- |
| `DATABASE_URL` | unset | Hosted Postgres/Supabase connection string. Unset → embedded PGlite at `.data/pgdata`. On Vercel, unset → startup error. Server-only; never expose with `NEXT_PUBLIC_`. |
| `SEED_DEMO_DATA` | `true` when no `DATABASE_URL` | Controls demo-data seeding in embedded PGlite and demo-credential visibility on the login page. Hosted databases are never seeded automatically. Accepted truthy values: `1`, `true`, `yes`, `on`. |
| `PGLITE_DATA_DIR` | `.data/pgdata` | Local/embedded data directory. Also used by tests and the E2E server to isolate databases. Not needed in production. |

## Authentication

| Variable | Default | Purpose / failure mode |
| --- | --- | --- |
| `AUTH_SECRET` | `dev-only-insecure-secret-change-me` | HS256 signing key for the `ca_session` cookie. Production on Vercel must set a strong value; the default is rejected there. Changing it signs everyone out. |
| `NEXT_PUBLIC_SUPABASE_URL` | unset | Enables Supabase Auth when combined with a publishable key. Must be a valid URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | unset | Supabase publishable/anon key. Public by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | unset | Legacy alias accepted when the publishable key is absent. |
| `SUPABASE_SECRET_KEY` | unset | Server-only service-role secret. Required for Supabase admin/bootstrapping; never used in browser code. |
| `SUPABASE_SERVICE_ROLE_KEY` | unset | Legacy alias accepted when `SUPABASE_SECRET_KEY` is absent. |

If a Supabase URL is configured without a secret, sign-in still works with the public key; only admin operations such as `admin:bootstrap` require the secret. If the URL/publishable key are absent, local bcrypt + JWT sign-in is used.

## Storage

| Variable | Default | Purpose / failure mode |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | unset | Cloudinary uploads are enabled only when all three values are set. |
| `CLOUDINARY_API_KEY` | unset | Public API key for the signed upload. |
| `CLOUDINARY_API_SECRET` | unset | Server-only signing secret. |
| `MAX_UPLOAD_MB` | `8` | Maximum image size in MB. Non-numeric values become `NaN` and make every image fail the size check; use an integer. Voice notes have a fixed 12 MB limit. |

Without Cloudinary, files go to `.data/uploads` and are served by `/api/files/[filename]`. This is local-only storage; configure Cloudinary on serverless.

## AI (optional, server-side)

| Variable | Default | Purpose / failure mode |
| --- | --- | --- |
| `GEMINI_API_KEY` | unset | Enables Gemini AI when longer than 10 characters. Never exposed to the browser. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model used for classification. |
| `GEMINI_TRANSCRIPTION_MODEL` | `gemini-2.5-flash` | Gemini model used for Tamil audio transcription. |
| `AI_CLASSIFICATION_ENABLED` | inferred from the key | Explicitly disable/enable classification. |
| `AI_VOICE_ENABLED` | inferred from the key | Explicitly disable/enable transcription. |

AI failures fall back to the heuristic classifier or no transcript; production updates are never blocked.

## Boolean parsing

`SEED_DEMO_DATA`, `AI_CLASSIFICATION_ENABLED` and `AI_VOICE_ENABLED` are parsed from strings. `1`, `true`, `yes` and `on` (case-insensitive) are true; anything else non-empty is false; an empty or absent value falls back to the default.

## Supabase connection strings

For the runtime, use the pooled connection string from **Supabase → Project Settings → Database → Connection pooling**. Use a direct/session connection for migrations if the pooler rejects DDL. Include `?sslmode=require` if your provider requires it; the `pg` client sets `rejectUnauthorized: false` for non-local hosts.

## Precedence

- Local `.env.local` values override the process environment in `next dev`/`next start`.
- Vercel environment variables are the production source of truth; do not commit `.env` files.
- Environment is validated on first use, not at module import, so a broken optional variable surfaces on the request that needs it.

## Related reading

- [Deployment](deployment.md)
- [Troubleshooting](troubleshooting.md)
- [AI assistance](ai-assistance.md)
