# Roles and security

Security is layered: the navigation hides routes a role cannot use, pages call `requireRoles`, services re-check order-level scope, and PostgreSQL RLS and column grants enforce the same rules at the database. The UI is never the boundary.

## Role capabilities

| Capability | Super Admin | Managing Director | Merchandiser | Unit Supervisor | Buyer |
| --- | --- | --- | --- | --- | --- |
| Dashboard | Company-wide | Company-wide | Own orders | — | — |
| Orders list / board / detail | All | All | Assigned only | — | — |
| Create / edit orders, TNA, variants | Yes | No | Assigned only | No | No |
| Confirm / dismiss alerts | Yes | No (view only) | Assigned only | No | No |
| Reports and exports | All | All | Assigned only | No | No |
| Submit production updates | Yes (any order) | No | No | Assigned stages only | No |
| Report issues / upload photos | Yes | No | No | Assigned stages only | No |
| Buyer portal | No | No | No | No | Own company only |
| Administration (users, master data, audit, settings) | Yes | No | No | No | No |
| Share links | Yes | No | Assigned order only | No | No |

"Assigned only" means the service checks `purchase_orders.merchandiser_id = user.id` for editing, or `stage_assignments.supervisor_id = user.id` for supervisor actions. Viewing is broader: MD and Super Admin see all orders, merchandisers see their own, supervisors see orders where they have at least one assigned stage, and buyers see their company's orders.

## Authentication

Two modes are supported and can coexist:

1. **Supabase Auth** — used first when `NEXT_PUBLIC_SUPABASE_URL` and a publishable key are present. On success the app looks up a profile by Supabase user id, then by email.
2. **Local credentials** — `profiles.password_hash` (bcrypt, cost 10 for seeded demo accounts, 12 for bootstrap-created admins). Used when Supabase is not configured or does not accept the credentials.

Both paths require an active profile. The session is an HS256 JWT signed with `AUTH_SECRET`, stored in the `ca_session` cookie with `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/` and a 7-day lifetime. `getSessionUser` verifies the signature and **re-reads the profile on every request**, so deactivation or a role change takes effect immediately rather than at cookie expiry.

Login protections:

- Zod validates and normalises the email; passwords are capped at 200 characters.
- Failures are throttled per `email|ip` for 10 minutes after 8 failures. The limiter is in-process; serverless deployments should add a WAF/edge rate limit.
- A failed login returns the same generic message for unknown users, inactive accounts and wrong passwords.
- `next` redirects accept only paths beginning with a single `/`; `//evil.example` and absolute URLs are rejected.
- The Supabase service-role/secret key is read only in server modules and bootstrap scripts; it is never exported to a `NEXT_PUBLIC_` variable or imported by a client component.

## Server-side authorisation

- `requireUser` redirects unauthenticated requests to `/login`.
- `requireRoles(...roles)` redirects users whose role is not allowed to their role home.
- `orderScope(user)` returns the SQL predicate for a role and is applied to every order query in the services.
- `canAccessOrder` / `assertCanAccessOrder` guard reads; `canEditOrder` / `assertCanEditOrder` guard mutations. Both start from the database, never from a client-supplied claim.
- `assertSupervisorAssigned` verifies that the supervisor is assigned to the order, and to the specific milestone when one is supplied.
- Role checks are repeated in Server Actions and route handlers; a direct POST cannot bypass a hidden button.

## Row-level security

RLS is enabled on all 20 tables. Helper functions use `auth.uid()` and are `security definer` with a fixed `search_path`:

| Helper | Meaning |
| --- | --- |
| `current_profile_role()` | Role of the active profile for the current JWT subject |
| `current_profile_buyer_id()` | Buyer company of the current buyer |
| `is_internal()` | Super Admin, Managing Director or Merchandiser |
| `is_admin()` | Super Admin |
| `can_view_order(order_id)` | Role-aware order visibility, including supervisor assignment and buyer company |
| `can_edit_order(order_id)` | Super Admin, or the merchandiser assigned to the order |

Policy highlights:

- Reference data (buyers, units, stages, templates, subcontractors, settings) is readable by internal roles; buyers can read only their own buyer row. Writes require Super Admin (and stage/settings policies are admin-only).
- Orders and child tables use `can_view_order` for select and `can_edit_order` for writes. Production updates can be inserted by assigned supervisors; update/delete is limited to order editors.
- Alerts and buyer notifications are visible to internal roles with order access; buyer notifications are additionally visible to the owning buyer **only** when `status in ('approved', 'sent')` and the order belongs to them.
- `order_date_history` and `audit_logs` are select-only for `authenticated`; insert/update/delete privileges are revoked.
- `buyer_share_tokens` has RLS enabled, **no policies for `authenticated` or `anon`**, and all privileges are revoked. Only the server's privileged connection resolves tokens.

Column grants reinforce RLS:

- `authenticated` can select only non-sensitive profile columns; `password_hash` is excluded.
- Profile updates are limited to `full_name`, `phone` and `avatar_url`.
- Share tokens are unreachable through the authenticated/anon roles.

## Buyer isolation

A buyer must not reach another buyer's data by editing a URL, id, API request or token.

- Every buyer service query includes `buyer_id = session.buyer_id` (via `orderScope`), and `getBuyerOrderDetail` throws before returning data when the order is not the buyer's.
- RLS independently restricts `purchase_orders`, variants, milestones, updates, issues and photos through the buyer company.
- A foreign order id returns 404 through `notFound()`; the response does not reveal whether the order exists.
- Buyers never receive internal TNA dates, internal notes, raw issues, unapproved photos or draft notifications. Only updates with `approved_for_buyer = true` and notifications with `status in ('approved','sent')` are selected.
- The E2E and integration suites exercise both the service layer and the portal/detail routes (buyer B cannot open buyer C's order).

## Share-link security

- A raw token is generated with 32 random bytes (`base64url`) and returned once.
- Only a SHA-256 hash is stored (`token_hash`, unique). The raw token never appears in the database, logs or audit detail.
- Resolution validates the token format, looks up the hash, and requires `revoked_at is null and expires_at > now()` in one query.
- Links expire after 1–90 days and can be revoked by a Super Admin or the assigned merchandiser. Revocation is audited; the page immediately returns 404.
- Scope is restricted to `summary` or `updates`. Summary pages omit update rows; update-scope pages include only approved updates/photos.
- Guest pages are not indexed (`noindex, nofollow`) and are outside the authenticated route group.
- `last_accessed_at` is recorded at most every five minutes to keep writes low.

## File and upload security

- Uploads require an authenticated session with an allowed role (supervisor, merchandiser or Super Admin).
- Allowed image MIME types are JPEG, PNG, WebP, HEIC and HEIF; audio types are explicitly listed. Size limits are `MAX_UPLOAD_MB` (default 8 MB) for images and 12 MB for voice notes.
- Local files are stored under `.data/uploads` with generated names. `/api/files/[filename]` validates the filename against a strict character pattern, blocks path traversal, serves a known content type and sets `X-Content-Type-Options: nosniff`.
- Cloudinary, when configured, receives a signed upload and the stored `public_id` supports deletion.

## Audit immutability

- `audit_logs` and `order_date_history` are written by services inside the same transaction as the change.
- Normal authenticated sessions cannot insert, update or delete either table; the database privileges are revoked and RLS provides select-only policies.
- Date changes require a reason (minimum length enforced in the service) and record previous date, new date, actor and timestamp.
- Share-link creation/revocation, alert confirmation/dismissal, user creation/role changes, settings updates and order creation are all audited.

## Reporting a vulnerability

Do not open a public issue with exploit details. Contact the repository owner privately with reproduction steps, affected role and expected/actual behaviour.
