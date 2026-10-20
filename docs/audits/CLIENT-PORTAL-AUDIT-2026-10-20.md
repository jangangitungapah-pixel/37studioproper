# Client Portal Audit — Booking Ownership and Data Boundaries

Date: 2026-10-20

## Scope

Source review of `src/App.jsx`, `src/pages/ClientPortalPage.jsx`, `src/components/client/ClientSpatialRoute.jsx`, `src/utils/clientBookingHandoff.js`, `src/services/accountRoleRepository.js`, and Firestore rules. Browser, emulator, and Node-based verification are pending.

## Existing journey

- `/` — public landing
- `/book` — public availability and slot selection
- `/client/login` — client authentication and safe resume redirect
- `/client/portal` — authenticated workspace
- Client booking writes are intended to remain owned by Client Portal / the canonical repository flow.
- Public booking is expected to hand off the selection through a validated route, with occupancy rechecked after authentication.

## Source-level finding addressed on this audit branch

The original resume parser accepted values matching only the `YYYY-MM-DD` text shape, including impossible calendar dates such as `2026-02-31`. The hour validator also accepted fractional hours and JavaScript numeric coercion could treat an empty value as zero. The audit branch now checks a real Gregorian calendar date and integer hours from 0–23, with regression coverage in `scripts/client-booking-handoff-security-regression-test.mjs`.

This change is source-inspected but not yet runtime-verified.

## Required QA

1. Open public booking, choose a valid future date/time, sign in, and verify the intended slot is preselected.
2. Change availability in a second session before completing auth; confirm a now-occupied slot cannot be booked.
3. Feed malformed resume dates, missing/fractional/out-of-range hours, and redirect attempts toward admin/guard/external URLs; confirm safe fallback.
4. Verify client data reads and writes remain scoped to the authenticated UID and rules reject direct unauthorized access.
5. Confirm booking status and payment-proof status reflect Admin changes without mixing their distinct lifecycle meanings.
6. Test invoice details, cancellation request, payment-proof upload failure/retry, empty/error states, and narrow mobile viewport.

## Status

- [x] Source-level parser issue fixed on audit branch.
- [x] Regression test added and registered with `npm test`.
- [ ] New regression test executed.
- [ ] Build/lint/full suites executed.
- [ ] Browser and Firestore emulator QA completed.
