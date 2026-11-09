# Buyer portal and share links

## Buyer portal

Buyers sign in with the `buyer` role and land on `/buyer`. A buyer profile has a required `buyer_id`, and every query is restricted to that company.

### Pages

| Page | Contents |
| --- | --- |
| `/buyer` | Active orders, ordered vs produced pieces, current stage/progress, latest approved notifications and updates |
| `/buyer/orders/[id]` | One order: header, active milestones with planned dates and progress, approved updates and approved notices |
| `/buyer/updates` | Chronological feed of approved updates and approved/sent buyer notifications with photos |

### Visibility rules

A buyer sees:

- purchase orders where `buyer_id` matches their profile;
- active milestones (`is_active = true`) with stage name, sequence, planned date, target quantity, cumulative approved production and status;
- production updates with `approved_for_buyer = true`;
- photos with `approved_for_buyer = true` that are attached to an update;
- buyer notifications with status `approved` or `sent`.

A buyer never sees:

- another buyer's order, even by editing the URL or API request;
- internal notes, merchandiser identity, audit history, issues, unapproved photos/updates, draft notifications or the delay alert internals;
- raw share tokens or share management screens.

`getBuyerOrderDetail` first calls `assertCanAccessOrder`, then reads the order. The page calls `notFound()` when the service rejects it, so a foreign id produces a 404 rather than a permission message. RLS independently restricts the same rows (see [roles-and-security.md](roles-and-security.md)).

### Approval workflow

Buyer visibility is deliberate and editable:

- Production updates default to `approved_for_buyer = true` in the schema, but the UI/service can toggle them; the merchandiser controls what is published.
- Photos default to **false**. A merchandiser or Super Admin approves or revokes each photo from the order's Photos tab (`setPhotoBuyerVisibility`).
- Confirming a delay alert writes a `buyer_notifications` row with status `approved`, linked to the alert, with a generated subject/message. Dismissing an alert publishes nothing.
- No AI output can create or approve a buyer notification.

## Share links

Share links give an external recipient read-only access to one order without an account.

### Creating a link

Only a Super Admin or the merchandiser assigned to the order can create one, from **Order → Share**:

| Field | Rule |
| --- | --- |
| Scope | `summary` or `updates` |
| Expiry | 1–90 days |
| Label | Optional, up to 80 characters |

The service generates 32 random bytes, base64url-encodes them, hashes the raw value with SHA-256, and stores only the hash with the scope, label, expiry and creator. The raw token is returned once in the UI with a warning to copy it immediately. Creation is audited (`share_link_created`) without the raw token.

### Resolving a link

`/share/[token]` is public but never cached as an authenticated page. Resolution:

1. validates the token shape (`[A-Za-z0-9_-]{20,100}`);
2. hashes it and looks up a row with `revoked_at is null and expires_at > now()`;
3. updates `last_accessed_at` (at most every five minutes);
4. loads the order, active milestones and approved notifications;
5. loads approved updates and photos **only** when scope is `updates`.

A missing, expired or revoked token returns 404. The page sets `noindex, nofollow`.

### Scope behaviour

| Scope | Order header | Milestones | Notifications | Updates | Photos |
| --- | --- | --- | --- | --- | --- |
| `summary` | Yes | Yes | Yes | No | No |
| `updates` | Yes | Yes | Yes | Approved only | Approved, update-attached only |

Scope cannot be widened after creation. An `updates` link cannot read internal TNA notes, issues or audit data.

### Listing and revoking

The Share screen lists the order's links with scope, label, creator, creation time, expiry state and last access. Revoking:

- requires Super Admin or the assigned merchandiser;
- sets `revoked_at`, keeps the row for audit;
- writes `share_link_revoked`;
- invalidates the URL immediately (the next request returns 404).

Already-revoked links cannot be revoked twice.

### Security properties

- Capability URL: possession of the token grants read-only access until expiry/revocation.
- Hashes only: a database dump does not reveal usable tokens.
- Expiry is checked in the lookup query, not trusted from the client.
- No write endpoints accept a share token; the link is read-only by construction.
- Token rows have RLS enabled with no policies and no privileges for `authenticated`/`anon`; only the server's privileged connection can read them.

## Related reading

- [Roles & security](roles-and-security.md)
- [Reports & exports](reports-and-exports.md)
- [Data model](data-model.md)
