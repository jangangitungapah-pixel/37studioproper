# REDESIGN_WORKPLAN — 37StudioProper Premium Enterprise SaaS

## Project direction
Deliver one coherent Premium Enterprise SaaS visual language across public, admin, client, and guard experiences while preserving every domain workflow, route, role boundary, Firestore rule, Worker contract, and existing compatibility behavior.

## Git rules
- Base: feature/admin-ops-phase-5-procurement-2026-11-05 @ ad207cb6735fea266eb2c26fe0338e5c5e6b837f
- Work branch: feature/ui-overhaul-premium-enterprise-2026-11-06
- Never merge or deploy without explicit user permission.
- No force push. No work on main.
- No production mutation, billing enablement, secrets changes, Firebase configuration changes, or destructive media operations.

## Phase 0 — Audit & baseline
Status: COMPLETE. Repository, route, architecture, styling ownership, and test baseline audit captured; baseline Quality Gates run #199 passed.
- Confirm branch, HEAD, repository tree, route/page/component/style/test inventory.
- Read PRD, route map, code map, CSS map, audits, staging readiness.
- Record package and theme architecture.
- Resolve regression source-contract mismatch; then run build, lint, npm test, npm run test:prd.
- Visual browser baseline only where CI/tooling and safe test state permit.

Acceptance: no undocumented P0/P1 blocker; current baseline commands recorded; inventory source-grounded.

## Phase 1 — Design system foundation
Status: COMPLETE. Design-system foundation committed; Quality Gates run #199 passed build, lint, regression, PRD/Firestore security contracts, and responsive browser smoke.
- Integrated shadcn configuration with Base UI, Tailwind CSS v4 Vite plugin, Motion, Magic UI NumberTicker, Lucide React, Sonner, TanStack Table, Apache ECharts, React Hook Form and Zod.
- Preserved legacy Radix components during selective migration; new menu primitive uses Base UI.
- Migrated the Dashboard cashflow chart from Recharts to Apache ECharts.
- Added semantic typography, spacing, control geometry, content widths, focus, motion, elevation, overlays and chart palette tokens for Light/Dark.
- Refreshed source-owned shared primitives and added styles for new data/menu/chart/notification/ticker components.
- Added foundation and library integration tests.
- Extend semantic CSS custom properties only after verifying existing tokens and consumer compatibility.
- Define palette, semantic status roles, typography scale, numeric typography, spacing, radius, elevation, focus ring, control heights, content widths, breakpoints, z-index and motion tokens.
- Preserve Light/Dark/System and existing preference key/default.
- Migrate shared primitives from source-owned files: Button, fields, select, badge, tooltip, dialogs, drawers, tabs, toast, table primitives, access/error/empty/loading states.
- Keep Radix as the primitive foundation unless a specific compatibility gap justifies an isolated alternative. Do not install Base UI/shadcn/Magic UI wholesale.
- Add/extend accessibility and CSS ownership contracts.

Acceptance: semantic token source of truth, both themes share markup, primitives have interaction states, existing shared UI contracts pass.

## Phase 2 — Global shells & navigation
Status: COMPLETE WITH DOCUMENTED AUTHENTICATED-VISUAL-QA LIMITATION.
- Verified and retained the existing Admin spatial shell: desktop navigation rail, context-aware topbar/workspace, mobile dock, and More dialog.
- Aligned Admin More sheet close behavior to the 900 px desktop-shell breakpoint.
- Added keyboard skip links and focus targets for Admin, Client, and Guard shells with reduced-motion and forced-colors handling.
- Client desktop navigation now exposes the current page with aria-current; existing mobile bottom navigation remains intact.
- Guard return-to-Admin action remains visible on narrow screens and has an accessible label.
- Public landing menu button is associated with its navigation using aria-controls.
- Preserved canonical public booking link and route behavior.
- No auth, role, permission, Firestore rules, data model, Worker/API, or business workflow changes.
- Quality Gates run #202 on commit dde2f6451e70f761d92c42a757d6343039854265 passed production build, ESLint, regression contracts, PRD/Firestore security contracts, Playwright/Chromium responsive browser smoke, and screenshot upload.
- Screenshot artifact 13453135018 contains landing, public booking, and signed-out Admin at 390/768/1440 px. Visual inspection was performed for landing desktop/mobile, public booking tablet, and signed-out Admin mobile/tablet.
- Limitation: authenticated Admin workspace, Client Portal, and Guard Portal screenshots were not part of this smoke run and were not visually inspected. Schedule their authenticated visual review during Phase 9 unless safe test identities become available earlier.

Acceptance: shell navigation contracts, build/lint/regression/PRD-security contracts, and available responsive smoke pass. Remaining authenticated visual evidence is tracked explicitly for Phase 9.

## Phase 3 — Authentication & public experience
Status: COMPLETE — UI scope and required automated/browser quality gates passed. Live Firebase availability and authenticated-session integration QA limitations are documented below.
- Admin/Guard shared login: replaced route-local forced-light overrides with shared Light/Dark/System semantic theme tokens; added accessible offline feedback and form busy state.
- Client login: aligned its root surface to global Light/Dark/System tokens; added semantic offline feedback and form busy state.
- Landing planner: explains the existing handoff precisely; date and start hour transfer to /book, while service and duration are chosen after Client sign-in.
- Public booking: displays truthful online/offline status and warns that visible availability may be stale when the browser reports offline.
- Preserved role resolution, redirect sanitization, provider flows, safe booking resume, canonical slot subscriptions, occupancy checks, and validation contracts.
- Added Phase 3 source regression contract and Playwright coverage for Admin, Guard, Client login, landing, public booking, and signed-out Admin route.
- Playwright offline/online state transitions pass for all three login routes and the public booking route at 390/768/1440 px.
- Responsive smoke run #207 on commit 8f6fc45f2dd67785a65985a28cd28780da2793bc passed build, lint, regression, PRD/Firestore security, Chromium browser smoke, and screenshot upload.
- Screenshot artifact: browser-responsive-smoke, artifact ID 13455167952. All 18 route/viewport cases returned HTTP 200; measured document width equaled viewport width in every case; landing planner date/startHour handoff passed at all three widths.
- Visual inspection performed on the captured screenshots for all six routes at mobile 390 px, tablet 768 px, and desktop 1440 px.
- QA limitation: the CI preview could not load live calendar availability and displayed the existing “Jadwal belum dapat dimuat” state. Real Firebase slot data, successful slot selection/request creation, and authenticated Admin/Guard/Client account sessions still require a safe staging environment and test identities. Do not claim those integrations were exercised in CI.
- Phase 2 authenticated workspace and full navigation visual limitations remain tracked for Phase 9; Phase 2 global navigation visual overhaul is not implied complete by this phase.

Acceptance: Admin/Guard/Client auth surfaces, public landing and public booking UI contracts pass; signed-out Admin redirect passes at all tested viewports; responsive smoke and offline/online feedback pass. Live availability and authenticated account integration remain explicit staging QA items.

## Phase 3A — Client landing conversion UX hardening (pre-Phase 4)
Status: COMPLETE — implementation, automated regression, responsive browser smoke, and screenshot evidence verified by Quality Gates run 42118757052 on commit 335fc3263f68120f16aaa024f6328890dc1c30c1 (SUCCESS).
- Refined the client landing page with the existing Motion engine and Magic UI NumberTicker: section reveals, hero entrance, card/button feedback, scroll progress, animated estimate, and mobile navigation/CTA interactions.
- Service story actions now select the matching estimator service and guide the visitor to the planner.
- Package mode is unavailable when the configured package list is empty; recording estimates use the selected Recording Type duration; invalid custom durations no longer produce a misleading price.
- Date and hour are validated before the calendar handoff. A visible preview explains the calendar values that will be carried to the public booking page.
- Preserved the Phase 3 trust boundary: only date and startHour are forwarded to /book; service/duration remain selected after client sign-in.
- Booking history is cleared when auth state changes to prevent a previous client's information flashing on a new session. Mobile menu locks background scrolling and closes with Escape or backdrop interaction.
- Shared StudioSelect gets reduced-motion-aware open/option micro-interactions. This is a scoped primitive enhancement, not a global library migration.
- Added scripts/client-landing-experience-contract-test.mjs to npm test.
- Browser smoke scrolled all seven Motion-reveal sections into view before screenshot capture and verified visible reveal completion. It also verified the Rehearsal service shortcut and mobile menu/backdrop/scroll lock.

Acceptance: landing selection and pricing states are deterministic, empty package state is safe, booking handoff remains date/startHour only, previous user booking state is cleared on auth changes, reduced-motion is respected, and mobile CTA/menu remain usable.

## Phase 4 — Admin core operations
Status: COMPLETE — required regression contracts and CI quality gates passed; manual responsive testing was also confirmed by the user on 2026-11-06.

- Scope covered the existing Admin core operations surfaces: Dashboard, Booking Requests, Calendar, All Bookings, Customers, shared booking detail drawer, and booking form/modal.
- Refined interaction feedback using the existing Motion/token system: staged page entrances, action hover/press/focus states, booking/request row feedback, calendar card interactions, drawer and mobile bottom-sheet transitions, booking form focus-within states, and improved All Bookings table text legibility.
- Added or extended `prefers-reduced-motion` handling for the new interaction effects so hover/press movement and transitions are suppressed when reduced motion is requested.
- All changes in this Phase 4 pass were scoped to the owning page/component stylesheets. No page JSX, business logic, routes, permissions, APIs, repositories, data models, Firestore contracts, booking lifecycle, or calendar synchronization behavior was changed.
- Files touched:
  - `src/styles/modules/dashboard.css`
  - `src/styles/modules/booking-requests.css`
  - `src/styles/modules/schedule.css`
  - `src/styles/modules/all-bookings.css`
  - `src/styles/modules/customer.css`
  - `src/styles/modules/booking-detail-drawer.css`
  - `src/styles/modules/booking.css`
- Implementation commits:
  - `3596846365f363561767ecb9a85e0aa42be15afc` — `feat(admin): refine phase 4 core operations UX`
  - `c770cbde4662347b8932245978214037aff4dafc` — `fix(admin): honor reduced motion in phase 4 interactions`
- Quality Gates run #216, run ID `42124939739`, on commit `c770cbde4662347b8932245978214037aff4dafc` completed successfully: production build, lint, regression contracts, PRD/Firestore security contracts, responsive browser smoke, and screenshot artifact upload.
- Manual responsive testing was confirmed by the user on 2026-11-06. The automated responsive browser smoke also passed.
- Authenticated Admin workspace visual inspection is not claimed complete. Capture/review of authenticated Admin screens, including the full responsive/theme matrix, remains explicitly scheduled for Phase 9.

Acceptance: Phase 4 regression contracts and booking/customer/calendar contract coverage pass; production build and lint pass; responsive browser smoke passes; user confirms manual responsive testing. Authenticated visual QA evidence remains a Phase 9 item and does not block this phase's automated/source-contract acceptance.

## Phase 5 — Admin finance & operations
Status: COMPLETE — owner surfaces audited, UI interaction refinements implemented, and required automated quality gates passed on 2026-11-06. Authenticated staging visual inspection remains an explicit Phase 9 item because no dedicated non-production environment/session is configured.

- Audited the existing owner surfaces and their contracts before implementation:
  - src/pages/admin/BillingPage.jsx — invoices, payments, and payment-proof review.
  - src/pages/admin/BookkeepingPage.jsx — bookkeeping ledger and daily-closing workspace.
  - src/pages/admin/OperatorFeePage.jsx — operator fee review and related meal reconciliation surface.
  - src/pages/admin/InventoryPage.jsx — inventory, procurement, and maintenance workspaces.
  - src/pages/admin/GuardAttendancePage.jsx — owner-side guard attendance review.
  - src/pages/guard/GuardAttendancePage.jsx — standalone guard self-service attendance portal.
- The branch already contained the UI-6 through UI-10 spatial page foundations. This Phase 5 implementation refined the owner styles rather than replacing their layout architecture:
  - Consistent focus-visible treatment for Billing actions and fields.
  - Focus-within context and tactile press feedback for invoice/payment/proof actions, ledger controls, operator-fee decisions, inventory/procurement/maintenance actions, guard review decisions, and guard self-service actions.
  - Shared motion tokens used for new transitions; reduced-motion rules explicitly suppress the added transforms and transitions.
- Added scripts/admin-finance-operations-interactions-contract-test.mjs and registered it in npm test so Finance & Operations interaction states and reduced-motion behavior remain covered by regression.
- Files changed:
  - src/styles/modules/billing.css
  - src/styles/modules/bookkeeping.css
  - src/styles/modules/operator-fee.css
  - src/styles/modules/inventory.css
  - src/styles/modules/guard-attendance.css
  - src/styles/modules/guard-portal.css
  - scripts/admin-finance-operations-interactions-contract-test.mjs
  - package.json
- Implementation commit: 2f3bb61e649bfda172122ea026d9769ba75b40f6 — feat(admin): refine phase 5 finance and operations interactions.
- Quality Gates run #218, run ID 42146646993, tested commit 2f3bb61e649bfda172122ea026d9769ba75b40f6 and completed SUCCESS:
  - npm run build — success.
  - npm run lint — success.
  - npm test — success, including the Phase 5 interaction contract and registered finance, proof-review, bookkeeping, operator-fee, inventory, procurement, refund/void, and guard-attendance regression contracts.
  - npm run test:prd — success, including PRD, Worker, and Firestore security contracts.
  - Playwright responsive browser smoke — success.
  - Screenshot artifact browser-responsive-smoke uploaded successfully (artifact ID 13470716951).
- Responsive smoke covered the public landing and booking surfaces, Admin/Guard/Client login entry points, and the signed-out redirect for /admin/finance/invoices at the configured responsive viewports. It does not authenticate to Finance, Procurement, Bookkeeping, Operator Fee, or Guard workspaces and is not evidence of authenticated visual QA.
- Business and data contracts were intentionally left unchanged: no page JSX, route, role/permission, Firebase Auth, Firestore rules/collections, repository, Worker authorization, payment state transition, invoice identity, idempotency, ledger, refund/void, inventory movement, procurement transition, attendance audit, or production-data changes. No production data was used for QA; no merge or deployment was performed.
- Known QA limitation carried forward:
  - Authenticated Admin Finance/Operations and Guard visual walkthroughs remain unverified at mobile/tablet/desktop sizes.
  - The staging-readiness audit records that the current default Firebase/Worker configuration is production-facing (studio-proper, studio-37.web.app, APP_ENVIRONMENT=production). Do not perform mutating Finance, Procurement, Inventory, Attendance, Gallery, or destructive-action acceptance against those production targets.
  - Complete authenticated visual QA in Phase 9 after a separate Firebase Spark staging project, isolated Worker environment, and synthetic accounts/data are available.

Acceptance: source ownership and existing finance/procurement/guard contracts audited; interaction implementation is present in owner stylesheets; build, lint, npm test, npm run test:prd, and responsive browser smoke pass; screenshot evidence is uploaded; business/financial/Worker/attendance contracts remain unchanged; authenticated visual/staging limitations are documented and carried into Phase 9. Use emulators and synthetic fixtures only for any future operation-contract testing.

## Phase 6 — Content, notifications & settings
Status: COMPLETE — Gallery, Notification Center, and Settings owner surfaces audited and interaction/state refinements implemented on 2026-11-06. Existing security, media, notification-event, Owner-only, and settings persistence contracts were preserved.

- Audited actual owners and source contracts:
  - Gallery: src/pages/admin/GalleryPage.jsx, gallery components including src/components/gallery/GalleryAlerts.jsx, src/styles/modules/gallery.css, galleryRepository, and cloudinaryUploadService.
  - Notification Center: src/pages/admin/NotificationsPage.jsx, src/styles/modules/notifications.css, notificationEventRepository, plus existing Admin navigation and notification badge ownership.
  - Settings: src/pages/admin/SettingsPage.jsx, src/styles/modules/settings.css, existing settings hooks/utilities and Owner-only operations.
- Gallery refinements:
  - A failed Firestore Gallery subscription now exposes a retry action that creates a fresh subscription; the retry control appears only for that subscription failure.
  - Added keyboard focus and press feedback for Gallery actions, with reduced-motion and forced-colors support.
  - Existing Gallery component ownership, Cloudinary upload contract (12 MB gallery limit and existing folder/tags), metadata identity, soft-delete/restore behavior, and protected Owner-only permanent delete remain unchanged.
- Notification Center refinements:
  - Status filters expose their selected state with aria-pressed, and subscription changes show loading feedback.
  - Added an explicit retry action after feed subscription errors and clarified the empty state for search versus a status with no events.
  - Added focus/focus-within feedback, shared-token transitions, reduced-motion handling, and forced-colors styling.
  - The actual product contract is an immutable in-app Firestore activity feed with event statuses. No read/unread model, OneSignal/push delivery, retry/cancel mutation, or event schema was introduced.
- Settings refinements:
  - Added consistent keyboard focus visibility across controls and links plus press feedback for navigation and action controls.
  - Existing URL-backed area resolution, Owner-only query guards, Danger Zone/ownership protections, form draft state, and persistence behavior were not changed.
- Added scripts/content-notification-settings-interaction-contract-test.mjs and registered it in npm test.
- Files changed:
  - src/pages/admin/GalleryPage.jsx
  - src/components/gallery/GalleryAlerts.jsx
  - src/styles/modules/gallery.css
  - src/pages/admin/NotificationsPage.jsx
  - src/styles/modules/notifications.css
  - src/styles/modules/settings.css
  - scripts/content-notification-settings-interaction-contract-test.mjs
  - package.json
- Implementation commit: a1a3fd8048717760ebc92981b5507f15162e2484 — feat(admin): refine phase 6 gallery notifications and settings UX.
- Quality Gates run #220, run ID 42152760568, completed SUCCESS on the implementation commit:
  - npm run build — success.
  - npm run lint — success.
  - npm test — success, including existing Gallery, Notification Console, Settings, permission, media safety, and the new Phase 6 interaction contract.
  - npm run test:prd — success, including PRD, Worker, and Firestore security contracts.
  - Playwright responsive browser smoke — success.
  - Screenshot artifact browser-responsive-smoke uploaded successfully (artifact ID 13472683710).
- The automated browser smoke exercises existing public landing/booking routes, login entry points, and the signed-out direct Admin route redirect at configured viewport sizes. It does not authenticate into Gallery, Notification Center, or Settings and is not authenticated visual QA for those pages.
- Contract boundaries deliberately preserved: no changes to Gallery repository/service, Cloudinary payload/configuration, Firestore rules/collections, notification event repository/schema, OneSignal retirement, Admin role/permission logic, settings persistence, account provisioning, Danger Zone, Worker/API, or production data/media. No merge or deployment was performed.
- Known QA limitation carried forward:
  - Authenticated visual walkthrough of Gallery, Notification Center, and every Settings subpage remains unverified.
  - Staging-readiness audit still identifies the existing default Firebase/Worker configuration as production-facing (studio-proper, studio-37.web.app, APP_ENVIRONMENT=production). Do not run mutating live acceptance against those targets.
  - Complete authenticated visual QA in Phase 9 after a separate Firebase Spark staging project, isolated Worker environment, and synthetic identities/data are available. Do not enable billing or upgrade to Blaze.

Acceptance: Gallery subscription retry and protected media actions, immutable in-app notification feed/state, Settings persistence and Owner-only access, and shared interaction/reduced-motion behavior are covered by source contracts; production build, lint, npm test, npm run test:prd, and responsive browser smoke pass; screenshot evidence is uploaded; no production mutation occurred; authenticated/staging limitations are recorded for Phase 9.

## Phase 7 — Client Portal
Status: IN PROGRESS — recipient-scoped notifications, explicit client data subscription states, availability gating, and conversation interaction hardening implemented on 2026-11-06. Full quality gates and completion evidence remain pending.

- Audited current source ownership:
  - Route boundary: src/App.jsx and src/components/client/ClientSpatialRoute.jsx.
  - Main authenticated workspace and orchestration: src/pages/ClientPortalPage.jsx.
  - Client views: src/components/client/ClientDashboardTab.jsx, ClientCalendarTab.jsx, ClientHistoryTab.jsx, ClientBookingWizard.jsx, ClientBillingTab.jsx, ClientBookingsHub.jsx, ClientAccountTab.jsx.
  - Booking detail conversation: src/components/booking/BookingConversationPanel.jsx.
  - Owner styles: src/styles/routes/client.css, src/styles/modules/client-portal-overhaul.css, src/styles/modules/booking.css.
  - Data services: adminBookingRepository, clientProfileRepository, accountRoleRepository, bookingCommunicationRepository, paymentProofRepository, notificationEventRepository; pricing/invoice/studio settings and Cloudinary upload remain existing dependencies.
  - Firestore ownership: bookings, bookingMessages, paymentProofs, customers, notificationEvents, and public-safe clientCalendarSlots rules. Client role/auth resolution remains owned by accountRoleRepository and existing Firestore rules.
- Implemented:
  - Added subscribeClientNotificationEvents with a Firestore query constrained to targetUid == authenticated UID and a second client recipient filter (targetMode=user, targetRole=client).
  - Added ClientNotificationsPanel as a read-only activity surface. It preserves the existing immutable activity event model; no read/unread actions, notification mutation, OneSignal, or push delivery were introduced.
  - Added notification entry points to desktop and mobile headers. Notification booking navigation resolves only through the current client's already-scoped userBookings collection; raw event URLs are not trusted for navigation.
  - Auth identity changes clear prior-client bookings, payment proofs, notifications, and selected booking detail before resolving the new identity.
  - Booking, payment-proof, calendar-slot, and notification subscriptions now expose loading/error states with retry actions. The calendar remains non-actionable when slot availability has not been verified.
  - Booking request submission rechecks the latest available slot snapshot and blocks known occupied slots before writing.
  - Booking conversation now has explicit loading/error/retry states, preserves the draft after send failure, and follows PRD keyboard behavior: Enter sends; Shift+Enter inserts a line break.
  - Dashboard and booking history now show canonical request, payment, and session lifecycle labels separately through booking selectors and status metadata; history filters expose aria-pressed state.
  - Booking detail surfaces now separate request, payment, session, and proof-review states. The invoice balance no longer describes the payment status as “Lunas / Selesai”.
  - Mobile booking conversation composer receives sticky positioning and safe-area padding within the booking detail surface.
  - Added scripts/client-portal-phase-7-contract-test.mjs and registered it in npm test.
- Current changed files:
  - docs/REDESIGN_WORKPLAN.md
  - package.json
  - scripts/client-portal-phase-7-contract-test.mjs
  - src/components/booking/BookingConversationPanel.jsx
  - src/components/client/ClientCalendarTab.jsx
  - src/components/client/ClientDashboardTab.jsx
  - src/components/client/ClientHistoryTab.jsx
  - src/components/client/ClientNotificationsPanel.jsx
  - src/pages/ClientPortalPage.jsx
  - src/services/notificationEventRepository.js
  - src/styles/modules/booking.css
  - src/styles/modules/client-portal-overhaul.css
- Business and security contracts deliberately preserved:
  - No Firestore rules, collections, indexes, schemas, Worker, account-role mapping, or canonical booking/payment writes changed.
  - No payment proof status is displayed as paid/success by this work.
  - Notification feed is read-only and does not invent an unread state.
  - Calendar revalidation is client-side against the latest subscription snapshot, not a transactional reservation lock. The existing createClientBookingRequest write is unchanged; atomic concurrent slot reservation remains a known domain-level limitation and must not be claimed as solved by this UI work.
  - No production data, proof upload, payment, or booking mutation was run.
- Targeted Phase 7 source contract is registered in `npm test`. A connector-driven source inspection exercised its key contracts successfully, including recipient UID scoping, Firestore immutability, canonical lifecycle selectors, calendar availability gating, conversation keyboard/retry behavior, and accessibility selectors. This is not equivalent to executing the Node test file locally.
- Full `npm run build`, `npm run lint`, `npm test`, `npm run test:prd`, and Playwright responsive smoke have not been executed in this environment. The container cannot resolve github.com for a repository clone, and the GitHub connector exposes no push-triggered workflow run/check-run listing. Do not mark acceptance passed based on source inspection alone.
- Known verification limitations:
  - Local working tree on the user's PC is not observable from the GitHub connector.
  - The connector does not expose push-triggered workflow-run listing; commit status query currently returns no status contexts. Confirm actual Quality Gates run/checks before marking Phase 7 complete.
  - Authenticated browser walkthrough remains blocked until an isolated Firebase Spark staging project, staging Worker and Hosting environment, and synthetic accounts/data are available. Do not use the production-facing default Firebase/Worker targets for write acceptance.

Acceptance: overview, bookings, calendar/detail, conversation, payment/proof, account and notifications must be source-audited and modernized; client ownership/isolation and business contracts must remain correct; targeted Client contracts, build, lint, npm test, npm run test:prd and responsive browser smoke must pass; authenticated staging limitations must be explicitly documented.
- Responsive client shell, plain-language statuses and clear task actions.
- Preserve client ownership and isolation.

Acceptance: client portal isolation, booking handoff and payment contracts pass.

## Phase 8 — Cross-app completion
- Inventory-driven sweep of remaining page and component families.
- Audit legacy classes, duplicated control variants, inconsistent spacing, inline styles, native-looking controls, and ownership conflicts.
- Remove legacy styles only after proving no remaining consumers.

Acceptance: every inventory item classified redesigned/tested/visually verified/blocked.

## Phase 9 — Responsive, accessibility & visual QA
- Test 360, 390, 430, 768, 900, 1024, 1280, 1440, 1920 widths.
- Light, dark, system; keyboard, focus, contrast, reduced motion, modal/dropdown, overflow, loading/empty/error/offline/success/denied states.
- Use Playwright screenshots and browser console inspection where environment exists.
- Distinguish automated/source contracts from actual browser visual verification.

Acceptance: documented route/viewport/theme matrix, no unexplained P0/P1 UX or accessibility issues.

## Phase 10 — Regression, cleanup & release readiness
- Run all build/lint/test/PRD/Firestore rules gates.
- Review diff, dependency licenses/bundle, route ownership and CSS imports.
- Produce full inventory and handoff report with evidence.
- Open PR only after all agreed phase gates, never merge or deploy without explicit authorization.

## Quality gates after each phase
- npm run build
- npm run lint
- targeted scripts relevant to modified modules
- npm test and npm run test:prd at major/final gates
- responsive visual QA only when truly performed

## Approved UI library layers
1. UI Foundation: shadcn/ui + Base UI
2. Styling: Tailwind CSS v4
3. Animation: Motion
4. Visual Components: Magic UI
5. Icons: Lucide React
6. Notifications: Sonner
7. Table: TanStack Table
8. Charts: Apache ECharts
9. Forms: React Hook Form + Zod

Use each layer selectively according to component needs. The user explicitly authorizes assertive modernization across all pages: migrate legacy primitives toward shadcn/ui + Base UI and remove outdated packages when a full import/consumer inventory proves retirement safe. Do not preserve a legacy UI component only out of habit; keep business logic, role boundaries, accessibility, API/Worker contracts and regression behavior intact. Keep semantic CSS tokens as source of truth, avoid duplicate engines, honor reduced-motion, and consider bundle size/lazy loading.

## Progress tracking
Each phase must track scope, owning files, acceptance criteria, changes, tests, visual QA status, known issues, and handoff notes.
