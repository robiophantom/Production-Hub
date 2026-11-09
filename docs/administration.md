# Administration

Administration screens are available to **Super Admin only**. The sidebar section is hidden for other roles, and every page and Server Action calls `requireRoles("super_admin")` while services re-assert the admin role.

## Users and roles

`/admin/users` lists accounts with role, unit/buyer scope, active state and creation date, and supports create, edit and password reset.

### Creating a user

- Email is normalised to lowercase and validated; it must be unique.
- Full name is required.
- Password must be at least 10 characters and is hashed with bcrypt (cost 10).
- Role is one of the five roles. `unit_supervisor` requires a unit; `buyer` requires a buyer company.
- Other roles cannot carry a unit or buyer scope (the service clears them).
- The account can be created inactive.
- A `user_created` audit entry records email, name and role.

### Editing a user

- Role, name, phone, unit/buyer scope and active state can change.
- You cannot deactivate your own account or remove your own Super Admin role.
- The last active Super Admin cannot be demoted or deactivated.
- Role changes take effect on the user's next request because the session re-reads the profile; no re-login is required.
- The audit entry contains a before/after snapshot.

### Password reset

- New password must be at least 10 characters; it is bcrypt-hashed.
- `user_password_reset` is audited. The password value is never stored in audit detail.
- Supabase Auth users can also be managed in the Supabase dashboard; this screen updates the local credential used by the fallback path.

## Master data

`/admin/master-data` manages reference data:

| Entity | Operations and rules |
| --- | --- |
| Buyers | Name, code (unique), country, contact person/email/phone, active flag |
| Production units | Name, code (unique), location, active flag |
| Production stages | Name/code/sequence (all unique), active flag; sequence drives stage ordering and TNA display |
| Subcontractors | Name, type, contact person/phone, active flag |
| TNA templates | Name, description, active flag; milestone list with stage, sequence, offset days and optional flag |

Deactivating a stage or unit hides it from new assignments but does not rewrite historical orders. Deleting is avoided in favour of deactivation so existing foreign keys and history remain valid.

## Activity and audit

`/admin/activity` has three views:

1. **Audit log** — action, entity, actor, PO and timestamp, with free-text search, entity filter and date range. The query accepts only valid calendar dates; malformed values are ignored rather than producing a 500. Results are capped at 250 rows.
2. **Date changes** — `order_date_history`: PO, milestone, previous date, new date, reason, actor and time.
3. **Buyer notifications** — every draft/approved/sent notification with PO and approver, so management can see exactly what was communicated.

The audit log records at least: order creation/edits, TNA updates and date changes, production submissions, issue reports, alert scans/confirmations/dismissals, share link creation/revocation, buyer visibility approvals, user creation/updates/password resets, master-data changes and settings changes.

Audit and date-history tables are append-only for application users: `authenticated` has select-only privileges, and no update/delete route exists.

## Settings

`/admin/settings` edits the values used by the delay engine and alert scanner:

| Setting | Range / rule | Default |
| --- | --- | --- |
| Excluded weekdays | At least one working day must remain | Sunday |
| Healthy buffer (working days) | 0–30 | 2 |
| Insufficient-data threshold (days) | 1–14 | 3 |
| History window (working days) | 1–30 | 7 |
| Amber rate tolerance | 0–100% | 5 |
| 14-day review window | 1–90 days | 14 |
| 7-day escalation | 1–90 days, less than review | 7 |
| 3-day critical | 1–90 days, less than escalation | 3 |
| Default language | `en` or `ta` | `en` |

The service validates the relationships (`critical < escalation < review`), normalises weekdays, regenerates the human-readable calendar label and writes all three JSON settings plus a `settings_updated` audit entry with before/after values in one transaction.

Changing the calendar immediately changes working-day counts, required daily output, buffers and alert windows. Change it deliberately and communicate to the floor.

## Bootstrap and recovery

On a hosted database the first Super Admin is created outside the UI:

```bash
DATABASE_URL="postgresql://..." \
SUPABASE_SECRET_KEY="..." \
npm run admin:bootstrap -- \
  --email=admin@company-a.example \
  --password="A-long-unique-password" \
  --name="Operations Admin"
```

The script applies migrations, creates/links the Supabase Auth user when Supabase is configured, writes the profile (bcrypt hash for local auth) and audits the action. Demo accounts are never created on a hosted database.

If every Super Admin is locked out, use this script with the existing email to promote/reset the profile; it is idempotent.

## Related reading

- [Roles & security](roles-and-security.md)
- [Delay engine](delay-engine.md)
- [Deployment](deployment.md)
