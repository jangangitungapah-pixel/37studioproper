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

## Phase 4 direct repository implementation status (2026-11-10)

The migration branch now routes the following operational writes directly through the Firebase Web SDK. This describes branch source code only; it does not assert that production Rules/Hosting have been deployed.

- **Customer Follow-up:** `customerFollowUpFirestoreRepository.js` creates, updates and cancels follow-up tasks with immutable event records and per-user repository operation markers. Assignee discovery reads approved user profiles/ownership directly.
- **Inventory:** `inventoryFirestoreRepository.js` owns item save/archive/adjustment and immutable movement snapshots. The Maintenance lifecycle may change only the item status/condition and its Maintenance linkage pointers through a WorkOrder/event companion transaction; it cannot change stock quantity.
- **Procurement:** `procurementFirestoreRepository.js` owns supplier and Purchase Order lifecycle, Goods Receipt and Procurement Payment. Goods Receipt atomically updates received quantities, inventory balances, stock movements, receipt, PO and event. Payment atomically links the PO, payment document, immutable procurement expense, procurement event, Daily Closing activity fence and operation marker.
- **Maintenance:** `maintenanceFirestoreRepository.js` owns WorkOrder report, transitions, Owner-only reopen and one-time actual-cost posting. WorkOrder writes require a linked append-only event, revision/actor/permission checks, inventory lock state and idempotency marker. Cost posting also links an immutable `source: maintenance` bookkeeping entry and the open Daily Closing fence.
- **Worker boundary:** The Maintenance UI no longer calls the Admin Operations Worker, and the obsolete Maintenance wrappers were removed from `adminOperationsRepository.js`. Worker route/domain code is temporarily retained as a migration/regression reference while other application domains still depend on the Worker.

The new Maintenance Rules Emulator coverage is wired into `npm run test:rules` via `scripts/firestore-maintenance-rules-test.mjs`. Local build, lint, regression and emulator verification for this Phase 4 branch revision is pending. No production Rules/index/Hosting change or production data mutation is implied.

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
- Manual booking create first atomically writes an unpaid booking with empty payment history, date revision and calendar mirror; when an initial payment exists, it also stores an immutable `initialPaymentIntent`. A second idempotent Firebase transaction reads that intent, adds the first payment-history record and payment summary, writes the immutable `booking-payment` ledger, updates the calendar slot status, and changes the booking's internal ledger status from `pending` to `recorded`. If interrupted, an Edit/Save on the pending booking can recover from the persisted intent after reload without duplicating the booking. Booking request decisions and session actions retain their own atomic message/event companions. General Finance writes remain outside Phase 2.
- Public availability reads only the reduced `clientCalendarSlots` documents and are bounded to the displayed seven-day range (500 maximum). Admin booking listeners are bounded to 500 by default (1,000 maximum); Client booking OR queries are capped at 250.
- Schedule collision checks read at most 251 booking documents for the target date and fail closed above 250. The query uses one `date ==` field constraint and the repository's existing single-field index; no new composite index is identified for Phase 2's audited query shapes.
- Phase 2 validation completed successfully in GitHub Actions Quality Gates run #460 (run ID `42524355174`, commit `b3255b2dfad30a6bb0adbe837913df365d5df3ab`): build, lint, 84/84 regression contracts, PRD/security contracts and Firestore Emulator, responsive browser smoke, keyboard/focus QA, and artifact upload all passed.
- This audit describes repository/source query requirements only. It does not prove production index deployment, and it does not replace the required production Rules export/merge review before any deployment.

## Phase 3 Finance, payment-proof, bookkeeping, and daily-closing audit (2026-11-09)

| Operation | Direct Firebase entry point | UI entry point | Authorization / invariant contract | Current evidence and caveat |
| --- | --- | --- | --- | --- |
| Payment posting | `financeRepository.recordPayment` in `src/services/firestoreFinanceRepository.js` | `src/pages/admin/BillingPage.jsx` | `financeBookingPaymentUpdateAllowed`, `financeBookingLedgerCreateAllowed`, `financeActivityFenceUpdateAllowed`, repository operation marker | Booking projection, payment-history event, immutable `booking-payment` ledger, business fence, and marker are committed through one idempotent transaction. Rules Emulator invariant fixture accepts a valid partial payment and denies overpayment; passed in Quality Gates #504. |
| Refund | `financeRepository.recordRefund` | `src/pages/admin/BillingPage.jsx` | `financeBookingRefundUpdateAllowed`, `financeBookingLedgerCreateAllowed`, `financeActivityFenceUpdateAllowed`, repository operation marker | Refund is bounded by gross paid less prior refunds; booking projection, refund history, immutable expense ledger, fence, and marker are atomic. Rules Emulator invariant fixture accepts a valid partial refund and denies over-refund; passed in Quality Gates #504. |
| Invoice void | `financeRepository.voidInvoice` | `src/pages/admin/BillingPage.jsx` | `financeBookingVoidUpdateAllowed`, schedule-day companion guard, calendar-slot delete guard, finance fence, operation marker | Void requires zero net paid amount; retains existing payment/ledger history and releases the public slot with a schedule revision. Rules Emulator invariant fixture accepts void for an unpaid invoice and denies void for a paid invoice; passed in Quality Gates #504. |
| Client payment reference | `submitPaymentProof` in `src/services/paymentProofRepository.js` | `src/pages/ClientPortalPage.jsx`, `src/components/client/ClientBookingWizard.jsx` | `clientCreatesPaymentProof` | Metadata only: booking ownership, amount/method/category, payer name, transaction reference; no payment-proof upload or binary. Active-booking allow and refunded-booking deny cases are included in the Rules Emulator behavior test. |
| Payment-proof review | `approvePaymentProofDirect`, `rejectPaymentProofDirect` | `BillingPage.jsx`, `PaymentProofCommandCenter.jsx` | `paymentProofReviewUpdateAllowed`, `approvedPaymentProofMatchesAfter`, repository operation marker | Review is one-time from pending; approval pairs proof state with booking payment history and immutable ledger. Rejection is marker-backed. Repository/source contracts and the broader Rules suite passed in #504; the dedicated Finance invariant fixture does not separately claim a positive/negative approval/rejection workflow case. |
| Manual bookkeeping | `createManualBookkeepingEntry`, `updateManualBookkeepingEntry`, `deleteManualBookkeepingEntry`; wrapper `src/services/bookkeepingRepository.js` | Admin Bookkeeping page | `validManualBookkeepingEntry`, `manualBookkeepingCreateOrUpdateAllowed`, `manualBookkeepingDeleteAllowed`, manual activity fence | Manual journal create is tested with journal + fence + operation marker in one Emulator batch; direct writes and closed-day edits/deletes are denied. Reconciled/system-generated rows remain read-only. |
| Daily closing | `dailyClosingRepository.preview/close/reopen` | `src/components/bookkeeping/DailyClosingWorkspace.jsx` | `dailyClosingSessionTransitionAllowed`, `cashClosingEventReferencesSessionAfter`, Owner-only reopen, operation marker | Preview reconciles source rows by Asia/Jakarta business date; close compares the activity revision before committing the snapshot/event; reopen preserves prior snapshot history. Rules Emulator invariant fixtures accepted Bookkeeping-admin close, denied Bookkeeping-admin reopen, and accepted canonical-Owner reopen; passed in Quality Gates #504. |

### Phase 3 data and compatibility decisions

- `bookings` remains the source of canonical payment/refund histories and financial projections; `bookkeepingEntries` remains the immutable ledger for reconciled booking finance events and the editable surface only for manual entries.
- `paymentProofs` stores the submitted transaction reference and payer metadata. New records must not include proof image URL or Cloudinary public ID. Legacy image fields remain readable/retained for historical records; no asset or historical document cleanup is implied.
- `cashClosingSessions/{YYYY-MM-DD__main}` and append-only `cashClosingEvents` retain closing snapshots, source fingerprints, transaction references, and reopen history. The application explicitly supports register `main` only in this phase.
- Booking/payment/ledger/fence/operation markers must be treated as one logical atomic write. Notification events are best-effort side effects and are not authoritative for payment success.
- The previous Worker finance and daily-closing implementations remain in the repository as comparison references until Phase 6. Do not delete Worker code or configuration during Phase 3.
- The close-out audit corrected legacy fallback payment date interpretation to the `Asia/Jakarta` business date and aligned repository/Rules denial of new proof references for void/refunded invoices.
- This document maps repository source and current emulator fixtures. It is not a production-data reconciliation, proof of deployed Rules parity, or proof that all production composite indexes are present.



### Phase 3 validation and close-out (2026-11-09)

- Quality Gates **#504** (run ID `42577721924`) completed with overall conclusion **success** on final PR HEAD `bd90b2abfa184773366050ac654c98df08bd3ce7`; all 17 workflow steps passed.
- Build, lint, regression contracts, PRD/security contracts, Firestore Rules Emulator, responsive browser smoke, keyboard/focus QA, and QA evidence upload passed.
- The PRD/security CI step runs `test:prd`; that command invokes `npm run test:rules`, which includes `firebase-finance-rules-invariant-test.mjs`.
- Finance Rules Emulator invariant cases passed: valid partial payment accepted; overpayment denied; valid partial refund accepted; over-refund denied; unpaid invoice void accepted; paid invoice void denied; Bookkeeping-admin daily close accepted; Bookkeeping-admin daily reopen denied; canonical-Owner daily reopen accepted.
- The broader Rules behavior test accepts metadata-only payment-reference creation on an active booking and denies creation for a refunded booking. New proof submissions remain metadata/reference-only, without binary upload.
- Run #504 uploaded `phase-9-browser-accessibility-qa` and `dependency-audit-report` artifacts. These are CI artifacts, not a production validation.
- The Finance invariant cases establish Firestore Rules allow/deny behavior for the tested linked writes. They do not constitute production data reconciliation, deployed Rules parity validation, or end-to-end production verification of every payment-proof review branch.
- Production prerequisites remain open: export/compare the active production Rules baseline (previously recorded release `aa6d3469-9101-4c7a-8ede-bcba9894d38a`), verify production composite index `customerFollowUpTasks(status, dueAt, dueTime)`, and reconcile production financial data before any publication.
- No production Rules/index change, Hosting/Worker deployment, or production data mutation was performed.

**Phase 3 status: CLOSED** on 2026-11-09 after final HEAD Quality Gates #504 passed. PR #18 remains Draft and unmerged; Phase 4 has not started.
