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

## Phase 4 — Admin core operations
- Dashboard, Booking Requests, Calendar, All Bookings, Customers.
- Shared booking detail drawer, booking form/modal, filters and data-grid families.
- Preserve booking occupancy/date coordination and customer follow-up behavior.

Acceptance: booking lifecycle, calendar sync, route/query filters, customer contracts pass.

## Phase 5 — Admin finance & operations
- Invoices & Payments, payment proof review, Bookkeeping, Operator Fee, Inventory/Procurement/Maintenance, Guard Attendance.
- Shared finance and operations patterns.
- Preserve Worker authorization, idempotency, ledger integrity, refund/void, inventory movements, receipt/payment and attendance audit trail.

Acceptance: all finance/procurement/guard contracts pass; use emulators/synthetic fixtures only.

## Phase 6 — Content, notifications & settings
- Gallery, notification center, all settings subpages and Owner-only workflows.
- Shared upload, confirmation, destructive-action, and settings form patterns.
- Keep media deletion and dangerous actions protected.

Acceptance: gallery/security/notification/settings contracts pass.

## Phase 7 — Client Portal
- Overview, bookings, details/conversation, payments/proof, account and notifications.
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

Use each layer selectively according to component needs. Preserve compatibility with existing Radix consumers; do not perform mass migrations. Keep semantic CSS tokens as the styling source of truth. Reuse installed dependencies and project adapters; do not duplicate or remove libraries without verified consumer inventory. Use reduced-motion support and consider bundle size/lazy loading for visual and chart layers.

## Progress tracking
Each phase must track scope, owning files, acceptance criteria, changes, tests, visual QA status, known issues, and handoff notes.
