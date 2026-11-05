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
Status: AUDIT CAPTURED; BASELINE REGRESSION BLOCKER OPEN.
- Confirm branch, HEAD, repository tree, route/page/component/style/test inventory.
- Read PRD, route map, code map, CSS map, audits, staging readiness.
- Record package and theme architecture.
- Resolve regression source-contract mismatch; then run build, lint, npm test, npm run test:prd.
- Visual browser baseline only where CI/tooling and safe test state permit.

Acceptance: no undocumented P0/P1 blocker; current baseline commands recorded; inventory source-grounded.

## Phase 1 — Design system foundation
Status: IMPLEMENTED IN SOURCE; GITHUB QUALITY GATES PENDING.
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
- Admin desktop shell, sidebar rail, header, workspace layout, mobile nav dock/More sheet.
- Client shell and navigation.
- Guard attendance shell.
- Public shell.
- Theme controls, account menus, breadcrumbs, overlay layer and responsive page header/action patterns.
- Preserve canonical and legacy routes, URL parameters, permissions, and portal isolation.

Acceptance: shell contracts and direct-route access checks pass; screenshots at 390/768/1440 widths where safe.

## Phase 3 — Authentication & public experience
- Admin/Guard login and state UX.
- Client login.
- Pending, denied, invalid account, session, offline, and error states.
- Landing page and public booking flow.
- Preserve booking canonical availability and validation contracts.

Acceptance: auth and public booking contracts pass; no protected-content flash; responsive smoke passes.

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

## Dependency policy
Reuse existing React, Motion, Radix, Lucide, Recharts and Tailwind v3 stack. Add new libraries only when a measured need and compatibility review justify them. No broad stack upgrades.

## Progress tracking
Each phase must track scope, owning files, acceptance criteria, changes, tests, visual QA status, known issues, and handoff notes.
