# Phase 1 — Design System Foundation

## Status
COMPLETE. Source integration is committed to the dedicated redesign branch. GitHub Quality Gates run #199 on de77de7130a1d8eb1563610371ddff861046e7a5 passed build, lint, regression, PRD/Firestore security contracts, and responsive browser smoke.

## Approved library layers
| Layer | Implementation |
|---|---|
| UI foundation | shadcn configuration with Base UI primitives for new UI |
| Styling | Tailwind CSS v4 via the Vite plugin, with the current legacy config loaded explicitly |
| Animation | Existing Motion package and reduced-motion support |
| Visual components | Source-owned Magic UI NumberTicker pattern built with Motion |
| Icons | Existing Lucide React |
| Notifications | Sonner, mounted in the themed Admin shell |
| Tables | TanStack Table v9 adapter with semantic HTML rendering |
| Charts | Apache ECharts through echarts-for-react |
| Forms | React Hook Form + Zod resolver hook for schema-backed forms |

## Compatibility decisions
- Phase 1 initially retained existing Radix-based feature interactions to avoid a blind bulk migration. On 2026-11-06 the user explicitly authorized more assertive modernization across all pages: legacy primitives may be migrated to shadcn/ui + Base UI and obsolete packages may be removed when an import/consumer inventory proves retirement is safe. Preserve domain workflows, security boundaries, accessibility and regression contracts; do not keep legacy UI solely for compatibility by default.
- The old Dashboard Recharts chart has been migrated to ECharts. Recharts is removed from dependencies after its only identified consumer was migrated.
- Tailwind v4 is enabled with the Vite plugin. The old Tailwind JS configuration is explicitly loaded using @config so existing content/theme configuration remains available while the CSS runtime is upgraded.
- Lucide React and Motion are reused; no duplicate icon or animation engines are introduced.
- Forms are not bulk-rewritten in this foundation phase. New and migrated forms can use useStudioForm(schema) without bypassing their canonical repositories/Workers.
- Existing Light/Dark/System ThemeProvider, storage preference key/default and shared component markup are preserved.

## Foundation work
- Expanded semantic tokens for typography, line-height, tracking, spacing, control sizing, content widths, breakpoints, focus, motion, elevation, overlays and charts.
- Added Light-mode semantic overrides without duplicating component markup.
- Migrated shared Button, field, Select, Card, Badge and Pagination CSS to use tokenized sizing/typography/focus behavior.
- Added styles for Base UI menus, TanStack tables, ECharts, Sonner and NumberTicker.
- Confirmation dialog now uses semantic overlay, radius and motion tokens.
- Admin shell owns the Sonner toaster under its existing ThemeProvider.
- Added test coverage for library presence, wiring and design token consumption.
- Updated Procurement source contract to tolerate whitespace while still requiring the exact open-order status exclusion semantics.

## Files and areas
- package.json / package-lock.json
- vite.config.js, tailwind.config.js, src/index.css, components.json
- src/lib/utils.js, src/lib/notifications.js, src/hooks/useStudioForm.js
- src/components/ui/StudioMenu.jsx, StudioDataTable.jsx, StudioToaster.jsx, StudioChart.jsx, EChartsRenderer.jsx, Button.jsx
- src/components/magicui/number-ticker.jsx
- src/pages/AdminPage.jsx, src/pages/admin/DashboardPage.jsx
- src/styles/modules/shared.css, src/styles/modules/modal.css
- scripts/library-integration-contract-test.mjs, scripts/design-system-foundation-contract-test.mjs
- .github/workflows/quality-gates.yml

## Validation boundaries
- Lockfile refresh workflow completed successfully after package.json changes.
- GitHub Quality Gates run #199 completed successfully on the Phase 1 implementation baseline.
- CI evidence confirms build, lint, regression, PRD/Firestore security contracts, responsive browser smoke, and screenshot artifact upload. This does not imply every authenticated page was visually inspected.
- No Firebase project, Worker secrets, production data, billing or deployment settings have been changed.
