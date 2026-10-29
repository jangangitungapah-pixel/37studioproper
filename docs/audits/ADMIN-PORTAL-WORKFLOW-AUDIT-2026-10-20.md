# Admin Portal Workflow Audit — Phase 2

Date: 2026-10-29
Baseline: `main` commit `3da18e39c03b9e3fe76b422cb2d65c3215cfeafd`
Related specification: `PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md`

## Scope and verification status

Latest verified code head: `93a24ddaf7647c756bf2b49319ac3d0ff6c0132e`.

GitHub Actions run [#63](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/40768647291) passed all gates on this head: `npm ci`, production build, lint, the full `npm test` regression chain, and `npm run test:prd` including Worker/security contracts, Admin shell contracts, and Firestore Rules behavior. This confirms repository checks, not browser/mobile rendering or live staging behavior. Those acceptance checks remain open.


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

## P0 booking occupancy race: remediation implemented and CI-covered

The stale-snapshot race was identified in Request Inbox decisions and tracked as P0. The active booking mutation paths have now been routed through a shared date-coordination protocol using `bookingScheduleDays/{date}` with Firestore update-time / existence preconditions and atomic writes.

### Implemented paths

- **Manual create** — `createManualBooking()` checks server-side occupancy, then writes the booking and the date revision under a precondition.
- **Request decision** — `decideBookingRequest()` in `workers/admin-operations-worker/src/domain/bookings.js` now handles confirm, reject, and approved cancellation. Confirmation re-queries current bookings and writes the booking, status aliases, message, calendar mirror, and date revision atomically. A lost date-revision precondition is retried and revalidated.
- **Manual schedule edit/reschedule** — `updateManualBooking()` checks occupancy on the server and coordinates both the old and new date revisions, along with the booking/calendar mirror. Expected update timestamps reject stale form snapshots.
- **Invoice void** — the finance Worker increments the affected date revision and removes the public client calendar mirror in the same idempotent commit, because a void invoice makes the booking non-blocking under the canonical selector.
- **Metadata-only edits** — client code avoids echoing stale schedule/status fields back into Firestore when no schedule mutation was requested.

### Regression coverage and status

The Worker contract suite now verifies:
- Two overlapping Request Inbox confirmations cannot both succeed.
- Confirmation racing with manual booking creation cannot double-claim a slot.
- Confirmation racing with manual reschedule to the same slot permits only one mutation.
- Adjacent sessions meeting exactly at the previous end time remain valid.
- A reschedule into an occupied interval fails and a reschedule to a free date succeeds.
- Invalid/missing/coerced start hours are rejected before writing.
- A `cancellation_requested` booking continues to occupy its slot until its cancellation is approved.
- Rejection requires a reason; invoice void removes the public slot and increments the date revision.

**Status: implemented across the active create, request-decision, schedule-edit/reschedule, and void paths; full build, lint, regression, PRD, and Firestore Rules checks passed in CI run #59.** This is not a claim that live staging behavior has been browser-tested.

Direct client deletion remains forbidden by Firestore Rules. Any future booking-deletion UI must use the same server mutation boundary and date-coordination protocol before it is enabled; it must not introduce a direct-write bypass.

## Additional P0 access consistency fix

The Worker now checks `adminControl/ownership.currentOwnerUid` against the authenticated UID when the user document declares `role: owner`. This aligns Worker authorization with the canonical owner rule and prevents a stale Owner role from retaining privileged server operations after an ownership transfer. Security contract coverage checks active owner, former owner, legacy no-control state, and ordinary approved admin behavior. This is verified in the same latest CI run.


## Admin shell responsive alignment

The Admin shell CSS had drifted from PRD v3.0: the spatial navigation rail used 258 px expanded / 78 px collapsed, and desktop shell rules activated from 768 px. The PRD design calls for a 224–240 px expanded rail, a 72 px collapsed rail, and a mobile shell for tablet-portrait widths.

The branch now sets the rail to **240 px expanded / 72 px collapsed**, moves desktop shell media queries to **900 px and wider**, and extends the mobile-shell rules through **899 px**. The desktop, navigation rail, workspace, mobile-shell, and shell-hardening source contracts were updated to enforce the same numbers and breakpoints.

**Status: source-level alignment implemented and all automated gates passed in CI run #63.** Screenshot-based desktop/tablet/mobile verification is still pending.

## Other source-level observations

1. Admin navigation routes are canonicalized and legacy aliases exist. Preserve them unless route migration is deliberate and tested.
2. Mobile primary navigation is explicitly contracted as Dashboard / Requests / Calendar / Finance, with secondary sections in a More sheet. Keep that information architecture aligned to the PRD.
3. The application includes domain contracts around booking lifecycle and accounting. Extend the contracts when changing behavior rather than relying on markup-only tests.
4. Sensitive flows include booking approvals, payment proof, payments/refunds, bookkeeping, inventory adjustments, account permissions, and guard attendance. Each needs explicit loading/success/failure handling and durable audit trails.

## Required runtime acceptance sequence

1. The automated gates are green on code head `33d7c63ed0ae47c3528d88560d42d9d160d980c5`; rerun them after any further code changes.
2. In a staging/emulator environment, verify the actual client/admin data flow and:
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

1. Complete browser/mobile and Firebase staging/emulator acceptance for booking confirm/reject/cancel, booking reschedule, invoice void, and the Owner-transfer access matrix.
2. Validate payment proof → payment posting → ledger, partial/full refund, guard attendance → operator fee, and inventory adjustment with real test records and audit trails.
3. Compare the Admin shell and primary workflows (Requests, Calendar, All Bookings, Billing) against PRD v3.0 on desktop and 360–430 px mobile. Capture screenshots, keyboard/focus behavior, reduced-motion behavior, and console errors.
4. Continue through Client Portal, authentication entry points, then landing/public booking in the order defined by the PRD.

## Status

- [x] Source route and navigation contracts reviewed.
- [x] Admin workspace and sensitive operations identified.
- [x] `npm ci`, production build, lint, full `npm test`, and `npm run test:prd` passed on code head `93a24ddaf7647c756bf2b49319ac3d0ff6c0132e` (Actions run #63).
- [x] Shared date-revision coordination implemented and race tests passed for confirm/confirm, confirm/manual create, and confirm/reschedule.
- [x] Invoice void updates the date revision and removes the public calendar mirror atomically.
- [x] Worker Owner authorization checks the canonical ownership UID and is covered by the security contracts.
- [x] Admin shell rail dimensions and 900 px desktop / 899 px mobile breakpoint alignment passed shell contracts.
- [ ] Screenshot-based browser/mobile and live staging data-flow QA executed.
- [ ] UI/workflow acceptance verified against PRD v3.0.
