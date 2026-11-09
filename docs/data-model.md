# Data model

The schema is defined in `supabase/migrations/0001_initial_schema.sql`, with RLS in `0002_rls_policies.sql` and share-link scope in `0003_share_token_scope.sql`. There are 20 entities.

All primary keys are UUIDs (`gen_random_uuid()`). Timestamps are `timestamptz` in UTC; business dates (`order_received_date`, `planned_date`, `update_date`, `ex_factory_date`, …) are PostgreSQL `date` columns and are returned by both drivers as plain `YYYY-MM-DD` strings, avoiding timezone drift. Foreign keys use `on delete cascade` for order-owned records and `set null` for optional references.

## Entities and relationships

```
buyers 1─* purchase_orders *─1 profiles (merchandiser)
production_units 1─* purchase_orders
production_units 1─* profiles (supervisor)
production_units 1─* stage_assignments
subcontractors 1─* stage_assignments

purchase_orders 1─* order_variants
purchase_orders 1─* order_milestones 1─1 stage_assignments
production_stages 1─* order_milestones
tna_templates 1─* tna_template_milestones *─1 production_stages

order_milestones 1─* production_updates
production_updates 1─* production_photos
production_issues 1─* production_photos
production_issues *─1 production_updates (optional)

purchase_orders 1─* delay_alerts
purchase_orders 1─* buyer_notifications
delay_alerts 1─0..* buyer_notifications

purchase_orders 1─* order_date_history
purchase_orders 1─* audit_logs
purchase_orders 1─* buyer_share_tokens
app_settings is a standalone key/value table
```

### Reference and identity

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `buyers` | Buyer companies (code, country, contacts, active flag) | Unique `code`; used for buyer scoping |
| `production_units` | The three Company A units | Unique `code` |
| `subcontractors` | Printing/washing/other external capacity | `type` check constraint |
| `profiles` | Every user, linked to Supabase Auth by `id` when enabled | Role check; unique email; buyer role requires `buyer_id`; supervisor requires `unit_id`; `password_hash` nullable for Supabase Auth users |
| `production_stages` | Master stage list in sequence | Unique name, code and sequence |
| `app_settings` | Working days, risk thresholds and defaults | JSONB values with seeded defaults |

### Orders and planning

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `purchase_orders` | PO header, quantities, ex-factory date, priority, status, merchandiser and primary unit | Unique `po_number`; positive quantity; ex-factory ≥ received; status/shipping/priority checks |
| `order_variants` | Colour/size breakdown | `quantity >= 0`; unique `(po_id, colour, size)`; service enforces matrix total = PO quantity |
| `order_milestones` | One row per stage per order with planned date and target quantity | Unique `(po_id, stage_id)`; sequence > 0; target ≥ 0; status check |
| `stage_assignments` | Unit, supervisor and subcontractor for a milestone | One row per milestone (`unique milestone_id`) |
| `tna_templates` | Reusable plans | Active flag |
| `tna_template_milestones` | Stage offsets in a template | Ordered by `sequence`; `is_optional` marks printing/washing |

### Production

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `production_updates` | Daily quantity submissions | `client_uuid` unique (idempotency); quantity ≥ 0; `source` online/offline; `approved_for_buyer` gate |
| `production_issues` | Machine, labour, material, quality and other issues | Category/severity/status checks; AI suggestion fields are advisory only |
| `production_photos` | Images attached to an update or issue | Must have a parent (`update_id` or `issue_id`); buyer visibility defaults to false and requires approval |

### Risk, communication and audit

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `delay_alerts` | Snapshot of a stage risk at a warning window | `risk_level` amber/red; window check; status open/confirmed/dismissed/resolved; unique **open or confirmed** alert per milestone |
| `buyer_notifications` | Messages prepared for a buyer | Status draft/approved/sent; only approved/sent rows are visible to buyers; linked to the confirmed alert |
| `order_date_history` | Immutable record of planned-date changes | Reason required; write access revoked from `authenticated` |
| `audit_logs` | Action trail across orders and administration | Insert-only for ordinary users; `authenticated` update/delete revoked |
| `buyer_share_tokens` | Hashed capability tokens for read-only pages | SHA-256 `token_hash` unique; scope `summary`/`updates`; expiry; revocation; no RLS policies and no privileges for `authenticated`/`anon` |
| `app_settings` | Configuration values | Primary key `key`; updates audited by the administration service |

## Indexes

Indexes cover the access paths used by the application: buyer, merchandiser, unit, ex-factory date and status on orders; PO joins for variants/milestones/updates/issues/photos; `(milestone_id, update_date)` for delay windows; supervisor/unit assignments; audit and date history by PO and recency; share-token expiry. A partial unique index (`idx_delay_alerts_one_open`) guarantees at most one open-or-confirmed alert per milestone, which makes alert scanning idempotent.

## Transaction boundaries

Writes that span multiple rows run inside `db.transaction`:

- Order creation: PO header, variants, milestones, assignments and audit log.
- Milestone/date changes: milestone update, `order_date_history` insertion and audit.
- Production submission: update, optional issue, photos and audit.
- Alert scan/confirm/dismiss: alert upserts, buyer notification and audit.
- Share link creation/revocation: token row and audit.
- Administrative changes: entity change plus audit entry.

A failure rolls the whole unit back, so partial orders or orphaned audit entries cannot occur.

## Idempotency and concurrency

- Offline updates carry a client-generated UUID in `client_uuid`. The unique constraint plus a pre-insert lookup make retries safe; the API returns the existing row with `duplicate: true` and the current cumulative quantity.
- `client_uuid` reuse with a different milestone is rejected rather than silently re-associating the update.
- Alert confirmation/dismissal uses a conditional `update … where status = 'open'` and checks affected rows, so two reviewers cannot both act on the same alert.
- Share-token resolution filters on `revoked_at is null and expires_at > now()` in the same query, avoiding check-then-use races.
- Date changes require a reason and write to `order_date_history`; the history tables have no update/delete privileges for normal sessions.

## Business dates and the calendar

`BUSINESS_TIMEZONE` (default `Asia/Kolkata`) determines "today". Working days come from the `working_days` setting: by default Sunday (`0`) is excluded and the label is "Monday to Saturday". Ex-factory and milestone dates are `date` values, so the delay engine never depends on the server's local timezone.

## Seed data

`src/lib/db/seed.ts` creates three units, three buyers, subcontractors, nine internal/buyer profiles plus three supervisors (the table of demo credentials is in the README), ten stages, two TNA templates, eight POs and a mix of green/amber/red scenarios. It also creates an open Tamil issue with an AI suggestion, approved/unapproved photos, a confirmed buyer notification and an audited date change. The seed runs only when the `profiles` table is empty and only in embedded mode.

## Related reading

- [Roles & security](roles-and-security.md)
- [Orders & TNA](orders-and-tna.md)
- [Delay engine](delay-engine.md)
