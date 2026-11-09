# Testing

## Commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # 54 Vitest tests, single fork, files run sequentially
npm run test:e2e    # 8 Playwright tests on port 3100
npx playwright install chromium   # first E2E run only
```

The E2E runner starts its own Next dev server through `scripts/e2e-server.mjs` with `PGLITE_DATA_DIR=.data/e2e-pgdata`, deletes that directory first, and seeds it. Do not run another dev server **in the same project directory** on any port while Playwright is running: Next 16's dev lock is per project. Stop `npm run dev` before `npm run test:e2e`.

## Vitest strategy

Configuration: `vitest.config.mts`.

- Node environment, `@` alias to `src`.
- `pool: "forks"` with `fileParallelism: false` — embedded PGlite is single-process and tests must not share a data directory.
- 90-second test timeout and 180-second hook timeout to absorb first-run compilation and migration time.
- DB tests set their own `PGLITE_DATA_DIR` before importing services, and reset the cached global connection between files.

| File | Tests | Focus |
| --- | --- | --- |
| `tests/working-days.test.ts` | 9 | Sunday exclusion, inclusive counts, Friday/Saturday weekend, remaining days, rolling windows, add/between/previous helpers, month/year/leap boundaries |
| `tests/delay.test.ts` | 15 | Green/amber/red rules, required vs actual daily, missing reports as zero, insufficient history, overdue, no output, not started, completed, future updates, custom thresholds, order roll-up |
| `tests/validation.test.ts` | 7 | Matrix sum match/mismatch, empty matrix, case-insensitive duplicates, blank colour/size, negative/fractional quantities, zero placeholders |
| `tests/ai.test.ts` | 6 | No-key heuristic classification (Tamil machine/labour/fabric), empty input, unrecognised text, transcription unavailable |
| `tests/db.test.ts` | 1 | Migration list and idempotent application |
| `tests/integration.test.ts` | 16 | Service scoping, buyer isolation, RLS under `authenticated`, share-token lifecycle, production idempotency/supervisor restrictions, admin authorization/audit |

### Database integration tests

`tests/integration.test.ts` sets `PGLITE_DATA_DIR` to `.data/vitest-integration`, deletes it, seeds demo data, then imports services dynamically. It covers:

- **Buyer isolation** — buyer B sees only B orders through services, portal and detail; buyer C's order is rejected.
- **Merchandiser scoping** — only assigned orders; merch2 cannot create a share link on merch1's order.
- **Supervisor scoping** — only orders/stages with an assignment; unassigned and future-dated submissions are rejected.
- **Real RLS** — `set local role authenticated` with `request.jwt.claim.sub` returns exactly the 4 Company B orders for buyer B, zero Company C orders, and blocks an update. `has_table_privilege` confirms audit/date-history update is denied and share-token select is denied.
- **Share tokens** — raw token length, URL suffix, SHA-256 hash equals the stored hash (and the raw value is absent), resolve, wrong token, revoke, scope `summary` vs `updates`, expiry, cross-merchandiser rejection.
- **Production updates** — assigned-stage selection, idempotent retry returns `duplicate` with the same id and a single row, client UUID reuse with another stage is rejected.
- **Administration** — non-admin list/create rejected, created passwords are bcrypt hashes, `user_created` audit is written.

## Playwright strategy

Configuration: `playwright.config.ts` with Chromium, one worker, no parallelism, retries only in CI.

- `webServer` spawns the E2E server on `http://localhost:3100`.
- `e2e/global-setup.ts` calls `/api/health` with a long timeout to warm the embedded database and compile routes before the first test.
- Test timeout 180 seconds; expect timeout 20 seconds; traces retained on failure and screenshots on failure only.

Scenarios in `e2e/platform.spec.ts`:

1. Unauthenticated access redirects; `/api/health` is 200; the reports API is 401.
2. Merchandiser dashboard/orders scoping and admin redirect.
3. Super Admin reaches users and audit screens.
4. Buyer sees only B orders; another buyer's order returns 404; internal routes redirect to `/buyer`.
5. Supervisor lands on the Tamil greeting workspace; internal routes redirect.
6. Delay scan toast, order Delay tab formula, AI disclaimer and required/actual daily values.
7. Excel download link and PDF endpoint content type/size.
8. Share-link creation, guest read-only page, revocation through the dialog, guest 404.

Radix tabs respond to pointer events, not programmatic `.click()`; browser automation must use a real click on the tab element.

## What is not automatically tested

- Live Cloudinary uploads and live AI provider responses (no credentials).
- Real Supabase Auth and hosted RLS (the suite exercises RLS with the local `authenticated` role and the same policies).
- Cross-browser rendering; Playwright runs Chromium only.
- Visual regression and accessibility audits.

## Test data

- Vitest uses isolated `.data/vitest-*` directories.
- Playwright uses a fresh `.data/e2e-pgdata` on every run.
- `npm run db:seed` / `db:reset` manage the normal development database.
- Never point tests at a hosted database: seeding refuses `DATABASE_URL`, and the E2E server sets `SEED_DEMO_DATA=true` against PGlite.

## CI suggestion

```bash
npm ci
npm run lint
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Run the E2E suite serially. If the CI machine is slow, raise the Playwright timeout rather than parallelising against one embedded database.

## Related reading

- [Troubleshooting](troubleshooting.md)
- [Operations](operations.md)
