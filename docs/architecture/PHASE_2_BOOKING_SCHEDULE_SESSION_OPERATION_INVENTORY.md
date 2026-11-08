# Phase 2 — Booking, Schedule & Booking Session Operation Inventory

**Project:** 37Studio Proper  
**Date:** 2026-11-09 (Asia/Jakarta)  
**Branch:** `architecture/firebase-single-backend-migration-2026-11-09`  
**Migration PR:** #18 (Draft; not merged)  
**Status:** Implementation in progress; validation and CI gates pending.

## 1. Scope and target path

This inventory covers only Booking, Schedule/availability, and Booking Session operations. The active browser request path for these operations is Firebase Authentication + Firestore Web SDK + Firestore Security Rules. The Phase 1 repository foundation in `src/lib/firestoreRepositoryFoundation.js` supplies canonical principal resolution, strict input parsing, deterministic operation IDs, payload fingerprints, idempotent transaction markers, and bounded write helpers.

The following remain out of scope: general Finance/payment posting and reconciliation, payment-proof review/binaries, daily closing, Follow-up, Inventory, Procurement, Maintenance, account lifecycle, Danger Zone, Gallery, global Worker/EmailJS retirement, production Rules/index changes, Hosting deployment, and production data mutation.

The one narrow Finance-shaped companion retained in this phase is the initial payment history plus its immutable `booking-payment` ledger entry. The payment history is committed with the manual booking; the ledger is then created by a separate idempotent Firebase transaction that changes the booking's internal `initialPaymentLedgerStatus` from `pending` to `recorded`. A failed second step leaves a recoverable pending marker so retry can complete the ledger without creating another booking. It is not a general Finance write API and does not authorize later payment posting, refund, void, proof review, or daily closing.

## 2. Operation matrix

| Operation | UI entry point | Firebase path | Actor / boundary | Atomic documents and invariants |
| --- | --- | --- | --- | --- |
| Manual booking create | `src/pages/admin/SchedulePage.jsx` → `adminBookingRepository.createManualBooking` | `src/services/bookingOperationsRepository.js:createManualBooking` | Approved Owner/Admin with `schedule` permission | The first idempotent transaction creates `bookings/{id}` (including payment history and an internal ledger status), increments `bookingScheduleDays/{date}`, conditionally creates `clientCalendarSlots/{id}`, and writes the per-user operation marker. When an initial payment exists, a second idempotent transaction creates the immutable `bookkeepingEntries/{id}` companion and changes the booking ledger status from `pending` to `recorded` atomically. If that second step fails, the booking remains committed with a visible pending ledger state and can be retried without duplicating the booking. Rejects reused booking IDs, occupied slots, malformed values, and initial payment above total. |
| Manual booking metadata edit | `SchedulePage.jsx` and customer identity maintenance through `CustomerPage.jsx` | `updateManualBooking` | Approved Owner/Admin with `schedule` permission | Updates only the explicit editable-field allow-list. Payment, refund, request decision, session lifecycle, and other protected fields cannot be patched through this path. Uses expected `updatedAt` to reject stale writes. |
| Manual booking reschedule / slot edit | `SchedulePage.jsx` booking form | `updateManualBooking` | Approved Owner/Admin with `schedule` permission | Transaction reads booking, old/new date revision documents and calendar mirror; checks bounded target-date bookings for overlap; updates booking, old/new `bookingScheduleDays` revisions and the public slot mirror atomically. Retries only when a preflight revision changed, then revalidates. |
| Client booking request create | Authenticated Client Portal booking submit | `adminBookingRepository.createClientBookingRequest` → `createClientBookingRequestOperation` | Firebase Auth Client; the UID must match canonical Client identity and immutable `clientUid` | Creates only a strict pending `bookings/{id}` request with no payment history, no paid amount and no calendar slot. Notification event creation remains a separate best-effort Firestore side effect after the request commit. |
| Booking request confirmation / rejection / cancellation | `src/pages/admin/BookingRequestsPage.jsx` → `bookingCommunicationRepository.updateBookingRequestStatus` | `decideBookingRequest` | Approved Owner/Admin with `schedule` permission | Updates booking decision fields, creates immutable status message `bookingMessages/{id}`, increments the schedule-day revision, and creates/updates/deletes `clientCalendarSlots/{id}` as required. Cancellation additionally appends a `bookingSessionEvents/{id}` event and updates the booking's latest-session-event pointer. Requires a valid current request state and checks confirmation overlap against a bounded date query. |
| Session check-in | `src/components/booking/BookingDetailDrawer.jsx` | `recordBookingSessionAction({ action: 'check_in' })` | Approved Owner/Admin with `schedule` permission | Updates check-in actor/time and latest-event pointer together with an append-only `bookingSessionEvents/{id}` record. Does not change the session state. Rejects repeated check-in and invalid terminal states. |
| Session start | Booking detail drawer | `recordBookingSessionAction({ action: 'start' })` | Approved Owner/Admin with `schedule` permission | Atomically changes session state to `in_progress`, records actual start actor/time and appends the corresponding session event. |
| Session complete | Booking detail drawer | `recordBookingSessionAction({ action: 'complete' })` | Approved Owner/Admin with `schedule` permission | Requires `in_progress` plus a valid actual start time; atomically records actual end, actor, elapsed duration, terminal state and append-only event. |
| Session no-show | Booking detail drawer | `recordBookingSessionAction({ action: 'no_show' })` | Approved Owner/Admin with `schedule` permission | Requires upcoming state, no prior check-in, a reason of at least four characters, and 15 minutes past the scheduled start in Asia/Jakarta. Atomically updates booking and appends the no-show event. Rules repeat the server-time grace check. |
| Client booking message / read flags | `BookingConversationPanel.jsx` | Existing `bookingCommunicationRepository` direct SDK methods | Immutable booking owner or permitted booking admin, with per-participant read-flag boundary | Existing Firestore message create/read behavior is retained; Admin status messages are now additionally tied to the corresponding decision transaction. |
| Client cancellation request | Client booking detail / conversation | Existing `bookingCommunicationRepository` direct SDK method | Immutable booking owner | Remains a request state on the booking and does not permit direct Client cancellation. Final Admin decision uses the decision transaction above. |
| Public calendar availability read | `src/pages/PublicBookingPage.jsx` | `subscribeClientCalendarSlots` | Public read of non-customer slot metadata | Listener is scoped to the currently displayed seven-day window and capped at 500 documents. Public documents contain booking ID, date/time/duration, generic status/title and session label, not customer contact or identity. |
| Admin schedule booking read | Schedule / dashboard consumers | `subscribeManualBookings` | Approved booking-data readers | Bounded subscription with a default cap of 500 and maximum 1,000 documents; query errors remain visible through the existing subscription callback. |
| Client-owned booking read | Client Portal | `subscribeClientBookingsForUser` | Client filters use immutable UID plus legacy email/phone compatibility | OR query across identity fields is capped at 250; returned data is normalized for legacy booking/invoice identities. |

## 3. Firestore collection and Rules contracts

| Collection / document | Purpose | Read boundary | Write boundary |
| --- | --- | --- | --- |
| `bookings/{id}` | Canonical booking/request and session state | Approved users with booking-data access; owning Client only | Narrow Schedule admin create/update contracts or existing owner-safe Client message/cancellation/read updates; no delete |
| `clientCalendarSlots/{id}` | Public availability mirror | Public read of reduced, non-customer metadata | Schedule admin only; must match the booking's post-write state and matching schedule revision |
| `bookingScheduleDays/{date}` | Per-date revision/concurrency guard | Approved Schedule admin | Schedule admin only; create/update is accepted only together with a booking document whose `updatedAt` changes in the same atomic operation; revision is create=1 or update=old+1; delete denied |
| `bookingMessages/{id}` | Booking conversation and decision messages | Booking admin and owning Client | Participant message/read rules retained; Admin `type=status` messages must match the paired booking decision |
| `bookingSessionEvents/{id}` | Append-only check-in/start/complete/no-show/cancel history | Approved Schedule admin | Schedule admin create only when the booking's latest-event pointer is updated atomically; update/delete denied |
| `users/{uid}/repositoryOperations/{operationId}` | Per-user replay/conflict marker | Same UID under Phase 1 contract | Client SDK can create only the strict immutable marker contract; it grants no permission to read/write the booking result |
| `bookkeepingEntries/{id}` | Existing ledger | Finance readers | This phase adds only a narrow create exception for an immutable `source='booking-payment'` entry paired atomically with the existing manual booking's `pending → recorded` ledger-status transition. The entry must match that booking's single initial payment record. Other Finance writes remain unchanged. |

### Rules invariants

- A mirror slot cannot be created, changed, or removed independently of the booking and schedule-day revision that justify it.
- A schedule-day revision cannot be bumped independently of a booking create/update in the same atomic operation.
- Booking creation validates a strict key set and payment summary consistency. When an initial payment exists, a separate, idempotent transaction writes the matching ledger entry and changes the internal ledger status to `recorded`; Rules reject the status transition without that ledger companion.
- Booking manual updates use an allow-list and preserve Finance/payment/session/request fields.
- Decision message, booking request state, day revision, slot state and cancellation event are linked using `getAfter()` / `existsAfter()`.
- Session state transitions have explicit prior-state checks. A session event is append-only and must match the booking's post-write last-event pointer.
- Client ownership is based on canonical Firebase Auth UID and immutable `clientUid`, not a UI-only flag or email match.
- Unauthenticated writes, cross-user Client writes, malformed data, direct schedule marker/slot writes, forged initial ledgers and session event mutation/deletion are denied.

## 4. Transaction, idempotency, retry and query behavior

- All operation IDs, request IDs, operation timestamps, message IDs and event IDs are prepared before transaction callbacks. Transaction callbacks contain Firestore reads/writes only.
- Manual create, manual update, decisions, and session actions reuse `runIdempotentFirestoreTransaction` and the Phase 1 marker collection. Initial payment ledger completion uses its own deterministic `initial-payment-ledger` operation marker so a retry can finish the second step without replaying the booking/calendar transaction.
- Committed retries validate actor/scope/action/request ID/payload hash and read back the recorded booking result instead of repeating the transition.
- Schedule preflight reads are bounded to at most 251 booking documents for one date. More than 250 yields a visible, fail-closed error before writes.
- Public slot listener: displayed seven-day date range, maximum 500.
- Admin booking listener: default 500, maximum 1,000.
- Client booking listener: maximum 250.
- All current Phase 2 query patterns use only single-field equality/range/order shapes (booking `date`; slot `date`; Client identity equality/OR). No new composite index is identified by this phase audit. Existing repository composite indexes for Follow-up remain unchanged. Emulator success is not proof that any production index has been deployed.

## 5. Worker/API scope

The following browser request paths are now designed to call Firebase Web SDK directly:
- Manual booking create.
- Manual booking edit/reschedule.
- Booking request decision.
- Booking session check-in/start/complete/no-show.
- Client booking request create.
- Public calendar availability read.

The Worker route implementations and their historical contract tests are intentionally retained for now. Removing the Worker routes, shared `adminOperationsRepository.js`, service-account configuration, and unrelated Worker/EmailJS references belongs to Phase 6, after all domain migrations and explicit traffic/dependency checks. Phase 2 does not claim global Worker retirement.

## 6. Production and release status

- No production Rules export/deploy, index deploy, Hosting deploy, or production data mutation has been performed as part of this phase.
- The Phase 1 production baseline caveat remains in force: deployed production Rules source was not exported/compared. Never deploy this repository's Rules wholesale before a live export/merge review and explicit approval.
- PR #18 remains Draft and unmerged.
- Phase 2 is not complete until the full acceptance gates in the handoff pass, including production build, ESLint, `npm test`, `npm run test:prd`, Firestore Rules Emulator coverage, regression contracts, responsive browser smoke, keyboard/focus QA, and GitHub Actions Quality Gates.
