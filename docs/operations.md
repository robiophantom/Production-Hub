# Operations

## Daily checks

1. **Health** — `GET /api/health` returns `{ "status": "ok", "database": "embedded" | "postgres", "time": ... }`; a 503 means the database is unreachable.
2. **Alerts** — open `/alerts`; the page runs a scan and shows how many alerts were created/updated/resolved. Review red first, then amber, then the 14-day window.
3. **Supervisor submissions** — check `/supervisor/history` for missing days or a large offline backlog; missing scheduled days count as zero in the delay engine.
4. **Buyer notifications** — pending drafts are not visible to buyers. Confirm only when the message is accurate; confirmation publishes the approved notice.
5. **Photos** — approve buyer-visible photos only after checking the image. Approval is per photo and reversible.

## Alert runbook

| Situation | Action |
| --- | --- |
| Red alert is accurate | **Confirm** → an approved buyer notification is created. Review the generated message first. |
| Red alert is a data problem (wrong quantity/date) | Fix the production update/TNA, then rescan; do not dismiss a real delay without a reason. |
| Alert is expected and accepted | **Dismiss** with a reason ≥ 5 characters; the alert is not recreated for the same warning window. |
| Alert resolved by production | The next scan marks it resolved automatically. |
| Alert is amber for insufficient data | Ask the supervisor to submit the missing daily updates; the next scan re-evaluates. |

Confirmation/dismissal requires Super Admin or the assigned Merchandiser and is audited.

## Seed and reset (local)

```bash
npm run db:seed        # create demo data if empty; print demo accounts
npm run db:reset       # delete .data/pgdata and recreate with today's date
```

Stop the dev server before `db:reset` so PGlite is not holding the data directory. Never run `db:seed` with `DATABASE_URL` set; it refuses by design.

## Migrations

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

- Idempotent; records applied files in `public._migrations`.
- Back up the database before schema changes.
- Local embedded databases migrate automatically on first `getDb()`.
- Migrations are forward-only; restoring a backup is the rollback path.

## First admin / lockout recovery

```bash
npm run admin:bootstrap -- --email=admin@company-a.example \
  --password="A-long-unique-password" --name="Operations Admin"
```

Requires `DATABASE_URL`. With Supabase Auth configured, also set `SUPABASE_SECRET_KEY`. Re-running with the same email promotes/repairs the profile and audits the action. The password is never logged.

## User lifecycle

- Create users in **Administration → Users & roles**; set unit scope for supervisors and buyer company for buyers.
- Deactivation takes effect on the next request (the session re-reads the profile).
- Role changes are audited with before/after values.
- Reset a password from the same screen; the user can sign in immediately.
- The last active Super Admin cannot be demoted or deactivated.

## Backups

- **Hosted** — enable Supabase automated backups/PITR. Test a restore into a staging project before relying on it.
- **Local** — `.data/pgdata` is development-only and git-ignored. Copy it while the app is stopped if you need to preserve a demo state.
- **Uploads** — with Cloudinary, rely on the account's retention; without it, `.data/uploads` is not durable and may be lost on redeploy or instance replacement.

## Monitoring

- Watch `/api/health` from an external uptime monitor.
- Application errors are written to the server console (Vercel function logs). There is no APM integration in this version.
- AI failures log `[ai] ... unavailable` warnings; they are expected when no key is configured.
- Storage failures log `[voice]`/upload warnings; production submissions continue where possible.

## Month-end reporting

1. Open `/reports`.
2. Choose Production, Orders, Delays or Buyers.
3. Set the range (default last 30 days, maximum 365).
4. Download Excel for analysis; PDF for circulation.
5. Confirm the subtitle's row count and generation date before sharing.

Merchandisers receive only their orders; Super Admin and MD receive the full book. Exports are not cached.

## PWA and field devices

- Install from the browser menu on a production HTTPS deployment.
- Service worker updates require a new deploy and a reload; bump `CACHE_VERSION` in `public/sw.js` when shell assets change.
- Offline submissions live in that device's IndexedDB. Clearing browser data or uninstalling loses them. Supervisors should sync daily.
- The device clock is irrelevant to business-date validation; the server uses the configured timezone.

## Security operations

- Rotate `AUTH_SECRET` to invalidate all sessions after a suspected compromise.
- Rotate Supabase/Cloudinary/Gemini keys in their dashboards and in Vercel together.
- Review `/admin/activity` for unexpected role changes, share links or date changes.
- Revoke share links that are no longer needed; expiry alone is not a substitute for revocation.
- Do not paste secrets into logs, tickets or chat.

## Incident checklist

1. Check `/api/health` and the hosting logs.
2. If the database is down, restore connectivity/credentials; do not reseed a production database.
3. If login fails broadly, check `AUTH_SECRET`, Supabase status and profile `is_active`.
4. If uploads fail, check Cloudinary credentials/limits or local disk space.
5. If AI is failing, nothing critical is blocked; disable the flags if warnings are noisy.
6. If a share token leaked, revoke it immediately and create a new one.
7. Record what happened and which audit entries show the changes.

## Related reading

- [Deployment](deployment.md)
- [Administration](administration.md)
- [Troubleshooting](troubleshooting.md)
