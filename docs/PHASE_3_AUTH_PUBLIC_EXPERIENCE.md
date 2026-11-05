# Phase 3 — Authentication & Public Experience

## Status
**COMPLETE — UI implementation and required automated/browser quality gates passed.**

Scope completion does not imply production Firebase integration was tested. The CI preview did not have live booking availability data or authenticated test identities. Those limitations are recorded below and must not be represented as successful live-data/authenticated-session QA.

## Scope implemented

### Admin and Guard authentication
- Retained the existing shared `/login` surface and Guard portal intent / redirect flow.
- Replaced route-local forced-light palette overrides with shared Light / Dark / System semantic theme tokens.
- Added browser connectivity feedback when the device reports offline.
- Added the form's `aria-busy` state while preserving existing submission and provider behavior.

### Client login and account access
- Removed the Client login's forced-light root palette and aligned it with global semantic theme tokens.
- Added a semantic warning treatment for offline feedback and exposed the form busy state.
- Preserved Firebase email and Google sign-in, role resolution, client profile synchronization, safe next-path handling, and account-role decision flows.

### Public landing and booking
- Clarified the existing booking planner handoff: selected date and start hour are sent to the public calendar; service and duration are chosen after Client sign-in.
- Added browser online/offline connectivity status to the public booking header. When offline, the page warns that displayed availability may be stale.
- Preserved the canonical public booking route, calendar subscription, slot occupancy / past-slot checks, and auth-resume path.

## Approved UI library layers retained
1. UI foundation: shadcn/ui + Base UI
2. Styling: Tailwind CSS v4
3. Animation: Motion
4. Visual components: Magic UI
5. Icons: Lucide React
6. Notifications: Sonner
7. Tables: TanStack Table
8. Charts: Apache ECharts
9. Forms: React Hook Form + Zod

Existing Radix UI consumers remain supported. No dependency was added or removed for this phase.

## Files changed
- `src/pages/LoginPage.jsx`
- `src/pages/ClientLoginPage.jsx`
- `src/pages/ClientLandingPage.jsx`
- `src/pages/PublicBookingPage.jsx`
- `src/styles/modules/auth.css`
- `src/styles/client-auth.css`
- `src/styles/client-landing.css`
- `src/styles/public-booking.css`
- `scripts/admin-login-ui-overhaul-contract-test.mjs`
- `scripts/phase-3-auth-public-experience-contract-test.mjs` (new)
- `scripts/browser-responsive-smoke.mjs`
- `package.json`
- `docs/REDESIGN_WORKPLAN.md`
- `docs/PHASE_3_AUTH_PUBLIC_EXPERIENCE.md`

## Behavior deliberately preserved
- Admin and Guard continue to share the existing authentication page.
- Admin redirect sanitization remains restricted to existing Admin / Guard path namespaces.
- Firebase email and Google sign-in / redirect behavior remains owned by the existing authentication repository.
- Client authorization remains based on the authoritative account-role resolver. Existing wrong-portal and pending / inactive decision flows remain intact.
- Client resume destinations continue to use the existing safe-path helper.
- Public availability continues to use the canonical slot subscription and occupied / past-slot checks.
- Booking request creation remains in the authenticated Client Portal wizard, not on the public landing page or public calendar.
- No role, permission, Firestore rule, Worker, data model, pricing, schedule, or booking business logic was changed.

## Verification evidence

### Git commits
- UI implementation: `3c33d0eeb76f810399cfe235e806d8c70806d7d8`
- Admin theme-contract assertion correction: `12dbba73108ab01962b73af243d8cb14a5a74117`
- Expanded responsive routes (Admin, Guard, Client): `85d212bc4fd020f87492e12510a4a112d51623cc`
- Browser offline/online interaction checks: `8f6fc45f2dd67785a65985a28cd28780da2793bc`

### GitHub Actions
Run #207: [Build, lint, regression, security and responsive browser smoke](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42113108469)

Commit tested: `8f6fc45f2dd67785a65985a28cd28780da2793bc`

Results:
- Production build: PASS
- ESLint: PASS
- Regression contracts / `npm test`: PASS
- PRD and Firestore security contracts: PASS
- Playwright / Chromium responsive browser smoke: PASS
- Screenshot artifact upload: PASS (artifact ID `13455167952`)

### Responsive visual QA
Six route families were captured at three viewport widths (18 combinations):
- Landing
- Public booking
- Admin login
- Guard login
- Client login
- Signed-out Admin protected route / redirect

Viewports: mobile 390 px, tablet 768 px, desktop 1440 px.

All 18 route/viewport cases returned HTTP 200. The Playwright smoke measured document width equal to viewport width in all cases, with no horizontal overflow. Landing planner handoff passed at all three widths, forwarding `date=2026-11-12` and `startHour=14`. Signed-out Admin route redirect passed at all three widths.

Offline/online transitions were exercised in the browser at all three viewports for Admin login, Guard login, Client login, and public booking. The warning appeared while offline and disappeared after network restoration.

Captured screenshots were visually inspected for layout hierarchy, form visibility, responsive stacking, and the public booking fallback state.

## Known limitations / remaining QA
- The CI preview could not retrieve live booking availability. Public booking rendered the existing “Jadwal belum dapat dimuat” fallback state. This verifies the page/error-state layout and offline status, not successful live slot rendering, slot selection, or booking request creation with live Firebase data.
- Real Firebase email/Google provider sign-in, account-role transitions, pending/denied account experience, and authenticated Admin/Guard/Client sessions require a safe staging environment and test identities. Those authenticated integrations were not exercised in this CI run.
- Browser `navigator.onLine` reports device network connectivity, not guaranteed reachability of Firebase or every upstream service. Auth and availability operations retain their own error handling.
- Phase 2's authenticated Admin workspace / Client Portal / Guard Portal visual QA and the wider global navigation visual overhaul remain tracked for the relevant later phase; this Phase 3 completion does not claim those surfaces were redesigned.
- Landing copy claims about studio location / operating hours were not modified or independently verified in this scope.

## Follow-up
During staging QA, use non-production test identities and synthetic booking data to verify:
1. Admin and Guard credential/provider success, invalid credentials, wrong-portal handling, redirect and session expiry.
2. Client role decisions for supported pending/denied states and safe resume.
3. Live calendar slot loading, availability changes, occupied/past slots, and authenticated booking request creation.
