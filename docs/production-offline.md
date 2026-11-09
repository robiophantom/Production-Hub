# Production and offline updates

## Supervisor workspace

Unit supervisors sign in to `/supervisor` and see only the orders and stages assigned to them through `stage_assignments`. The workspace is mobile-first:

- **My production** (`/supervisor`) — today's business date, assigned stages, a quantity entry form, photo capture, issue reporting and voice notes.
- **My submissions** (`/supervisor/history`) — the supervisor's own submissions with PO, style, stage, quantity, photos and whether the row came from an online or offline source.
- **Issues I reported** (`/supervisor/issues`) — issues they raised, with status and AI suggestion.

The UI supports English and Tamil labels for the floor workflow. The chosen language is a UI preference; no AI is involved in rendering.

## Submitting an update

The supervisor submits against a specific milestone. `submitProductionUpdate` enforces:

- role is `unit_supervisor` (or `super_admin`);
- `clientUuid` is a valid UUID;
- quantity is a non-negative whole number;
- update date matches `YYYY-MM-DD` and is not after the business date;
- the order exists, its status is `active`, and the milestone belongs to it;
- the supervisor is assigned to the order and to that milestone;
- if an issue is included, its category and severity are valid.

On success, in one transaction the service:

1. inserts the production update (`source` = online/offline);
2. sums cumulative quantity and marks the milestone `in_progress` or `completed`;
3. inserts the optional issue and its audit entry;
4. inserts photos (buyer visibility defaults to **false**);
5. writes a `production_submitted` audit entry with stage, quantity, cumulative and source.

Returns `{ id, duplicate, cumulative, milestoneCompleted }`.

## Photographs

- Captured or selected on the device, uploaded to `/api/uploads` before the update is posted.
- Images up to `MAX_UPLOAD_MB` (default 8 MB); JPEG, PNG, WebP, HEIC and HEIF only.
- Stored on Cloudinary when configured, otherwise in `.data/uploads` and served by `/api/files/[filename]`.
- Buyer visibility is never automatic. A merchandiser or Super Admin must approve each photo (and can revoke approval) from the order's Photos tab. Buyers see only approved photos.

## Voice notes (Tamil)

The issue form can record audio with `MediaRecorder`. When online, the clip is sent to `/api/ai/transcribe`; the transcript is attached to the issue. When AI/transcription is unavailable:

- the audio file is still uploaded and linked to the issue;
- the supervisor is told transcription is unavailable;
- the issue can still be submitted with typed text.

Voice notes never block submission and are never used for delay calculations.

## Issues

An issue carries Tamil and/or English description, category, severity (`low`, `medium`, `high`, `critical`), status (`open`, `in_progress`, `resolved`), an optional voice note/transcript and optional AI suggestion fields. Merchandisers and Super Admin can resolve issues; supervisors see only the issues they reported. Issues appear on the order detail and dashboard.

All seeded categories: Machine Breakdown, Labour Shortage, Raw Material Shortage, Quality Issue, Printing Delay, Washing Delay, Power Interruption, Production Capacity Issue, Other.

## Offline queue

The browser queue is implemented in `src/lib/offline/db.ts` with IndexedDB (`company-a-offline`, object store `pending_updates`, keyed by the client UUID).

1. If `navigator.onLine` is false — or a network request fails — the update payload (including photo blobs and an optional voice blob) is stored locally under a new UUID.
2. The supervisor sees a "saved on this device" confirmation and a pending count in the sync panel.
3. The app listens for the `online` event and also offers **Sync now**.
4. `syncPendingUpdates` sends each queued payload with its original client UUID and `source: "offline"`, then removes it only after a successful response.
5. Failed items remain queued and are reported in the sync result; nothing is silently dropped.

The queue stores raw blobs, so it can be large. Browsers may evict site data under storage pressure; supervisors should sync when connectivity returns.

## Idempotency and offline retries

`production_updates.client_uuid` is unique. Before inserting, the service looks up the UUID:

- same milestone → return the existing row with `duplicate: true` and the current cumulative total (no double count);
- different milestone → reject with an error explaining the id was used for another stage;
- invalid UUID → reject.

This makes a retry after a timeout safe, which is the main failure mode for intermittent factory connectivity.

## PWA behaviour

- `src/app/manifest.ts` serves `/manifest.webmanifest` with app name, icons and standalone display.
- `public/sw.js` precaches `/offline`, the icon and the manifest, uses network-first for navigations, cache-first for Next static assets, icons and demo images, and never caches `/api/` responses.
- The service worker is registered **only in production builds** (`NODE_ENV === "production"`). Offline behaviour in `npm run dev` is limited to the in-memory queue, because there is no service worker.
- The offline fallback page explains that the app is unavailable and that queued updates will sync when connectivity returns.

## Operational notes

- Updates are dated by the business timezone, not the device clock, when validating "future" dates.
- Supervisors cannot edit or delete a submitted update; corrections are handled by the merchandiser through order management or by submitting an adjusted entry (the database keeps every row).
- Deleting an order cascades to its updates, issues and photos; deleting a photo/issue does not cascade back to the update.

## Related reading

- [AI assistance](ai-assistance.md)
- [Roles & security](roles-and-security.md)
- [Troubleshooting](troubleshooting.md)
