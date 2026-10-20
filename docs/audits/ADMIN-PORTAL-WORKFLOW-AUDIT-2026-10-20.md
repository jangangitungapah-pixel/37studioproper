# Admin Portal Workflow Audit — Phase 2

Date: 2026-10-20
Baseline: `main` commit `3da18e39c03b9e3fe76b422cb2d65c3215cfeafd`
Related specification: `PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md`

## Scope of this source review

This is a source-level audit only. The repository's Node scripts, build, lint, browser layout, and Firebase emulator have not been executed in this environment. No claims of runtime pass/fail are made.

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
| P0 | Payment / ledger | Single posting, idempotency, refund/void correctness, no duplicate ledger entries, audit metadata |
| P1 | Booking requests | Approve/reject/cancellation reason validation, status synchronization with client portal, calendar conflict behavior |
| P1 | All bookings / calendar | URL-backed filters, return navigation, date/time consistency, availability mirrors after changes |
| P1 | Customers | Customer identity, booking history ownership, search and pagination behavior |
| P1 | Guard attendance / operator fee | UID-bound attendance, owner review, role permission, fee eligibility and no duplicate posting |
| P1 | Inventory / gallery | Permission enforcement, adjustments/deletions, idempotency, external asset failures and retry behavior |
| P2 | Shell UI | All viewport sizes, dropdown/modal stacking, keyboard focus, forced-colors, reduced-motion, empty/error/loading states |

## Source-level observations

1. Admin navigation routes are canonicalized and legacy aliases exist. Preserve them unless route migration is deliberate and tested.
2. Mobile primary navigation is explicitly contracted as Dashboard / Requests / Calendar / Finance, with secondary sections in a More sheet. Keep that information architecture aligned to the PRD.
3. The application includes a substantial number of domain contracts around booking lifecycle and accounting. Extend the contracts when changing behavior rather than relying on markup-only tests.
4. Sensitive flows include booking approvals, payment proof, payments/refunds, bookkeeping, inventory adjustments, account permissions, and guard attendance. Each needs explicit loading/success/failure handling and durable audit trails.

## Required runtime acceptance sequence

1. Run `npm ci`, `npm run build`, `npm run lint`, `npm test`, `npm run test:prd`.
2. Test the client booking handoff regression script added by the foundation audit branch.
3. In a staging project, test:
   - Client booking request → admin inbox → approve/reject → client state refresh.
   - Invoice → proof submission → proof review → canonical payment → ledger totals.
   - Partial/full refund and void → updated outstanding balance and history.
   - Booking cancellation → calendar availability freed only under the correct lifecycle rules.
   - Guard check-in/out → owner review → fee eligibility/reconciliation.
   - Inventory quantity adjustment → audit note and visible stock update.
4. Repeat high-priority paths at 360–430 px mobile, tablet, and desktop.
5. Capture screenshots and browser console errors; verify focus order, keyboard operation, and reduced motion.

## Next implementation order

1. Resolve validation failures revealed by the actual run; do not guess at test outcomes.
2. Fix any confirmed access, booking, payment, or ledger defect before a visual overhaul.
3. Align the Admin shell and first workflows (Requests, Calendar, All Bookings, Billing) to PRD v3.0, retaining current business rules.
4. Proceed to remaining workspaces, Client Portal, login pages, then landing/public booking.

## Status

- [x] Source route and navigation contracts reviewed.
- [x] Admin workspace and sensitive operations identified.
- [ ] Build, lint, tests executed.
- [ ] Browser and staging data-flow QA executed.
- [ ] UI/workflow changes verified against PRD.
