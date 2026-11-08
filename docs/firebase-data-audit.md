# Firebase data audit

Target: Firebase project `studio-proper`, Firestore `(default)` Standard edition.

## Authentication surfaces

- Admin: Firebase Auth email/password, Google, and phone; authorization comes from `/users/{uid}`.
- Client: Firebase Auth email/password, Google, and phone; customer identity is mirrored to `/customers/auth_{uid}`.
- Bootstrap owner: verified `marsicprod@gmail.com`; subsequent authorization uses the immutable admin role managed by the current owner.

## Firestore paths and operations

| Path | Readers | Writers | Queries |
| --- | --- | --- | --- |
| `users/{uid}` | own user, owner | self-safe fields, owner admin fields | owner list ordered by `createdAt desc` |
| `bookings/{id}` | permitted booking admin, owning client | approved Schedule admin through strict Firebase-native booking operations; owning Client creates strict pending requests and may write only owner-safe message/cancellation/read fields | date equality/range for bounded schedule checks and subscriptions; Client OR by UID/email/phone compatibility |
| `clientCalendarSlots/{id}` | public, reduced availability metadata only | approved Schedule admin only, paired atomically with booking and date revision | `date asc`, public listener bounded to the visible seven-day window (max 500) |
| `customers/{id}` | customer admin, owning client profile | customer admin, owning client profile | `createdAt desc`; equality by `phoneKey` |
| `settings/pricing` | public | settings admin | document listener |
| `settings/invoice` | public | settings admin | document listener |
| `gallery/{id}` | gallery admin | gallery admin | `createdAt desc` |
| `bookkeepingEntries/{id}` | bookkeeping admin | bookkeeping admin | `date desc` |
| `inventoryItems/{id}` | inventory admin | inventory admin | `updatedAt desc` |
| `inventoryMovements/{id}` | inventory admin | create-only by inventory admin | `createdAt desc`, limit |
| `mail/{id}` | none via client SDK | signed-in pending admin, constrained approval email only | none |
| `bookingMessages/{id}` | permitted booking admin, owning client | participants create; each participant may only mark its own read flag; Admin status/decision messages must match the same booking decision transaction | equality by `bookingId`; Client also filters by `clientUid` |


- `bookingScheduleDays/{date}`: Schedule admin read/write only. A create or incremented revision is accepted only in the same atomic operation as a booking create/update, and is used as the optimistic-concurrency guard for date occupancy.
- `bookingSessionEvents/{id}`: Schedule admin read; append-only create paired with the booking's last-session-event pointer. Direct update and delete are denied.
- `users/{uid}/repositoryOperations/{operationId}`: per-user immutable operation markers under the Phase 1 repository security contract; marker access does not grant access to the linked business document.

## Integration decisions

- Browser local storage remains only as an offline/migration cache for pricing, invoice, old bookings/customers, UI theme, and sidebar state. Firestore is authoritative for business data.
- Client profiles are synced into the CRM customer collection with immutable `authUid` ownership.
- New admin bookings resolve matching customer phone records and persist `clientUid` and email, allowing stable client ownership reads.
- Authenticated client booking actions persist a strict pending request to Firestore before opening WhatsApp; admin Schedule and Dashboard consume the same booking stream.
- Booking conversations are real-time and scoped by `bookingId` plus immutable `clientUid`; booking documents only retain the latest-message summary needed for unread indicators.
- Client cancellation is a request state, not a direct cancellation. Only an approved booking admin can confirm, reject, or finalize it.
- Public reads are limited to `settings/pricing` and `settings/invoice` because the unauthenticated client landing page renders those business-facing values.
- Gallery metadata, status, and real-time lists are admin-only and authoritative in Firestore. Image binaries remain on the existing Cloudinary service because Firebase Storage is not provisioned and billing is disabled on this project.

## Index assessment (repository audit 2026-11-09)

The repository currently defines three composite indexes in firestore.indexes.json:

- customerFollowUpTasks: status ASC, dueAt ASC, dueTime ASC for the active task listener.
- customerFollowUpTasks: status ASC, completedAt DESC for the completed task listener.
- customerFollowUpEvents: taskId ASC, createdAt DESC for per-task event history.

The active Follow-up listener uses status in [open, in_progress, snoozed], dueAt ASC, dueTime ASC, and limit 200. The completed listener uses status == completed, completedAt DESC, and limit 50. Event history uses taskId equality, createdAt DESC, and limit 30. The required active-task composite is present in the repository, but its production deployment status is unverified.

Other observed query patterns include customer createdAt DESC and phoneKey equality; booking date DESC, clientCalendarSlots date ASC, and client ownership filters by UID/email/phone; bookingMessages bookingId and clientUid equality; paymentProofs clientUid or bookingId equality; guardAttendanceSessions guardUid/date filters; bookkeeping date range and date DESC; inventory updatedAt/createdAt ordering; gallery createdAt DESC; operatorFeeEntries bookingDate DESC; maintenance timestamp ordering; user createdAt DESC; and notificationEvents status or targetUid equality.

This is a source-level query inventory, not proof that every possible filter combination has been exercised against production. Any query that combines filters on different fields with ordering must be checked against the actual Firestore index link. Emulator success alone does not prove that a required production composite index is deployed. The active production Rules and index baselines are tracked separately in docs/architecture/FIRESTORE_PRODUCTION_BASELINE_2026-11-09.md.

## Phase 2 Booking/Schedule query and write audit (2026-11-09)

- Manual create/update, reschedule, Admin request decisions, and session actions use the Firebase Web SDK repository in `src/services/bookingOperationsRepository.js`; UI wrappers no longer call the Worker for these operations.
- Manual booking create first atomically writes an unpaid booking with empty payment history, date revision and calendar mirror. When an initial payment exists, a second idempotent Firebase transaction adds the first payment-history record and payment summary, writes the immutable `booking-payment` ledger, updates the calendar slot status, and changes the booking's internal ledger status from `pending` to `recorded`; retry repairs that step without duplicating the booking. Booking request decisions and session actions retain their own atomic message/event companions. General Finance writes remain outside Phase 2.
- Public availability reads only the reduced `clientCalendarSlots` documents and are bounded to the displayed seven-day range (500 maximum). Admin booking listeners are bounded to 500 by default (1,000 maximum); Client booking OR queries are capped at 250.
- Schedule collision checks read at most 251 booking documents for the target date and fail closed above 250. The query uses one `date ==` field constraint and the repository's existing single-field index; no new composite index is identified for Phase 2's audited query shapes.
- This audit describes repository/source query requirements only. It does not prove production index deployment, and it does not replace the required production Rules export/merge review before any deployment.
