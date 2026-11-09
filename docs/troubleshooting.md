# Troubleshooting

## Development

### "Another next dev server is already running"

Next 16 locks a project directory, regardless of port. Stop the existing server (close the terminal or kill the PID shown in the message), then start again. Do not run `npm run dev` and `npm run test:e2e` simultaneously in this directory.

### First request is slow or times out

The embedded database creates `.data/pgdata`, applies migrations, seeds data and compiles routes on first use. Wait for the first page load, or request `/api/health` first. The Vitest and Playwright timeouts are already raised for this. On a slow machine, allow up to a few minutes for the very first run.

### PGlite lock or data directory errors

Only one process can open `.data/pgdata`. Close dev servers, test runs and stray Node processes. If the local data is disposable, stop everything and run `npm run db:reset`. Do not delete `.data/pgdata` while a process is using it.

### Demo login fails

- Demo accounts exist only in the **embedded** database. If `DATABASE_URL` is set, the seed is refused and those accounts do not exist. Use `npm run admin:bootstrap`.
- If the database was previously seeded with a different date and you want today's scenarios, run `npm run db:reset`.
- Passwords are case-sensitive; copy them from the README table.

### Environment validation error mentioning a URL

Optional URL variables such as `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SUPABASE_URL` reject empty strings. In `.env.local`, either set a complete valid URL or comment the line out.

## Authentication and sessions

### Everyone is signed out after deploy

`AUTH_SECRET` changed (or differs between environments). Set the same strong value for each environment where sessions should persist. Rotating it intentionally invalidates all sessions.

### "AUTH_SECRET is required in production..."

The app refuses to run on Vercel in production with the default development secret. Set `AUTH_SECRET` to a long random string.

### Role changes do not apply

Sessions re-read the profile on every request, so an active role change applies immediately. If the user is deactivated, they are redirected to `/login` on the next request. Clear a stale cookie only if the profile was deleted and a new account reused the email.

### Supabase user cannot sign in

- Confirm the profile exists and `is_active = true`.
- Confirm the profile is linked by Supabase user id **or** by the same email.
- Check that `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are set together.
- Check the Supabase Auth email confirmation state; `admin:bootstrap` creates users with `email_confirm: true`.

## Database

### "DATABASE_URL is required on Vercel"

Serverless deployments cannot use PGlite. Set `DATABASE_URL` to the Supabase pooled connection string.

### Migrations fail through the pooler

Use a direct/session connection (typically port 5432) for `npm run db:migrate`, then switch the runtime to the pooled URL if desired. DDL through a transaction pooler can be rejected by some configurations.

### RLS returns no rows for a direct Supabase client

The policies identify the user through `auth.uid()`, which requires a real Supabase JWT and a matching `profiles` row. The application's services use the privileged server connection and apply their own scope checks; if you add a direct browser client, sign in through Supabase Auth and ensure the profile id matches the auth user id.

### A seeded ID or PO is missing

`db:seed` is a no-op when profiles already exist. Use `db:reset` locally to recreate the demo set. Production starts empty by design.

## Uploads and storage

### Photos disappear after deploy

The local fallback writes to `.data/uploads`, which is ephemeral on Vercel. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, and redeploy.

### "Only JPEG, PNG or WebP images can be uploaded"

HEIC/HEIF are accepted by the type list, but some browsers report a different MIME type. Convert to JPEG/PNG if the error persists. Check `MAX_UPLOAD_MB` too; a non-numeric value breaks the size check.

### Audio uploads but no transcript

Expected without `GEMINI_API_KEY`/`AI_VOICE_ENABLED`. The voice note is still stored/linked and the issue can be submitted. Typed text remains the fallback.

## Buyer portal and sharing

### Buyer sees no updates or photos

Only approved content is visible: updates with `approved_for_buyer = true`, photos explicitly approved, and notifications with status `approved`/`sent`. Ask the merchandiser to approve them from the order's Production/Photos tabs.

### Share link points to localhost

Set `NEXT_PUBLIC_APP_URL` to the public origin (for example `https://your-domain`) and create a new link. Existing links keep the old base URL.

### Share link returns 404

- It expired (1–90 days).
- It was revoked.
- The token was copied incorrectly (the full raw token is required; it is shown only once).
- The order was deleted (cascade removes its tokens).

Create a new link; old hashes cannot be reversed.

## Alerts and delays

### No alert is created for a stage

Alerts are created only for amber/red stages during a scan. A dismissed alert is not recreated for the same warning window. A stage that has not started yet is neutral green. Open `/alerts` or press **Scan now** to run a fresh scan.

### Health looks wrong

Check, in order: the business date/timezone, the working-day setting, the planned date, the target quantity, and whether reports are missing (missing scheduled days count as zero). The Delay tab prints every formula line. AI is never involved.

### An alert keeps coming back after dismissal

A later production change can alter the risk/window, which legitimately reopens an alert. If the stage remains amber/red, confirm it (to notify the buyer) or fix the underlying plan/output.

## Reports

### Reports return 401/403

The endpoint requires a signed-in internal user. Buyers and supervisors cannot download reports; the UI hides the routes, and the API returns 401/403.

### Tamil text is missing in the PDF

PDF exports use standard Helvetica fonts and cover Latin report labels. Free-text Tamil content should be exported to Excel. ExcelJS handles Unicode correctly.

## Tests

### Playwright cannot launch Chromium

Install the browser once:

```bash
npx playwright install chromium
```

### Playwright login times out

Make sure no other dev server holds the project directory, and run the suite serially. The global setup warms `/api/health`; if the machine is very slow, raise `timeout` in `playwright.config.ts` rather than running tests in parallel.

### Vitest hangs or times out on the first file

Each file uses its own PGlite directory and file parallelism is disabled. A timeout usually means a stale process is holding the directory or the machine is under heavy load; stop stray Node processes and rerun.

## Still stuck

Collect: the failing URL/action, the signed-in role, the exact error text, the server console output and whether `DATABASE_URL`/Supabase/AI/Cloudinary are configured. Do not include secrets or raw share tokens in the report.
