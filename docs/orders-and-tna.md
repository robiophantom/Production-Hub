# Orders and TNA

## Creating a purchase order

Only Super Admin and Merchandiser can open **Purchase orders → New purchase order**. A Merchandiser is always the owner of the order they create; a Super Admin can assign another merchandiser.

### Header fields

| Field | Rules |
| --- | --- |
| PO number | Required, unique case-insensitively; trimmed |
| Buyer | Required, active buyer |
| Buyer reference | Optional free text |
| Order received date | Required business date |
| Style name | Required |
| Style number / description / notes | Optional |
| Total quantity | Required positive whole number |
| Ex-factory date | Required and cannot be before the order received date |
| Shipping method | `sea`, `air`, `courier` or `road` |
| Priority | `low`, `normal`, `high`, `critical` |
| Primary unit | Optional; copied to stage assignments |
| TNA template | Required, with at least one selected milestone |

### Colour/size matrix validation

The matrix is submitted as `{ colour, size, quantity }` rows. `validateVariants` enforces:

- at least one row;
- every row has a non-blank colour and size;
- quantities are non-negative whole numbers (zero allowed for placeholder cells);
- colours and sizes are unique when compared case-insensitively;
- the sum of all rows **must equal the PO total quantity**.

The error message names both totals, for example: "Variant quantities total 900 pieces, but the PO quantity is 1,000. They must match." The order is not created when validation fails.

### TNA generation

1. The selected template's milestones are read in sequence.
2. Optional stages (printing and washing in the seeded templates) are included only if explicitly selected.
3. Planned dates default to `ex_factory_date + offset_days` from the template. The form can override individual dates with valid `YYYY-MM-DD` values.
4. Each milestone receives `target_quantity = PO total quantity`, the selected sequence, an `is_active` flag and a `stage_assignments` row with the primary unit, supervisor and subcontractor supplied in the form.
5. PO header, variants, milestones, assignments and the `order_created` audit entry are written in one transaction.

### Seed examples

The demo seed includes three mandatory POs:

| PO | Buyer | Quantity | Scenario |
| --- | --- | --- | --- |
| `B-PO-88213` | Company B | 12,000 | All pre-stitch stages complete, stitching in flight, finishing/packing ahead |
| `B-PO-88240` | Company B | 8,000 | Ex-factory in 5 days, finishing output below plan (amber/red risk) |
| `C-PO-0488` | Company C | 10,000 | Printing in progress with an open printing-delay issue |

Additional POs (`B-PO-88301`, `D-PO-1120`, `C-PO-0502`, `B-PO-88315`, `D-PO-1131`) provide red, green, insufficient-data and overdue scenarios.

## Orders list and board

`/orders` provides free-text search (PO number, style, buyer reference, buyer), filters for buyer, unit, stage, status, health, priority and ex-factory range, sortable columns and pagination (12 per page). Merchandisers see only their orders; Super Admin and MD see the full book.

`/board` is the week-oriented view. Weeks are Monday-based; the selector covers four weeks back to thirteen weeks forward. Filters include buyer, unit, merchandiser, stage and health, and the board defaults to active orders sorted by health. Pagination is 15 orders per page.

## Order detail

`/orders/[id]` shows the header, buyer, dates, quantities, progress and health, with tabs for:

- **Overview** — order facts, commercial details, health basis.
- **TNA** — milestone table with planned vs actual dates, progress, assignment and editing controls.
- **Production** — cumulative updates by stage, daily output and the delay calculation per stage.
- **Variants** — colour/size matrix and totals.
- **Issues** — open, in-progress and resolved issues with AI suggestions and resolution.
- **Photos** — stage and issue photographs with buyer-visibility controls.
- **Delay** — the transparent formula for every active stage and the order-level roll-up. AI is explicitly excluded here.
- **History** — date changes and audit events for this PO.

Access is checked in `getOrderDetail`: a user without scope gets "not found or no access" rather than a partial page.

## Editing an order

`/orders/[id]/edit` allows editable header fields and variant changes. Variant edits must still satisfy the matrix total rule and the unique `(po_id, colour, size)` constraint. Changing the PO total without adjusting variants is rejected. All edits are audited.

## Milestones and planned dates

The TNA tab supports:

- **Edit milestone** — planned date, target quantity, active flag, notes, unit, supervisor and subcontractor.
- **Add milestone** — a stage not already present in the order; appended at the next sequence.
- **Reorder** — move a milestone up or down by swapping sequence numbers, in a transaction.
- **Date changes** — changing `planned_date` requires a reason of meaningful length. The service writes to `order_date_history` (previous date, new date, reason, actor, timestamp) and adds a `tna_date_changed` audit event in the same transaction.

`order_date_history` and `audit_logs` have no update/delete grants for ordinary sessions, so the trail is append-only from the application's perspective.

## TNA templates

Administration → Master data manages templates and their milestones:

- Template name, description and active flag.
- Per-stage sequence, offset in days from ex-factory and an optional flag.
- Removing a template milestone does not alter existing orders; it only affects future order creation.

Seeded templates are **Knitwear — Standard TNA** and **Knitwear — Print & Wash**, both covering the ten default stages with offsets from −45 days (fabric booking) to 0 (ex-factory).

## Status and completion

`purchase_orders.status` is `active`, `completed` or `cancelled`. Production submissions are rejected for non-active orders. Completing every active milestone drives order health to green ("all active production milestones are complete"); the order status remains a deliberate administrative action rather than being inferred from quantities.

## Related reading

- [Delay engine](delay-engine.md)
- [Production & offline](production-offline.md)
- [Data model](data-model.md)
