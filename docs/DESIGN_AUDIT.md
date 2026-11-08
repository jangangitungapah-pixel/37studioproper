# DESIGN_AUDIT — 37StudioProper Premium Enterprise Overhaul

## Audit metadata
- Audit baseline: 2026-11-06
- Source branch: feature/admin-ops-phase-5-procurement-2026-11-05
- Redesign branch: feature/ui-overhaul-premium-enterprise-2026-11-06
- Baseline commit: ad207cb6735fea266eb2c26fe0338e5c5e6b837f
- Scope: Phase 0 repository audit and baseline; no application source changes in this commit.

## Repository baseline
- React 19, Vite 8, JSX, React Router 7, Firebase 12 / Firestore.
- lucide-react, Motion, Radix UI, Recharts.
- Tailwind CSS 3.4.17; CSS modules organized by shell, route, and feature.
- Existing dependency stack already supplies the animation, icon, primitive, and chart layers. No new UI dependency is justified before targeted component needs are identified.

## Inventory (recursive repository tree at baseline)
- 24 page-related paths under src/pages (including directories); page modules include public landing, login, client portal, PWA launch, AdminPage, Guard attendance, and 13 admin area modules.
- 63 component-related paths under src/components (including directories); shared families include admin shell, client portal, booking, billing, bookkeeping, inventory/procurement, settings, gallery, guard, and UI primitives.
- 39 stylesheet paths (including directories); grouped styles include route styles, modules, public, auth, client, and spatial foundation.
- 82 test scripts under scripts.
- 43 documentation paths under docs (including directories).

## Canonical routes from src/App.jsx and docs/ui-rewrite-code-map.md
- / -> ClientLandingPage
- /launch -> PwaLaunchPage
- /login -> LoginPage
- /book -> PublicBookingPage
- /client/login -> ClientSpatialRoute + ClientLoginPage
- /client/portal -> ClientSpatialRoute + ClientPortalPage
- /client -> ClientLandingPage alias
- /guard -> redirect to /guard/attendance
- /guard/attendance -> GuardAttendancePage
- /admin/* -> AdminPage internal navigation
- * -> redirect to /login
- Preserve legacy admin aliases and query/hash/deep-link behavior defined by navigation resolver.

## Admin page inventory
- Dashboard, Booking Requests, Schedule/Calendar, All Bookings, Customers, Billing, Bookkeeping, Operator Fee, Guard Attendance, Inventory (including Procurement and Maintenance workspaces), Gallery, Notifications, Settings, Auto Approve.
- Internal admin navigation is data-driven from src/config/adminNavigation.js and page rendering is orchestrated in src/pages/AdminPage.jsx.

## Theme foundation
- ThemeProvider supports light, dark, and system preference.
- Stored key: 37studioproper.theme.v1.
- New user default currently Light.
- src/index.css defines semantic studio tokens and backwards-compatible ui aliases; [data-theme='light'] overrides shared semantic variables.
- Admin page wraps itself with ThemeProvider and SpatialUiProvider.
- Theme markup should remain shared; migrate styling through tokens, avoid duplicate light/dark component trees.

## CSS and ownership architecture
- Official maps available: docs/ui-rewrite-code-map.md and docs/css-module-map.md.
- Rule: edit owning files, avoid shell selectors from feature page CSS, avoid !important except temporary emergency hotfix, maintain clear shell/shared/route/feature ownership.
- Existing styles include src/styles/spatial-foundation.css, src/styles/modules/admin-shell.css, per-feature modules, and route aggregators.
- Do not delete legacy CSS before all consumers and contracts are mapped.

## Existing design and technical debt signals
- src/index.css still contains layered radial/linear backgrounds and legacy alias variables; review whether they align to Premium Enterprise without breaking old consumers.
- Existing tokens cover colors, surfaces, text, borders, status, radius, spacing, typography, shadows, and z-index, but token completeness/contrast/use is not yet fully validated.
- Older audit docs report oversized page/CSS modules, hardcoded colors, inline styling, and class ownership uncertainty. Treat these as historical evidence to verify against current branch, not as current measured counts.
- Avoid broad file splitting during initial foundation unless it directly enables safe shared UI migration.

## CI baseline
Latest Quality Gates run #172 on baseline commit ad207cb6735fea266eb2c26fe0338e5c5e6b837f:
- npm ci: PASS
- npm run build: PASS
- npm run lint: PASS
- npm test: FAIL in scripts/procurement-workflow-contract-test.mjs.
- Exact failing assertion expects orders.filter((order) => !['draft', 'cancelled'].includes(order.status)); current ProcurementWorkspace computes outstandingTotal with that expression but in the live file the implementation uses a multi-line filter expression. The test failure should be investigated against current source and updated only if the assertion is demonstrably stale; do not weaken domain coverage.
- npm run test:prd: SKIPPED after npm test failure.
- Playwright responsive browser smoke: SKIPPED after npm test failure.
- Previous docs indicate older green CI runs, but they are not evidence for current baseline HEAD.
- No source-level test or browser visual QA is claimed passed for this redesign.

## Staging and production safety
- docs/audits/STAGING-ACCEPTANCE-READINESS-2026-10-29.md says the checked environment targets production project/site/Worker and there is no separate staging alias configured.
- Do not run mutation-based acceptance against production; do not deploy, mutate secrets, modify Firebase project configuration, enable billing, or perform destructive gallery/inventory tests.
- No production deploys or changes made during Phase 0.

## Phase 0 conclusion
- Repository identity and baseline commit confirmed.
- New feature branch created from the latest procurement branch.
- Required audit docs exist.
- Route/page/component/style/test inventory captured.
- Build and lint are green on CI; regression suite has a known Procurement source-contract mismatch.
- Continue with targeted reconciliation of that source contract and complete full baseline gates before major UI changes.
- Authenticated staging walkthrough and visual screenshot coverage remain pending.

## Sources
- PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md
- docs/ui-rewrite-code-map.md
- docs/css-module-map.md
- docs/ui-final-css-sweep.md
- docs/ui-precision-damage-audit.md
- docs/audits/FOUNDATION-AND-ADMIN-PORTAL-AUDIT-2026-10-20.md
- docs/audits/ADMIN-PORTAL-WORKFLOW-AUDIT-2026-10-20.md
- docs/audits/LANDING-AND-AUTHENTICATION-AUDIT-2026-10-20.md
- docs/audits/CLIENT-PORTAL-AUDIT-2026-10-20.md
- docs/audits/STAGING-ACCEPTANCE-READINESS-2026-10-29.md
