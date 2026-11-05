# Landing Page and Authentication Audit — 2026-10-20

## Scope and honesty of status
This is a repository source review only. Build, lint, tests, browser QA, Firebase emulator, and production flows have not been run in this environment.

## Landing page observations
- `src/pages/ClientLandingPage.jsx` combines public marketing content with authenticated user-state handling and a booking-price planner.
- The landing page submits its planner form to `/book`; its local planner state is not passed into the public booking route in the handler. Check whether this is intentional UX, or whether selected service/date/time/duration should be carried into `/book` so the user does not need to select everything again.
- Hero content displays “Bekasi · Open daily” and “10.00—23.00 WIB”. Confirm these claims against current business settings and `src/constants/scheduleConfig.js`, including timezone and holiday exceptions.
- The hero image is loaded from `/images/studio_hero_banner.png`. Verify that the file exists in the deployed public assets and is appropriately optimized.
- The public landing page subscribes to client auth and, for authenticated users, client booking history. Verify that public-page loading/errors are not blocked by slow profile or booking queries and that logged-in role changes clear stale client state.

## Authentication findings / checks
- Admin/Guard login is implemented by `src/pages/LoginPage.jsx`; client login is separate in `src/pages/ClientLoginPage.jsx`.
- Admin redirect sanitizer limits paths to `/admin` and `/guard` namespaces. Client redirect helper limits destinations to the client portal and public booking. Keep these policies separate and test all direct URL and query variants.
- Client login performs Firebase auth, role resolution, client profile sync, Google redirect handling, and phone OTP. Verify that error/loading state cannot remain stuck after redirect results or an auth-state change.
- Client login invokes `window.recaptchaVerifier`. Verify cleanup under unmount/re-entry and prevent duplicate verifier instances after repeated OTP attempts.
- Admin/Guard login routes based on intent/role. Validate that Guard intent cannot accidentally redirect a client/admin to an unrelated route and that client accounts cannot enter the admin shell.
- Password reset, account-decision flows, wrong-portal states, provider differences, and sign-out/session-switch behavior require real Firebase project QA.

## Ordered implementation decision
1. Complete test execution, role matrix and booking/finance checks before visual change.
2. Admin Portal high-risk workflow cleanup first.
3. Client Portal navigation/data-flow polish.
4. Admin and client login error/loading/role UX verification.
5. Landing conversion: preserve selections into public booking where desired, confirm business claims and assets, add SEO/metadata and optimize image/mobile performance.

## Status
- [x] Source reviewed.
- [ ] Runtime tests and lint/build.
- [ ] Auth-provider QA.
- [ ] Landing /book handoff browser QA.
- [ ] Mobile, keyboard, and reduced-motion QA.
