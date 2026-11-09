# Architecture

## Runtime shape

The platform is one Next.js 16 App Router application. HTML is rendered on the server, mutations run as Server Actions, and a small set of route handlers serve files, reports, AI calls and the offline sync endpoint. There is no separate backend service.

```
Browser (React 19)
  │  HTML + Server Action requests + fetch()
  ▼
Next.js server (Node runtime)
  │  proxy.ts  → session cookie gate and login redirect
  │  pages/layouts → requireUser / requireRoles
  │  Server Actions and route handlers
  │      → services in src/lib/services (role checks, validation, transactions)
  │      → src/lib/db (pg Pool or embedded PGlite)
  ▼
PostgreSQL / Supabase
  │  RLS policies + column grants (defence in depth)
  └  Storage: Cloudinary or .data/uploads
```

Optional outbound calls: Supabase Auth, Cloudinary upload API, and Google's Gemini API for Tamil issue classification and audio transcription. Each is optional and falls back locally.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routing | `src/app` | Route groups `(app)` for authenticated screens, `/login`, `/share/[token]`, `/offline`, `/api/*` |
| Access gate | `src/proxy.ts`, `src/lib/auth` | Cookie verification, login redirects, role landing pages, server-side session re-reads |
| Components | `src/components` | Shell/navigation, UI kit, charts, order-detail tabs, PWA registration |
| Services | `src/lib/services` | The only place that builds business SQL: scoping, validation, transactions, audit writes |
| Business rules | `src/lib/business` | Working-day calendar and delay maths (pure, unit-tested) |
| Data | `src/lib/db` | Driver abstraction, migrations, demo seed |
| Platform helpers | `src/lib/storage`, `src/lib/ai`, `src/lib/reports`, `src/lib/offline` | Cloudinary/local files, AI, exports, IndexedDB queue |

Pages call services directly. Pages do not contain SQL and do not decide authorisation on their own; `requireRoles` establishes the minimum role for a screen and services re-check order-level scope for every sensitive read or write.

## Request flow examples

### Sign in

1. `/login` posts to `loginAction` (Zod validates email/password).
2. Rate limiter checks `email|ip` (8 failures in a 10-minute window by default).
3. If Supabase Auth is configured, credentials are checked there; otherwise the profile's bcrypt hash is compared.
4. `establishSession` signs an HS256 JWT (`sub`, `email`, `role`) into the `ca_session` cookie (HttpOnly, SameSite=Lax, 7 days, Secure in production).
5. Redirect to `roleHome(role)` or a validated internal `next` path. External and protocol-relative paths are rejected.

### Daily production update

1. Supervisor submits from `/supervisor`; if offline the payload is stored in IndexedDB.
2. Online or on sync, `/api/production/updates` re-reads the session.
3. `submitProductionUpdate` verifies the supervisor is assigned to the stage, the date is not in the future, the quantity is valid, and the `clientUuid` is unique.
4. Insert, photo/issue writes and audit are performed in one transaction. A retried offline submission with the same `clientUuid` returns the existing row (`duplicate: true`) rather than double-counting.
5. The delay engine derives health on read; no AI decision is involved.

### Buyer page

A buyer request resolves the session, then the service queries with `buyer_id = session.buyer_id`. PostgreSQL RLS additionally restricts `purchase_orders` rows to that buyer. Requesting another buyer's order id yields 404 rather than a permission error, so existence is not disclosed.

## Database modes

| Mode | When | Behaviour |
| --- | --- | --- |
| Embedded PGlite | No `DATABASE_URL` | Stored in `.data/pgdata`; `auth.users`/`auth.uid()` shim and roles are created by `supabase/local/0000_local_bootstrap.sql`; migrations and demo seed run on first `getDb()` |
| Hosted Postgres | `DATABASE_URL` set | `pg` Pool, TLS for non-local hosts, no automatic migrations and no demo seed |

The same schema, RLS policies and services run in both modes. A process-wide promise caches the database client so hot reloads do not open additional PGlite instances.

## Design decisions and trade-offs

- **Embedded database by default.** The project is fully runnable with no credentials, which makes evaluation and tests deterministic. PGlite is single-process; do not run two app instances against the same `.data/pgdata`.
- **PostgreSQL as the security boundary.** RLS and column grants prevent password hashes and share-token hashes from ever reaching an authenticated client, even if a future direct Supabase client is added.
- **Deterministic delay maths.** The engine is pure TypeScript with the current business date passed in, so results are testable and explainable. AI cannot affect health, alerts or buyer notifications.
- **Server-side exports.** Excel and PDF files are generated per request, scoped by the same service queries as the UI; nothing is pre-generated or publicly cached.
- **Token links are capability URLs.** The raw 32-byte token is returned once and shown once; only its SHA-256 hash is stored. Revocation and expiry are checked on every resolution.
- **PWA is an enhancement.** The service worker is registered only in production builds; offline entry queues data in IndexedDB, but the app shell still requires a successful cache fill.

## Route map

| Area | Routes |
| --- | --- |
| Public | `/login`, `/share/[token]`, `/offline`, `/api/health` |
| Internal | `/`, `/dashboard`, `/orders`, `/orders/new`, `/orders/[id]`, `/orders/[id]/edit`, `/orders/[id]/share`, `/board`, `/alerts`, `/reports` |
| Supervisor | `/supervisor`, `/supervisor/history`, `/supervisor/issues` |
| Buyer | `/buyer`, `/buyer/orders/[id]`, `/buyer/updates` |
| Administration | `/admin/users`, `/admin/master-data`, `/admin/activity`, `/admin/settings` |
| API | `/api/production/updates`, `/api/uploads`, `/api/files/[filename]`, `/api/reports/[type]`, `/api/ai/classify`, `/api/ai/transcribe`, `/api/health` |

## Related reading

- [Data model](data-model.md)
- [Roles & security](roles-and-security.md)
- [Deployment](deployment.md)
