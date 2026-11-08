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
| `bookings/{id}` | permitted admin, owning client | permitted admin; owning client creates strict pending requests | admin `date desc`; client OR by `clientUid`, email, phone, phone key |
| `clientCalendarSlots/{id}` | authenticated users | permitted admin | `date asc` |
| `customers/{id}` | customer admin, owning client profile | customer admin, owning client profile | `createdAt desc`; equality by `phoneKey` |
| `settings/pricing` | public | settings admin | document listener |
| `settings/invoice` | public | settings admin | document listener |
| `gallery/{id}` | gallery admin | gallery admin | `createdAt desc` |
| `bookkeepingEntries/{id}` | bookkeeping admin | bookkeeping admin | `date desc` |
| `inventoryItems/{id}` | inventory admin | inventory admin | `updatedAt desc` |
| `inventoryMovements/{id}` | inventory admin | create-only by inventory admin | `createdAt desc`, limit |
| `mail/{id}` | none via client SDK | signed-in pending admin, constrained approval email only | none |
| `bookingMessages/{id}` | permitted booking admin, owning client | participants create; each participant may only mark its own read flag | equality by `bookingId`; client also filters by `clientUid` |

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
