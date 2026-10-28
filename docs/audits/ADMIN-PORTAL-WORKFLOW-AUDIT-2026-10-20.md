# Admin Portal Workflow Audit — Phase 2

Date: 2026-10-29
Baseline: `main` commit `3da18e39c03b9e3fe76b422cb2d65c3215cfeafd`
Related specification: `PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md`

## Scope and verification status

This is a source-level workflow review plus initial GitHub Actions verification. Build and lint passed on commit `d51fcb9adadb284d26ea3b4d5c338761eb2fab85`; its regression step failed because the booking-date regex on that commit had incorrectly escaped digit tokens. The regex was corrected in commit `4c208c0a09f2ab04f1bcc560dac211b01bc611a2`, and the latest Actions run is pending/in progress at the time of this update. Do not infer that the full regression suite or PRD/Firestore suite passed from the earlier run. Browser and staging/emulator QA remain incomplete.

## Admin workflow map

The current route navigation and components expose:
- Dashboard and notification operations
- Booking request inbox and calendar
- All bookings
- Customers
- Billing, payment proof review, refunds/voids
- Bookkeeping ledger
- Operator fee
- Guard attendance review
- Inventory
- Gallery
- Settings

Routing and permissions are centralized across `src/config/adminNavigation.js`, `src/pages/AdminPage.jsx`, `src/utils/adminPermissions.js`, and Firestore rules. The visual guard in AdminPage is not sufficient alone; operations and Firestore rule conditions must independently enforce access.

## Priority review matrix

| Priority | Flow | Verify |
|---|---|---|
| P0 | Admin/owner access | Direct URL, refresh, role change, session switch, missing/denied Firestore data, role-specific route resolution |
| P0 | Booking occupancy concurrency | Concurrent confirmation, confirmation vs manual create, manual reschedule vs confirmation, canonical occupancy coordination across write paths |
| P0 | Payment / ledger | Single posting, idempotency, refund/void correctness, no duplicate ledger entries, audit metadata |
| P1 | Booking requests | Approve/reject/cancellation reason validation, status synchronization with client portal, calendar conflict behavior |
| P1 | All bookings / calendar | URL-backed filters, return navigation, date/time consistency, availability mirrors after changes |
| P1 | Customers | Customer identity, booking history ownership, search and pagination behavior |
| P1 | Guard attendance / operator fee | UID-bound attendance, owner review, role permission, fee eligibility and no duplicate posting |
| P1 | Inventory / gallery | Permission enforcement, adjustments/deletions, idempotency, external asset failures and retry behavior |
| P2 | Shell UI | All viewport sizes, dropdown/modal stacking, keyboard focus, forced-colors, reduced-motion, empty/error/loading states |

## Confirmed source-level finding: booking confirmation can validate against a stale occupancy snapshot

Affected paths:
- `src/services/bookingCommunicationRepository.js`: `resolveDecisionBookings()` queries bookings for the selected date before `runTransaction()`. Inside the transaction, the code reads the target booking document and validates against the previously fetched `decisionBookings` array.
- `src/pages/admin/BookingRequestsPage.jsx`: the Request Inbox calls `bookingCommunicationRepository.updateBookingRequestStatus()` when confirming a request.
- `workers/admin-operations-worker/src/domain/bookings.js`: server-side manual creation runs `assertSlotAvailable()` and writes `bookingScheduleDays/{date}` with an update-time precondition to coordinate concurrent manual creations.
- `src/services/adminBookingRepository.js`: `updateManualBooking()` updates the booking and client calendar mirror in a batch after reading the current booking, without using the same date coordination document or a cross-record overlap check.

The Request Inbox transaction does not read/write the same `bookingScheduleDays/{date}` coordination record used by server-side manual creation. Its pre-transaction query also does not make other booking documents part of the transaction's read set. Two concurrent confirmations can therefore check overlapping occupancy against stale snapshots and both attempt to confirm. The manual creation coordination mechanism does not by itself serialize this confirmation path or direct rescheduling path.

**Status: identified, not fixed. Do not claim concurrent slot integrity is guaranteed.**

### Required remediation design

1. Establish one canonical booking mutation boundary for confirm, cancel, manual create, manual edit/reschedule, and deletion. All occupancy-changing paths must participate in the same coordination protocol.
2. Use a per-date revision/lock or canonical slot-occupancy record inside the atomic write protocol; refresh and evaluate conflicting intervals after acquiring coordination, and fail with a conflict response when another booking has claimed the interval.
3. Migrate/reconcile legacy bookings before treating a new occupancy manifest as authoritative. Preserve the rule that `cancellation_requested` continues to occupy the slot until cancellation is approved.
4. Add deterministic tests for two simultaneous confirmations of overlapping requests, confirmation racing with manual creation, manual reschedule racing with confirmation, same-day non-overlapping bookings, and the exact end-time boundary.
5. Route all relevant writers through the canonical protocol. Fixing only Request Inbox would leave a bypass and would be incomplete.

A partial client-side lock or cosmetic warning is not an acceptable remediation for this finding.

## Other source-level observations

1. Admin navigation routes are canonicalized and legacy aliases exist. Preserve them unless route migration is deliberate and tested.
2. Mobile primary navigation is explicitly contracted as Dashboard / Requests / Calendar / Finance, with secondary sections in a More sheet. Keep that information architecture aligned to the PRD.
3. The application includes domain contracts around booking lifecycle and accounting. Extend the contracts when changing behavior rather than relying on markup-only tests.
4. Sensitive flows include booking approvals, payment proof, payments/refunds, bookkeeping, inventory adjustments, account permissions, and guard attendance. Each needs explicit loading/success/failure handling and durable audit trails.

## Required runtime acceptance sequence

1. Pass `npm ci`, `npm run build`, `npm run lint`, `npm test`, and `npm run test:prd` in GitHub Actions.
2. Test the client booking handoff regression script on the latest branch head.
3. In staging/emulator, test:
   - Client booking request → admin inbox → approve/reject → client state refresh.
   - Two overlapping pending requests confirmed concurrently.
   - Confirmation racing with manual booking creation and manual reschedule.
   - Invoice → proof submission → proof review → canonical payment → ledger totals.
   - Partial/full refund and void → updated outstanding balance and history.
   - Booking cancellation → calendar availability freed only under the correct lifecycle rules.
   - Guard check-in/out → owner review → fee eligibility/reconciliation.
   - Inventory quantity adjustment → audit note and visible stock update.
4. Repeat high-priority paths at 360–430 px mobile, tablet, and desktop.
5. Capture screenshots and browser console errors; verify focus order, keyboard operation, and reduced motion.

## Next implementation order

1. Resolve any failures reported by the latest automated validation.
2. Address P0 booking occupancy concurrency at the shared mutation boundary before further booking UI polish.
3. Verify Admin/Owner access and sensitive payment/ledger invariants.
4. Align the Admin shell and first workflows (Requests, Calendar, All Bookings, Billing) to PRD v3.0, retaining current business rules.
5. Proceed to remaining workspaces, Client Portal, login pages, then landing/public booking.

## Status

- [x] Source route and navigation contracts reviewed.
- [x] Admin workspace and sensitive operations identified.
- [x] Build and lint passed on the earlier branch commit.
- [ ] Latest targeted regression and full regression suite passed.
- [ ] PRD / Firestore emulator suite passed.
- [ ] Booking occupancy concurrency remediated across all write paths.
- [ ] Browser and staging data-flow QA executed.
- [ ] UI/workflow changes verified against PRD.
