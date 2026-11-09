# Company A Production Hub

Production tracking, TNA planning, delay prediction, buyer reporting and order management for Company A — a Tiruppur knitwear exporter running three production units and roughly 500 purchase orders a year.

The application is a single Next.js App Router deployment with server-side authorisation, PostgreSQL row-level security, a deterministic delay engine, offline-capable supervisor updates, an isolated buyer portal and read-only share links.

---

## Quick start

Requirements: Node.js 20+ (tested on Node 24), npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. On first run the app creates an embedded PostgreSQL database (PGlite) at `.data/pgdata`, applies migrations and seeds the demo data. No credentials are required.

To recreate the demo data with today's business date:

```bash
npm run db:reset
```

### Demo accounts (embedded database only)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `admin@company-a.test` | `Admin@12345` |
| Managing Director | `md@company-a.test` | `Md@12345` |
| Merchandiser | `merch@company-a.test` | `Merch@12345` |
| Merchandiser (Unit 3) | `merch2@company-a.test` | `Merch2@12345` |
| Unit Supervisor (Unit 1) | `supervisor@company-a.test` | `Super@12345` |
| Unit Supervisor (Unit 2) | `supervisor2@company-a.test` | `Super2@12345` |
| Unit Supervisor (Unit 3) | `supervisor3@company-a.test` | `Super3@12345` |
| Buyer — Company B | `buyer@company-b.test` | `Buyer@12345` |
| Buyer — Company C | `buyer.c@company-c.test` | `BuyerC@12345` |

These predictable accounts are **never** seeded into a hosted database. Any `DATABASE_URL` disables demo seeding; use `npm run admin:bootstrap` for the first production account.

---

## What is included

- **Management dashboard** — order health, ordered vs produced quantities, stage distribution, unit comparison, 14/30/60-day production trend, open issues and upcoming shipments, scoped to the signed-in role.
- **Order management** — PO creation with colour/size matrix validation (matrix total must equal PO quantity; duplicates, blank values, negative and fractional quantities rejected), TNA templates, milestone editing and audited planned-date changes.
- **Order detail** — overview, TNA, production updates, colour/size variants, issues, photographs, delay analysis and immutable history tabs.
- **Production board** — weekly board filtered by buyer, unit, merchandiser, stage, health and week.
- **Supervisor workspace** — mobile-first daily quantity entry, photographs, Tamil voice notes, issue reporting, offline queue in IndexedDB with idempotent sync.
- **Delay engine** — remaining quantity, required daily output, rolling 7-working-day actual output (missing days count as zero), projected completion, 2-working-day healthy buffer, green/amber/red health and transparent formula; AI is never used for delay decisions.
- **Delay alerts** — 14-day / 7-day / 3-day / overdue windows; merchandiser confirms (which creates an approved buyer notification) or dismisses with a reason.
- **Buyer portal** — read-only orders belonging to the buyer's company, approved updates, approved photographs and approved delay notices only.
- **Share links** — hashed 32-byte tokens, 1–90-day expiry, scope (`summary` or `updates`), revocation, last-access tracking and no authentication requirement for guests.
- **Reports** — production, orders, delays and buyers reports as Excel (ExcelJS) or PDF (pdf-lib), generated server-side with role scoping.
- **Administration** — users and roles, password resets, buyers, units, stages, subcontractors, TNA templates, audit/date history, notification audit and business settings.
- **PWA** — manifest, icons, installable app shell, offline fallback page and service worker (registered in production builds).

---

## Technology

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS 4, shadcn-style component kit, Lucide icons |
| Forms and validation | React Hook Form, Zod |
| Data | PostgreSQL — hosted via `DATABASE_URL`, or embedded PGlite locally |
| Authorisation | Role checks in services plus PostgreSQL RLS and column grants |
| Auth | Supabase Auth when configured, otherwise bcrypt + HS256 session cookie |
| Storage | Cloudinary when configured, otherwise `.data/uploads` |
| AI (optional) | OpenAI-compatible chat and transcription APIs, server-side only |
| Reports | ExcelJS, pdf-lib |
| Charts | Recharts |
| Tests | Vitest (unit/integration/security) and Playwright (E2E) |

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (unit, integration, service security, RLS) |
| `npm run test:e2e` | Playwright suite against a fresh embedded database on port 3100 |
| `npm run db:seed` | Ensure/print the embedded demo data |
| `npm run db:reset` | Delete and recreate the embedded demo database |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run admin:bootstrap` | Create the first Super Admin on a hosted database |

---

## Environment

Zero configuration is needed locally. For hosted deployments, copy `.env.example` to `.env.local` (or configure the variables in Vercel) and set at minimum:

```bash
DATABASE_URL=postgresql://...        # Supabase pooler connection string
AUTH_SECRET=<long random string>     # required for session cookies
NEXT_PUBLIC_APP_URL=https://...      # used in share links
```

Optional integrations: Supabase Auth (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`), Cloudinary and an OpenAI-compatible AI endpoint. Every optional feature degrades gracefully — see [docs/environment.md](docs/environment.md).

> Never expose `DATABASE_URL`, `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, Cloudinary secrets or `OPENAI_API_KEY` to the browser. Only variables prefixed `NEXT_PUBLIC_` are public.

---

## Roles

| Role | Scope |
| --- | --- |
| Super Admin | Everything, including administration, audit and settings |
| Managing Director | Company-wide dashboard, orders, board, alerts and reports (read/manage production, no admin screens) |
| Merchandiser | Only orders assigned to them; creates orders, plans TNA, confirms/dismisses alerts, shares links, approves buyer visibility |
| Unit Supervisor | Only stages assigned to them; submits daily updates, photographs and issues, online or offline |
| Buyer | Only their own company's orders and approved updates/notices; never another buyer's data |

Authorisation is enforced in the service layer **and** by RLS. Hiding a button is never the security boundary.

---

## Documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/architecture.md) | Runtime topology, request flow, module layout, design decisions |
| [Data model](docs/data-model.md) | Entities, relationships, constraints, indexes, idempotency |
| [Roles & security](docs/roles-and-security.md) | Role matrix, service checks, RLS policies, column grants, buyer isolation |
| [Delay engine](docs/delay-engine.md) | Working-day calendar, formulas, health rules, alert windows, worked examples |
| [Orders & TNA](docs/orders-and-tna.md) | PO creation, matrix validation, templates, milestones, date history |
| [Production & offline](docs/production-offline.md) | Supervisor submissions, photos, voice notes, IndexedDB queue, sync idempotency |
| [AI assistance](docs/ai-assistance.md) | Classification, transcription, fallback behaviour, privacy and limits |
| [Buyer portal & sharing](docs/buyer-portal-and-sharing.md) | Visibility rules, approved content, token lifecycle, revocation |
| [Reports & exports](docs/reports-and-exports.md) | Report types, date ranges, Excel/PDF generation, scoping |
| [Administration](docs/administration.md) | Users, master data, templates, audit, settings |
| [Deployment](docs/deployment.md) | Vercel + Supabase setup, migrations, bootstrap, PWA notes |
| [Environment](docs/environment.md) | Every variable, defaults and failure modes |
| [Testing](docs/testing.md) | Test strategy, isolation, commands, what is covered |
| [Operations](docs/operations.md) | Runbooks: seeding, alerts, backups, incident checks |
| [Troubleshooting](docs/troubleshooting.md) | Common local and hosted issues and fixes |

---

## Project layout

```
src/app                 Routes: login, dashboard, orders, board, alerts, reports,
                        supervisor, buyer, admin, share, offline, API handlers
src/components          UI kit, shell, charts, order detail, PWA registration
src/lib/auth            Session JWT, rate limiting, sign-out
src/lib/business        Working-day calendar and deterministic delay engine
src/lib/db              Database drivers, migrations, demo seed
src/lib/services        Authorised, transactional business logic
src/lib/offline         IndexedDB queue and sync
src/lib/reports         Report queries and Excel/PDF rendering
supabase/migrations     Schema, RLS and share-token migrations
tests, e2e              Vitest and Playwright suites
scripts                 Seed, migrate and bootstrap-admin utilities
docs                    Operational and design documentation
```

---

## Verification status

- `npm run typecheck` passes.
- `npm test` passes 54 Vitest tests across six files, including real PostgreSQL RLS checks under `set local role authenticated`.
- `npm run test:e2e` passes 8 Playwright scenarios covering login for every role, buyer isolation, delay UI, report downloads and the share-link lifecycle.
- Browser smoke tests were performed manually against the development server.

External integrations were **not** verified against live third-party accounts: Cloudinary falls back to local storage and AI falls back to the deterministic classifier/keyword fallback unless credentials are supplied. No claim is made that those live services were exercised.
