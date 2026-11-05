# Phase 3 — Authentication & Public Experience

## Status
IMPLEMENTED; automated quality gates and post-commit browser evidence are pending. Do not mark complete until the relevant CI run and available screenshot QA have been inspected.

## Scope implemented

### Admin and Guard authentication
- Kept the existing shared `/login` surface and Guard portal intent / redirect flow.
- Replaced the Admin login's fixed light palette overrides with the shared Light / Dark / System semantic tokens.
- Added browser connectivity feedback when the device reports offline.
- Added the form's `aria-busy` state while preserving the existing submission state and provider flow.

### Client login and account access
- Removed the Client login's fixed light palette overrides and aligned it to the same semantic theme tokens.
- Added a semantic warning treatment for offline feedback and exposed the form busy state.
- Preserved Firebase email and Google sign-in, role resolution, client profile synchronization, safe next-path handling, and explicit account-role decision flows.

### Public landing and booking
- Clarified the booking planner handoff: the selected date and start hour are sent to the public calendar; service and duration are chosen after Client sign-in.
- Added a browser connectivity status to the public booking header. When offline, the page explicitly warns that the displayed availability may be stale.
- Preserved the canonical public booking route, calendar subscription, slot occupancy / past-time logic, and auth-resume path.

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

Existing Radix UI consumers remain supported. No package was added or removed for this phase.

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
- `package.json`
- `docs/REDESIGN_WORKPLAN.md`

## Behavior deliberately preserved
- Admin and Guard continue to share the existing authentication page.
- Admin redirect sanitization remains restricted to the existing Admin / Guard path namespaces.
- Firebase email and Google sign-in / redirect behavior remains owned by the existing authentication repository.
- Client authorization remains based on the authoritative account-role resolver. Existing wrong-portal and pending / inactive decision flows remain intact.
- Client resume destinations continue to use the existing safe-path helper.
- Public availability continues to use the existing canonical slot subscription and occupied / past-slot checks.
- Booking request creation remains in the authenticated Client Portal wizard, not in the public landing page or public availability calendar.
- No role, permission, Firestore rule, Worker, data model, pricing, schedule, or booking business logic was changed.

## Validation
- A focused Phase 3 source contract was added to `npm test`.
- Existing Admin login contract was updated to require active theme-token inheritance rather than the previous light-only palette.
- Automated build, lint, complete regression, PRD / Firestore security, and responsive browser smoke results are pending the GitHub Actions run for this commit.
- Browser visual QA screenshots and actual visual inspection at 390 px, 768 px, and 1440 px are pending. Do not infer them from CSS or source contracts.

## Known limitations
- Browser `navigator.onLine` reports the device's network connectivity state, not guaranteed reachability of Firebase or every upstream service. Auth and availability operations retain their own error handling.
- Real Firebase provider, account-role, and live booking behavior still require a safe authenticated staging session; the UI-only changes do not replace that QA.
- Landing copy claims about studio location / operating hours were not modified or independently verified in this scope.
