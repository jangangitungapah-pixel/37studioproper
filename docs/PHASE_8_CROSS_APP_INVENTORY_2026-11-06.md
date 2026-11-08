# Phase 8 — Cross-App Inventory & Completion Matrix

**Repository:** `jangangitungapah-pixel/37studioproper`  
**Work branch:** `feature/ui-overhaul-premium-enterprise-2026-11-06`  
**Inventory snapshot:** code tree at `c9381ddacb07c805bff3d0da4cb99bfa991bb059`  
**Prepared:** 2026-11-06

## Purpose and classification

This document is the traceable Phase 8 inventory. It records owner/consumer relationships, relevant evidence, known limitations, and next action. `tested` means source/contract or automated suite evidence exists; it is not a visual-inspection claim. `visually verified` is used only where prior screenshot evidence was actually captured and reviewed. `blocked` means the inventory item still needs a check that cannot be safely or honestly claimed with the current environment (principally authenticated visual QA). `redesigned` is reserved for a Phase 8 source change, not an earlier phase.

No Page/Component layout redesign was performed in Phase 8. The only code changes were lifecycle safety and CSS token-alias consolidation. There was no route, role, Firestore, Worker, booking, payment, inventory, or production-data mutation.

## Inventory summary

| Inventory family | Count | Phase 8 treatment |
| --- | --- | --- |
| Tracked page files | 22 | All 22 page files mapped; route matrix contains 24 route/alias entries. |
| React components | 56 | Every entry assigned a consumer/feature owner and evidence/action. |
| Stylesheets | 37 | Every entry mapped to owning route/feature/shared layer; no stylesheet deleted. |
| Hooks | 2 | Source/import owner mapped; no hook removed. |
| Services / repositories | 20 | Domain/consumer ownership mapped; protected contracts kept intact. |
| Test / audit / smoke scripts | 96 | Tracked by repository tree; key contracts listed below. Full CI test and PRD/security commands executed. |
| Tracked blobs at baseline | 403 | Git tree response was not truncated. |

The raw tree inventory additionally showed 2 hooks, 20 service/repository files and 37 stylesheet files including `src/index.css`. `scripts/` contains 96 files matching test/audit/smoke/contract naming.

## 1. Route and page inventory

| Route | Product area | Owner / page | Import / consumer relationship | Classification | Evidence and limitation | Phase 8 action |
| --- | --- | --- | --- | --- | --- | --- |
| / | Public | ClientLandingPage.jsx | src/App.jsx | tested | Client landing experience contract; Phase 3A browser smoke and screenshot review at 390/768/1440. | No new visual inspection in Phase 8. | Keep as-is; full visual sweep in Phase 9. |
| /launch | Public / PWA | PwaLaunchPage.jsx | src/App.jsx; routes/auth.css | blocked | Source-audited; auth route core and quality gates pass. | No route-specific screenshot evidence in the Phase 8 evidence set. | Defer viewport/theme visual review to Phase 9. |
| /login | Authentication | LoginPage.jsx | src/App.jsx; routes/auth.css; firebase-auth.css | tested | Phase 3 auth/public contract and browser screenshots reviewed at 390/768/1440. | Authenticated identity provider flows still need isolated staging. | Keep behavior; Phase 9 auth-state visual matrix. |
| /client/login | Authentication / Client | ClientLoginPage.jsx | src/App.jsx; ClientSpatialRoute; routes/auth.css; firebase-auth.css; client-auth.css | tested | Phase 3 auth/public contract and browser screenshots reviewed at 390/768/1440. | Live provider/authenticated account integration remains staging-dependent. | Keep behavior; Phase 9 state/theme review. |
| /client/portal | Client | ClientPortalPage.jsx | src/App.jsx; ClientSpatialRoute; routes/client.css; client-portal-overhaul.css | blocked | Phase 7 client portal contract; Phase 8 subscription lifecycle contract; npm test passed. | Authenticated visual walkthrough requires isolated Firebase Spark staging and synthetic client data. | Phase 9 authenticated route/viewport/theme review. |
| /client | Public | ClientLandingPage.jsx | src/App.jsx; routes/client.css; client-landing.css | tested | Same owner as `/`; Phase 3A landing contract and prior screenshot review. | Alias route; no separate Phase 8 screenshot. | Keep alias; verify redirect/alias behavior in Phase 9. |
| /guard | Guard redirect | Navigate to /guard/attendance | src/App.jsx | tested | Route source audit; global route/security contracts pass. | No separate visual surface. | Keep redirect behavior. |
| /guard/attendance | Guard | src/pages/guard/GuardAttendancePage.jsx | src/App.jsx; routes/guard.css; guard-portal.css | blocked | Guard isolation/access/reliability contracts in npm test and PRD security gates. | Authenticated Guard walkthrough is blocked by missing isolated staging/test identities. | Phase 9 role-matrix responsive visual review. |
| /admin/* | Admin shell | AdminPage.jsx | src/App.jsx; routes/admin.css; spatial-foundation.css; AdminSidebar/AdminTopbar/AdminBottomNav | blocked | Admin shell/navigation contracts; Phase 2 signed-out screenshot evidence on narrow/tablet widths. | Authenticated Admin workspace visual review not completed; safe staging absent. | Phase 9 authenticated Admin shell and all workspace walkthroughs. |
| /admin/dashboard | Admin | DashboardPage.jsx | AdminPage renderAdminContent; dashboard.css; StudioChart/EChartsRenderer | blocked | Dashboard spatial contract; library integration contract confirms ECharts and no Recharts; npm test passed. | Authenticated visual and data-state matrix remains unverified. | Phase 9 authenticated dashboard visual review. |
| /admin/requests | Admin | BookingRequestsPage.jsx | AdminPage renderAdminContent; booking-requests.css; bookingCommunicationRepository | blocked | Admin spatial request inbox and booking request contracts passed. | Authenticated workflow visual QA blocked by staging. | Phase 9 authenticated request/decision states. |
| /admin/bookings | Admin | AllBookingsPage.jsx | AdminPage renderAdminContent; all-bookings.css; useBookingListUrlState | blocked | All-bookings command center contract passed. | Authenticated filter/detail/empty/error visual states not inspected in Phase 8. | Phase 9 viewport and URL-state review. |
| /admin/schedule | Admin | SchedulePage.jsx | AdminPage renderAdminContent; schedule.css; BookingFormModal; booking.css | blocked | Booking calendar/form modal contracts passed, including UI-3C CSS token contract after Phase 8 fix. | Authenticated calendar and drawer screenshot review deferred. | Phase 9 calendar/modal responsive visual review. |
| /admin/customers | Admin | CustomerPage.jsx | AdminPage renderAdminContent; customer.css; StudioTextField/StudioSelect/PaginationControls | blocked | Customer workspace contract passed in npm test. | Authenticated customer table/detail visual QA deferred. | Phase 9 customer workflow visual review. |
| /admin/billing | Admin / Finance | BillingPage.jsx | AdminPage renderAdminContent; billing.css; PaymentProofCommandCenter; paymentProofRepository | blocked | Invoices/payments and proof command-center contracts passed. | Production-facing default Firebase/Worker; do not run mutating acceptance. | Phase 9 with staging only. |
| /admin/bookkeeping | Admin / Finance | BookkeepingPage.jsx | AdminPage renderAdminContent; bookkeeping.css; DailyClosingWorkspace; bookkeepingRepository | blocked | Bookkeeping ledger and daily-closing contracts passed. | Authenticated finance visual QA/staging unavailable. | Phase 9 isolated staging walkthrough. |
| /admin/operator-fee | Admin / Operations | OperatorFeePage.jsx | AdminPage renderAdminContent; operator-fee.css; GuardMealReconciliationPanel; operatorFeeRepository | blocked | Operator fee posting/reconciliation and eligibility contracts passed. | Authenticated role and ledger visual walkthrough deferred. | Phase 9 staging walkthrough. |
| /admin/guard-attendance | Admin / Guard oversight | src/pages/admin/GuardAttendancePage.jsx | AdminPage renderAdminContent; guard-attendance.css; guardAttendanceRepository | blocked | Guard owner-review, transition, and reconciliation contracts passed. | No authenticated Owner/Admin/Guard screenshot evidence. | Phase 9 role-matrix visual QA. |
| /admin/inventory | Admin / Operations | InventoryPage.jsx | AdminPage renderAdminContent; inventory.css; ProcurementWorkspace; InventoryMaintenanceWorkspace | blocked | Inventory/procurement/maintenance contracts passed. | Production-facing default Worker/Firebase; no mutating QA. | Phase 9 isolated synthetic staging. |
| /admin/gallery | Admin / Content | GalleryPage.jsx | AdminPage renderAdminContent; gallery.css; Gallery components; galleryRepository; Cloudinary service | blocked | Gallery workspace, media safety and interaction contracts passed. | Authenticated visual QA and real media mutation intentionally not performed. | Phase 9 isolated disposable staging asset only. |
| /admin/notifications | Admin / Notifications | NotificationsPage.jsx | AdminPage renderAdminContent; notifications.css; notificationEventRepository | blocked | Notification security and console contracts passed. | Authenticated event feed visual QA deferred. | Phase 9 authenticated notification states. |
| /admin/settings | Admin / Settings | SettingsPage.jsx | AdminPage renderAdminContent; settings.css; OperatorFeeSettingsPanel; settings hooks/utilities | blocked | Settings protected operations, permissions, persistence, and admin settings UI contracts passed. | Owner-only and Danger Zone states must not be tested against production. | Phase 9 isolated Owner/Admin staging review. |
| /admin/approve | Admin / Owner approval | AutoApprovePage.jsx | AdminPage URL-based Owner approval branch; Firestore user record; AccessState | blocked | Source-audited; account-role and owner authorization contracts pass. | Sensitive Owner approval workflow; existing effect set-state lint suppression intentionally left untouched. | Phase 9 visual only in isolated staging; auth refactor requires separate scope. |
| * | Fallback redirect | Navigate to /login | src/App.jsx | tested | Route source audit and smoke-test route contract. | No separate visual surface. | Keep redirect and sanitization behavior. |

## 2. Component inventory

| Component path | Area | Primary consumer / owner | Classification | Evidence and limitation | Phase 8 action |
| --- | --- | --- | --- | --- | --- |
| src/components/admin/AdminBottomNav.jsx | Admin shell | AdminPage.jsx | tested | Admin mobile shell/navigation contracts; Phase 2 shell work. | Authenticated shell screenshot deferred. | Phase 9 visual review. |
| src/components/admin/AdminNotificationBadge.jsx | Admin shell / notifications | AdminPage.jsx / notification summary | tested | Notification security/console and shell contracts. | Authenticated notification badge states uninspected. | Phase 9 visual review. |
| src/components/admin/AdminSidebar.jsx | Admin shell | AdminPage.jsx; adminNavigation.js | tested | Admin navigation and spatial navigation-rail contracts. | Authenticated role menu visuals deferred. | Phase 9 visual/keyboard matrix. |
| src/components/admin/AdminTopbar.jsx | Admin shell | AdminPage.jsx | tested | Admin command-header and shell hardening contracts. | Authenticated visual states deferred. | Phase 9 visual review. |
| src/components/ai/RoleAiAssistant.jsx | Shared / AI | Lazy loaded by AdminPage and ClientPortalPage; firebaseAiService | tested | Source-audited; role AI/service contracts and npm test. | Authenticated AI states not visually inspected. | Phase 9 verify role surfaces with synthetic context. |
| src/components/auth/AccountRoleDecisionDialog.jsx | Authentication / roles | ClientLoginPage/account role flow | tested | Account-role and auth contracts. | Live auth state requires staging. | Phase 9 visual review. |
| src/components/billing/PaymentProofCommandCenter.jsx | Admin / billing | BillingPage; paymentProofRepository | tested | Payment proof command-center/security contracts. | No live proof mutation. | Phase 9 synthetic staging visual QA. |
| src/components/booking/BookingConversationPanel.jsx | Shared / booking | ClientPortalPage and booking detail surfaces; bookingCommunicationRepository; booking.css | redesigned | Phase 8 lifecycle fix; new phase-8 contract; client Phase7 contract; CI npm test/lint. | No authenticated conversation screenshot in Phase 8. | Phase 9 visual and session-switch walkthrough. |
| src/components/booking/BookingDetailDrawer.jsx | Admin / booking | Admin booking surfaces; booking-detail-drawer.css | tested | Booking detail drawer contracts. | Authenticated detail drawer visual QA deferred. | Phase 9. |
| src/components/bookkeeping/DailyClosingWorkspace.jsx | Admin / bookkeeping | BookkeepingPage; bookkeeping.css / bookkeeping-daily-closing.css | tested | Daily closing and ledger contracts. | Authenticated visual review deferred. | Phase 9. |
| src/components/client/ClientAccountTab.jsx | Client | ClientPortalPage; client-portal-overhaul.css | tested | Phase7 client portal contract; npm test. | No authenticated portal screenshots in Phase 8. | Phase 9. |
| src/components/client/ClientBillingTab.jsx | Client / billing | ClientPortalPage; paymentProofRepository; client-portal-overhaul.css | tested | Phase7 billing/proof state contracts; npm test. | No real proof/payment mutation or authenticated screenshot. | Phase 9 staging. |
| src/components/client/ClientBookingWizard.jsx | Client / booking | ClientPortalPage; client-booking-wizard.css; pricing/schedule config | tested | Unified client booking wizard and booking handoff contracts. | Authenticated visual review deferred. | Phase 9. |
| src/components/client/ClientBookingsHub.jsx | Client / booking | ClientPortalPage; client-portal-overhaul.css | tested | Phase7 action count and unavailable-data contracts. | Authenticated visual review deferred. | Phase 9. |
| src/components/client/ClientCalendarTab.jsx | Client / calendar | ClientPortalPage; client-portal-overhaul.css | tested | Phase7 calendar availability gating contract. | No staging slot/action workflow screenshot. | Phase 9 staging. |
| src/components/client/ClientDashboardTab.jsx | Client / dashboard | ClientPortalPage; booking selectors | tested | Phase7 lifecycle and unavailable-data contracts. | Authenticated visual review deferred. | Phase 9. |
| src/components/client/ClientHistoryTab.jsx | Client / history | ClientPortalPage; booking selectors | tested | Phase7 canonical lifecycle/status/filter contracts. | Authenticated visual review deferred. | Phase 9. |
| src/components/client/ClientNotificationsPanel.jsx | Client / notifications | ClientPortalPage; notificationEventRepository | tested | Phase7 recipient-scoped immutable notification contract. | No authenticated feed screenshot. | Phase 9. |
| src/components/client/ClientSpatialRoute.jsx | Client shell / route guard | App.jsx client login and portal routes | tested | Phase2/3 portal and route contracts; Phase7 route boundary source audit. | Authenticated route state visuals deferred. | Phase 9. |
| src/components/gallery/AlbumFolderCard.jsx | Admin / gallery | GalleryAlbumsView; gallery.css | tested | Gallery workspace/source contracts. | No authenticated screenshot. | Phase 9. |
| src/components/gallery/EmptyGalleryState.jsx | Admin / gallery | GalleryPage/gallery views; gallery.css | tested | Gallery contract and npm test. | Visual state review deferred. | Phase 9. |
| src/components/gallery/GalleryAlbumsView.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery workspace contracts. | Authenticated view not visually inspected. | Phase 9. |
| src/components/gallery/GalleryAlerts.jsx | Admin / gallery | GalleryPage; gallery.css; subscription retry | redesigned | Phase6 retry/focus/reduced-motion change and content-notification-settings contract. | Authenticated screenshot not reviewed. | Phase 9. |
| src/components/gallery/GalleryBatchBanner.jsx | Admin / gallery | GalleryPage/gallery views; gallery.css | tested | Gallery workspace contract. | Visual review deferred. | Phase 9. |
| src/components/gallery/GalleryHero.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery workspace contract. | Visual review deferred. | Phase 9. |
| src/components/gallery/GalleryLightbox.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery media safety/source contracts. | No destructive media QA. | Phase 9 isolated staging. |
| src/components/gallery/GalleryMetadataModal.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery metadata/source contracts. | Visual review deferred. | Phase 9. |
| src/components/gallery/GalleryTimelineView.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery workspace contract. | Visual review deferred. | Phase 9. |
| src/components/gallery/GalleryToolbar.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery workspace contract. | Visual review deferred. | Phase 9. |
| src/components/gallery/GalleryTrashView.jsx | Admin / gallery | GalleryPage; gallery.css | tested | Gallery soft-delete/restore and permanent-delete guard contracts. | No permanent-delete operation. | Phase 9 isolated visual states. |
| src/components/gallery/GalleryUploadModal.jsx | Admin / gallery | GalleryPage; gallery.css; cloudinaryUploadService | tested | Gallery upload limit/payload safety contracts. | No upload against production media. | Phase 9 disposable staging asset. |
| src/components/gallery/PhotoCard.jsx | Admin / gallery | GalleryAlbumsView/GalleryTimelineView; gallery.css | tested | Gallery workspace and media safety contracts. | Visual review deferred. | Phase 9. |
| src/components/guard/GuardAttendanceApprovalModal.jsx | Admin / guard | AdminPage; guard-attendance.css | tested | Guard owner review/transition contracts. | Authenticated Owner review visuals deferred. | Phase 9. |
| src/components/inventory/InventoryMaintenanceWorkspace.jsx | Admin / inventory | InventoryPage; inventory.css | tested | Maintenance work-order contracts. | No live stock/maintenance mutation. | Phase 9 synthetic staging. |
| src/components/inventory/ProcurementWorkspace.jsx | Admin / procurement | InventoryPage; procurement workflow/worker contracts | tested | Procurement worker/workflow regression passed. | No live procurement mutation. | Phase 9 synthetic staging. |
| src/components/magicui/number-ticker.jsx | Shared / visual | DashboardPage and client landing; Motion | tested | Library integration and design-system contracts; reduced-motion implementation source-audited. | No new Phase 8 screenshot. | Keep existing Motion-only animation engine. |
| src/components/operator-fee/GuardMealReconciliationPanel.jsx | Admin / operator fee | OperatorFeePage/operator-fee styles; guard attendance/bookkeeping sources | tested | Guard meal reconciliation and operator fee posting contracts. | No live posting. | Phase 9 synthetic staging. |
| src/components/schedule/BookingFormModal.jsx | Admin / schedule | SchedulePage; booking.css; Radix Dialog | tested | Booking form/modal source contract and calendar-save regression; CSS token contract passed after Phase8 migration. | Authenticated screenshot deferred. | Phase 9. |
| src/components/settings/OperatorFeeSettingsPanel.jsx | Admin / settings | SettingsPage; settings.css/operator-fee.css | tested | Settings/protected operations and operator-fee config contracts. | Owner-only state visuals deferred. | Phase 9. |
| src/components/ui/AccessState.jsx | Shared UI primitive | Auth/portal gates and error states | tested | Smoke/auth/access-state contracts. | No full state matrix visual inspection. | Phase 9. |
| src/components/ui/Button.jsx | Shared UI primitive | Shared CSS; class-variance-authority; lucide-react | tested | Library integration and shared UI contracts. | Visual variants remain Phase9 audit scope. | Keep shared token ownership. |
| src/components/ui/Card.jsx | Shared UI primitive | Shared component consumers | tested | Source-audited; library/foundation contracts run. | No dedicated visual screenshot. | Phase 9. |
| src/components/ui/ConfirmDialog.jsx | Shared UI primitive | Settings/operation confirmations; Radix Dialog | tested | Shared UI accessibility contract covers focus restoration, loading, alert, backdrop safety. | No visual matrix screenshot. | Phase 9. |
| src/components/ui/EChartsRenderer.jsx | Shared / charts | StudioChart; echarts-for-react and echarts/core | tested | Library integration contract and production build. | Bundle chunk warning remains. | Phase 10 bundle review; do not add chart engine. |
| src/components/ui/ErrorBoundary.jsx | Shared UI primitive | App.jsx | tested | Smoke test source and build. | Error-boundary fallback not visually inspected. | Phase 9 error state. |
| src/components/ui/FeedbackAlert.jsx | Shared UI primitive | Page/service operation feedback | tested | Shared accessibility/foundation source contracts. | Visual variants deferred. | Phase 9. |
| src/components/ui/PaginationControls.jsx | Shared UI primitive | Customer/Billing/Bookkeeping/Inventory page families | tested | Page contract coverage and build/lint. | Visual matrix deferred. | Phase 9. |
| src/components/ui/SpatialUiProvider.jsx | Shared shell provider | AdminPage; spatial-foundation.css | tested | Spatial UI foundation and admin shell contracts. | Authenticated theme/overlay visuals deferred. | Phase 9. |
| src/components/ui/StatusPill.jsx | Shared UI primitive | Admin/client status views | tested | Booking lifecycle/status contracts. | Cross-domain theme visual matrix deferred. | Phase 9. |
| src/components/ui/StudioChart.jsx | Shared / charts | DashboardPage; EChartsRenderer | tested | Library integration ensures ECharts and no Recharts. | Authenticated chart visual states deferred. | Phase 9. |
| src/components/ui/StudioDataTable.jsx | Shared / tables | Data-table consumers; TanStack Table v9 | tested | Library integration contract confirms TanStack Table. | Actual per-page table visual QA deferred. | Phase 9. |
| src/components/ui/StudioMenu.jsx | Shared / menu | Consumers; @base-ui/react/menu | tested | Library integration contract confirms Base UI Menu. | Keyboard/overlay screenshot review deferred. | Phase 9. |
| src/components/ui/StudioSelect.jsx | Shared / fields | Page forms; Radix-based source in current implementation | tested | Shared UI accessibility contract: keyboard arrows/Home/End/Enter/Escape/Tab, combobox/listbox/option ARIA/typeahead. | Visual/forced-colors screenshots deferred. | Phase 9. |
| src/components/ui/StudioTextField.jsx | Shared / fields | Page forms | tested | Shared UI accessibility contract: generated id, aria-describedby/error message/invalid. | Visual review deferred. | Phase 9. |
| src/components/ui/StudioToaster.jsx | Shared / notifications | AdminPage; sonner; ThemeProvider | tested | Library integration contract confirms Sonner. | Toast visual/theming screenshot deferred. | Phase 9. |
| src/components/ui/StudioTooltip.jsx | Shared / tooltip | Consumers; radix-ui tooltip | tested | Library integration/shared primitive source; build. | Visual and keyboard/forced-colors review deferred. | Keep Radix while consumer contract remains. |

## 3. Stylesheet inventory

| Stylesheet | Ownership area | Entrypoint / consumers | Classification | Evidence and limitation | Phase 8 action |
| --- | --- | --- | --- | --- | --- |
| src/index.css | Global foundation | src/main.jsx | tested | Design-system foundation contract; npm run build. | Theme token/contrast visual matrix deferred. | Phase 9 theme/contrast review. |
| src/styles/ai-assistant.css | AI assistant feature | RoleAiAssistant.jsx (lazy import) | tested | Source audit and production build. | No authenticated screenshot. | Phase 9. |
| src/styles/client-auth.css | Client login | ClientLoginPage.jsx | tested | Route/auth contract and prior screenshot review. | Live auth states staging-dependent. | Phase 9. |
| src/styles/client-landing.css | Public landing | ClientLandingPage.jsx | visually verified | Phase 3A landing smoke and previous screenshot inspection. | No Phase8 screenshot; no layout modifications in Phase8. | Phase 9 regression matrix. |
| src/styles/firebase-auth.css | Shared Firebase auth UI | LoginPage.jsx, ClientLoginPage.jsx | tested | Phase 3 auth source/browser contracts. | Provider authenticated states require staging. | Phase 9. |
| src/styles/modules/admin-shell.css | Admin shell | routes/admin.css | tested | CSS route ownership and Admin shell contracts. | Authenticated theme screenshots deferred. | Phase 9. |
| src/styles/modules/all-bookings.css | Admin all bookings | AllBookingsPage.jsx lazy feature owner | tested | All-bookings command-center contract. | No authenticated visual screenshot. | Phase 9. |
| src/styles/modules/auth.css | Auth route core | routes/auth.css; routes/admin.css; routes/guard.css | tested | CSS route ownership contract and auth tests. | Visual states partially verified in prior phases. | Phase 9. |
| src/styles/modules/base.css | Semantic token bridge | All route cores | tested | Design-system and route ownership contracts. | Theme contrast review deferred. | Phase 9. |
| src/styles/modules/billing.css | Admin billing | BillingPage.jsx | tested | CSS route ownership and payment/finance contracts. | Authenticated finance screenshot blocked by staging. | Phase 9. |
| src/styles/modules/booking-detail-drawer.css | Admin booking detail | BookingDetailDrawer.jsx | tested | CSS route ownership and booking detail contracts. | Authenticated drawer screenshots deferred. | Phase 9. |
| src/styles/modules/booking-requests.css | Admin requests | BookingRequestsPage.jsx | tested | Admin request inbox contracts. | Authenticated visual states deferred. | Phase 9. |
| src/styles/modules/booking.css | Booking forms/conversation | BookingFormModal.jsx; BookingConversationPanel.jsx | redesigned | Phase8 exact alias migration: 150 `--auth-*` refs mapped to 20 canonical `--studio-*` tokens; modal contract passed; raw hex count 0. | No visual screenshot after token alias rename; values map one-to-one to existing tokens. | Phase 9 visual regression and reduced-motion review. |
| src/styles/modules/bookkeeping-daily-closing.css | Admin bookkeeping subworkspace | DailyClosingWorkspace / BookkeepingPage | tested | Daily closing contracts and npm test. | No authenticated screenshot. | Phase 9. |
| src/styles/modules/bookkeeping.css | Admin bookkeeping | BookkeepingPage.jsx | tested | Bookkeeping ledger contracts. | Authenticated screenshot blocked. | Phase 9. |
| src/styles/modules/client-booking-wizard.css | Client booking wizard | ClientBookingWizard.jsx | tested | Unified booking wizard contract and build. | Authenticated wizard visual review deferred. | Phase 9. |
| src/styles/modules/client-navigation-v2.css | Client shell/navigation | Client portal client navigation source | tested | Client navigation v2 and client Phase7 contracts. | No authenticated responsive screenshot. | Phase 9. |
| src/styles/modules/client-portal-overhaul.css | Client portal | ClientPortalPage.jsx and Client tab components | tested | Client Phase7 interaction/state contracts and Phase8 lifecycle test. | Authenticated visual QA blocked by staging. | Phase 9. |
| src/styles/modules/customer.css | Admin customers | CustomerPage.jsx | tested | Customer workspace contracts. | No authenticated visual screenshot. | Phase 9. |
| src/styles/modules/dashboard.css | Admin dashboard | DashboardPage.jsx | tested | Admin dashboard and library integration contracts. | No authenticated visual screenshot. | Phase 9. |
| src/styles/modules/gallery.css | Admin Gallery | GalleryPage.jsx and Gallery components | tested | Gallery workspace/media safety contracts. | No authenticated Gallery screenshots. | Phase 9 staging. |
| src/styles/modules/guard-attendance.css | Admin/Guard attendance | Admin GuardAttendancePage and GuardAttendanceApprovalModal | tested | Guard attendance isolation/reliability/owner review contracts. | Authenticated role visual matrix blocked. | Phase 9. |
| src/styles/modules/guard-portal.css | Standalone Guard portal | routes/guard.css | tested | Guard flow/role/identity contracts. | No authenticated screenshots. | Phase 9. |
| src/styles/modules/inventory.css | Admin inventory/procurement | InventoryPage.jsx; ProcurementWorkspace; InventoryMaintenanceWorkspace | tested | Inventory/procurement/maintenance contracts. | No mutating production QA or authenticated visuals. | Phase 9 synthetic staging. |
| src/styles/modules/modal.css | Shared dialogs/modals | All route cores | tested | Shared UI accessibility + design-system + route ownership contracts. | Dialog stacking/keyboard/theme visual matrix deferred. | Phase 9. |
| src/styles/modules/notifications.css | Admin notifications | NotificationsPage.jsx | tested | Notification console/security contracts. | Authenticated notification screenshot deferred. | Phase 9. |
| src/styles/modules/operator-fee.css | Admin operator fee | OperatorFeePage.jsx; OperatorFeeSettingsPanel; GuardMealReconciliationPanel | tested | Operator fee reconciliation/eligibility/posting contracts. | No live ledger mutation. | Phase 9 synthetic staging. |
| src/styles/modules/schedule.css | Admin schedule/calendar | SchedulePage.jsx | tested | Calendar save, schedule/calendar/form modal contracts. | Authenticated calendar screenshot deferred. | Phase 9. |
| src/styles/modules/settings.css | Admin settings | SettingsPage.jsx and settings components | tested | Settings protected operations/persistence/owner contracts. | Danger Zone and Owner-only visual QA deferred. | Phase 9 isolated staging. |
| src/styles/modules/shared.css | Shared primitives | routes/admin.css, routes/auth.css, routes/client.css | tested | Shared UI accessibility, library integration, route ownership. | Full shared variant visual matrix deferred. | Phase 9. |
| src/styles/public-booking.css | Public booking | PublicBookingPage.jsx | visually verified | Phase 3 public booking smoke screenshot review and public booking contract. | No Phase8 visual inspection. | Phase 9 visual regression. |
| src/styles/routes/admin.css | Admin route core | AdminPage.jsx | tested | CSS route ownership; Admin shell contracts. | Authenticated visual walkthrough blocked. | Phase 9. |
| src/styles/routes/auth.css | Auth route core | LoginPage, ClientLoginPage, PwaLaunchPage | tested | CSS route ownership and auth route contracts. | PWA route visual evidence absent. | Phase 9. |
| src/styles/routes/client.css | Client route core | ClientLandingPage, ClientPortalPage | tested | CSS route ownership and client route contracts. | Client portal authenticated screenshots unavailable. | Phase 9. |
| src/styles/routes/guard.css | Guard route core | GuardAttendancePage.jsx | tested | CSS route ownership and Guard role/portal contracts. | Authenticated Guard screenshots unavailable. | Phase 9. |
| src/styles/routes/public.css | Public booking route core | PublicBookingPage.jsx | tested | CSS route ownership and public booking browser smoke. | No Phase8 screenshot. | Phase 9. |
| src/styles/spatial-foundation.css | Spatial design tokens/primitives | AdminPage.jsx; Client routes via client.css | tested | Spatial foundation/design-system contracts and build. | Light/dark/system visual audit not done in Phase8. | Phase 9 theme review. |

## 4. Hook inventory

| Hook path | Area | Consumer relationship | Classification | Evidence | Phase 8 action |
| --- | --- | --- | --- | --- | --- |
| src/hooks/useBookingListUrlState.js | Admin booking list | AllBookingsPage / booking selectors | tested | URL state and all-bookings contracts; npm test. | No separate runtime visual test. | Phase 9 navigation/back-forward review. |
| src/hooks/useStudioForm.js | Shared form helper | Form consumers; React Hook Form + Zod resolver | tested | Library integration contract confirms RHF/Zod. | Individual form visual validation deferred. | Phase 9. |

## 5. Service and repository inventory

| Service path | Domain area | Primary consumers | Classification | Evidence and limitation | Phase 8 action |
| --- | --- | --- | --- | --- | --- |
| src/services/accountRoleRepository.js | Auth / role access | LoginPage, ClientLoginPage, ClientPortalPage, AdminPage | tested | Canonical owner/auth, account role, portal isolation, auth security contracts. | Live Firebase role matrix blocked by missing staging. | Phase 9 synthetic accounts. |
| src/services/adminAuthRepository.js | Admin auth | LoginPage, AdminPage | tested | Admin auth/login/shell hardening contracts. | Authenticated owner/admin visual QA deferred. | Phase 9. |
| src/services/adminBookingRepository.js | Booking data service | Admin/Client booking, calendar, dashboard | tested | Booking lifecycle, calendar save, handoff, client portal contracts. | Concurrent reservation limit documented; no transactional client lock is implied. | Phase 9 safe staging; do not mutate prod. |
| src/services/adminCustomerRepository.js | Customer data | CustomerPage, SchedulePage, DashboardPage | tested | Customer/workflow contracts and npm test. | No live customer data mutation. | Phase 9 synthetic staging. |
| src/services/adminOperationsRepository.js | Protected Worker operations | Admin finance/inventory/procurement/settings actions | tested | Worker/security/idempotency/domain contracts. | Worker defaults production-facing. | Phase 9 dedicated staging Worker only. |
| src/services/bookingCommunicationRepository.js | Booking messages/decisions | BookingConversationPanel, ClientPortalPage, booking workflows | tested | Booking communication lifecycle, decision and Phase8 subscription tests. | No live message or booking mutation. | Phase 9 staging. |
| src/services/bookkeepingRepository.js | Finance ledger | BookkeepingPage, DailyClosingWorkspace, OperatorFeePage | tested | Finance, ledger idempotency, daily closing contracts. | No production ledger mutation. | Phase 9. |
| src/services/clientProfileRepository.js | Client profile | ClientPortalPage | tested | Client portal source and account isolation contracts. | Authenticated data sync only staged on synthetic accounts. | Phase 9. |
| src/services/cloudinaryUploadService.js | Media upload | GalleryPage, ClientPortalPage | tested | Gallery media limit/payload contracts. | No production upload/delete QA. | Phase 9 disposable staging prefix. |
| src/services/emailService.js | Email integration | Account/notification flows | tested | Source audit/build; PRD and account request contracts where invoked. | No staging email provider integration acceptance. | Phase 9/10 integration review. |
| src/services/firebaseAiService.js | AI service | RoleAiAssistant | tested | Role AI contracts and build. | No live provider/secret mutation. | Phase 9 staging-only. |
| src/services/galleryRepository.js | Gallery metadata | GalleryPage/components; Firestore | tested | Gallery security/media lifecycle contracts. | No production metadata mutation. | Phase 9 isolated staging. |
| src/services/guardAttendanceRepository.js | Guard attendance | Guard pages, Admin review, Operator fee | tested | Guard UID isolation, transition, reliability and reconciliation contracts. | No live attendance operation. | Phase 9 synthetic Guard/Owner accounts. |
| src/services/inventoryRepository.js | Inventory data | InventoryPage and procurement/maintenance workspaces | tested | Inventory movement/procurement contracts. | No production inventory mutation. | Phase 9 staging. |
| src/services/maintenanceRepository.js | Maintenance data | InventoryMaintenanceWorkspace | tested | Maintenance work-order contracts. | No live work-order mutation. | Phase 9 staging. |
| src/services/notificationEventRepository.js | Notification events | Admin/Client notification surfaces and booking messages | tested | Notification security/immutable event contracts; recipient-scoped Client feed contract. | No event schema or read/unread changes. | Keep immutable contract. |
| src/services/operatorFeeRepository.js | Operator fee | OperatorFeePage and fee reconciliation panel | tested | Fee eligibility, posting, mapping and reconciliation contracts. | No production posting. | Phase 9 staging. |
| src/services/ownerAccountProvisioningRepository.js | Owner account provisioning | Admin account/settings flows | tested | Owner provisioning, auth ownership/security contracts. | No account provisioning against production. | Phase 9 synthetic staging. |
| src/services/paymentProofRepository.js | Payment proof | BillingPage, ClientBillingTab, ClientPortalPage | tested | Proof upload/review/payment contracts. | No production proof upload/review. | Phase 9 isolated staging only. |
| src/services/roleAiContextService.js | AI context by role | AdminPage and RoleAiAssistant | tested | Role context/security contracts and build. | No live AI integration visual QA. | Phase 9. |

## 6. Test inventory and key evidence

The branch tree contains 96 `scripts/` files matching test, smoke, audit, or contract naming. The current `npm test` chain includes the new `phase-8-cross-app-completion-contract-test.mjs`. The following contracts are especially relevant to this phase:

| Contract / command | Coverage | Phase 8 evidence |
| --- | --- | --- |
| `scripts/phase-8-cross-app-completion-contract-test.mjs` | Client booking subscription state is keyed by authenticated user + booking + role + retry; auth switch clears prior data; retries reset their own data/error/loading state; effects do not synchronously clear data; URL notification booking resolution is deferred and cancellable. | Added in Phase 8 and passed in `npm test`. |
| `scripts/client-portal-phase-7-contract-test.mjs` | Client portal isolation, notification recipient UID filter, lifecycle selectors, unavailable data states, proof/calendar gates, conversation keyboard/retry. | Passed as part of `npm test`. |
| `scripts/css-route-ownership-contract-test.mjs` | Route core import ownership; forbids eager loading admin feature CSS on route cores; checks owner imports for major pages/components. | Passed in `npm run test:prd`. |
| `scripts/admin-spatial-booking-form-modal-contract-test.mjs` | UI-3C modal responsive layout, safe-area, spatial token use, raw color prohibition, accessibility/reduced-motion markers. | Initially exposed legacy aliases; passed after the Phase 8 CSS alias migration. |
| `scripts/shared-ui-accessibility-contract-test.mjs` | StudioSelect keyboard/ARIA, StudioTextField labels/error associations, ConfirmDialog focus and state. | Passed in `npm run test:prd`. |
| `scripts/library-integration-contract-test.mjs` | Base UI menu, TanStack Table, React Hook Form/Zod, Sonner, Motion, CVA, ECharts; no Recharts consumer in Dashboard. | Passed in `npm test`. |
| `scripts/design-system-foundation-contract-test.mjs` | Semantic spacing/type/control/focus/motion/elevation/overlay/chart tokens and shared CSS consumers. | Passed in `npm test`. |
| `scripts/browser-responsive-smoke.mjs` | Available public/auth/signed-out responsive browser routes, dimensions, and screenshots. | The latest run is recorded in the workplan; it does not authenticate into Admin/Client/Guard workspaces. |
| `npm run build` | Production Vite/Rolldown build. | Passed in latest run `42174286586` on code commit `c9381dd`. |
| `npm run lint` | ESLint all files. | Passed in latest run `42174286586` on code commit `c9381dd`. |
| `npm test` | Regression and source/behavior contracts. | Passed in latest run `42174286586` on code commit `c9381dd`. |
| `npm run test:prd` | PRD, Worker authorization, CSS route ownership, and Firestore rules emulator contracts. | Passed in latest run `42174286586` on code commit `c9381dd`. |

## 7. Phase 8 changes and evidence

### Code changes

| Commit | Files | Change | Boundary |
| --- | --- | --- | --- |
| `73299c4b2a62c5408111911e423c911a75fe443d` | `BookingConversationPanel.jsx`, `ClientPortalPage.jsx`, `package.json`, `scripts/phase-8-cross-app-completion-contract-test.mjs` | Introduced keyed conversation state to prevent stale user/booking messages, moved retry reset responsibilities into explicit retry handlers, deferred notification booking route-state transition, and registered a regression contract. | No booking/message schema or repository write behavior changed. |
| `a49f93f17d2fb3561a7905284e6b29225abcc591` | `ClientPortalPage.jsx`, `scripts/phase-8-cross-app-completion-contract-test.mjs` | Deferred synchronous state updates from subscription setup catch blocks and removed unnecessary regex escape characters. | Auth identity switch still clears previous-client data; async state updates are guarded by the subscription active flag. |
| `c9381ddacb07c805bff3d0da4cb99bfa991bb059` | `src/styles/modules/booking.css` | Replaced 150 legacy `--auth-*` alias references with their exact mapped `--studio-*` semantic token names across 20 token pairs. | No token values, CSS declarations, dimensions, layout, or raw hex colors changed; mapping was verified against `base.css`. |

### Quality gate separation

- Final independently observed workflow: [Quality Gates run 42175183336](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42175183336), triggered by push to the work branch and checking branch HEAD `4aeef9c5e765526045c3c1aa9e473c3ac2f5494b`.
- Final run conclusion: **success**. Locked dependency install, Firebase CLI setup, production build, lint, full regression contracts, PRD/Firestore security contracts, Playwright install, Chromium install, responsive browser smoke, and screenshot artifact upload all completed successfully.
- Screenshot artifact: `browser-responsive-smoke`, artifact ID `13483012642`, approximately 8.6 MB, uploaded successfully by run 42175183336. It is retained in GitHub Actions artifacts; no local visual inspection of the uploaded images is claimed.
- Prior phase visual screenshot evidence exists for selected public/auth/signed-out surfaces as described in `docs/REDESIGN_WORKPLAN.md`; Phase 8 did not add a new screenshot set or claim new visual inspections.
- User-reported local Phase 7 responsive smoke result remains user-reported evidence and is not substituted for Phase 8 CI.

## 8. Safe cleanup decision register

| Candidate | Observed evidence | Decision | Reason / next action |
| --- | --- | --- | --- |
| `src/styles/modules/booking.css` legacy `--auth-*` aliases | `base.css` maps 20 aliases one-to-one to `--studio-*`; 150 refs; no raw hex; modal contract required semantic tokens. | Completed | Migrated to canonical tokens; contract passed. |
| Legacy / possible dead CSS classes from `docs/ui-precision-damage-audit.md` | Audit generated 2026-06-23 on `main` at an old commit, with old tracked/untracked git state and regex limitations. | Keep / defer | Not a valid consumer proof for current branch. Re-run current import/dynamic consumer inventory before deletion. |
| `src/styles/modules/client-navigation-v2.css`, `bookkeeping-daily-closing.css`, `client-booking-wizard.css`, `ai-assistant.css` | Feature-specific modules remain in current tree and feature components are lazy or conditionally mounted. | Keep | Do not infer dead CSS from naming or stale CSS map. |
| Legacy Radix dependency/primitives | `StudioTooltip.jsx` imports `radix-ui`; BookingFormModal uses Radix Dialog; Base UI Menu already used by StudioMenu. | Keep | No full consumer retirement proof; selective coexistence is intentional. |
| Recharts | Older code map mentions Recharts, but actual Dashboard imports StudioChart/ECharts; integration contract asserts no Recharts import. | No dependency removal in Phase 8 | Package dependency inventory should be rerun before any package deletion; no evidence here authorizes a removal. |
| `src/App.jsx` inline Suspense fallback style | Current source has one inline style object. | Defer | A small issue, but changing root loading layout is unnecessary to cross-app completion and needs responsive visual evidence. |
| `src/pages/admin/AutoApprovePage.jsx` effect state updates | Source contains a targeted ESLint suppression and an Owner-only account approval Firestore update flow. | Keep / defer | Sensitive approval behavior; no broad lifecycle rewrite without an isolated auth/security contract and staging test. |

## 9. Explicitly preserved contracts

- Firebase Auth role/account resolution, Owner bootstrap, approval states, and role boundaries.
- Firestore rules, collection/schema/index contracts, immutability rules, notification event recipients, and client ownership isolation.
- Worker authorization/API and idempotency contracts.
- Booking lifecycle, availability mirror, invoice/payment lifecycle, payment proof review, bookkeeping, inventory/procurement, guard attendance, Gallery metadata and Cloudinary payload/deletion rules.
- Routes, redirects, permission filtering, safe booking handoff, and Light/Dark/System preference behavior.
- No production writes, proof uploads, payments, booking mutations, inventory mutations, attendance writes, media uploads/deletions, merges or deployments.

## 10. Known issues and Phase 9 blockers

1. Authenticated Admin, Client, and Guard visual QA remains unverified because no isolated Firebase Spark project, staging Worker/Hosting origin, and synthetic test identities/data are available. Current default Firebase/Worker targets are production-facing; see `docs/audits/STAGING-ACCEPTANCE-READINESS-2026-10-29.md`.
2. Responsive screenshot visual inspection for the full route × viewport × theme matrix was not performed in Phase 8. Keep `visually verified` scoped only to the previously inspected screenshot cases identified in the workplan.
3. `src/pages/admin/AutoApprovePage.jsx` retains an existing targeted effect lint suppression; it is an Owner approval flow and should not be modified casually.
4. `src/App.jsx` retains one inline Suspense fallback style; small cleanup opportunity for later safe owner-style migration.
5. Previous Quality Gates build output reports chunk-size warnings for large `EChartsRenderer` and `exceljs` bundles; not a build failure and not addressed by Phase 8.
6. The `npm ci` output from the workflow reported 17 dependency audit findings (2 low, 7 moderate, 8 high). No `npm audit fix` was run and no dependency was removed or upgraded in Phase 8.
7. Legacy `docs/ui-rewrite-code-map.md` and June precision audit contain outdated consumer/dependency notes (e.g. Dashboard/Recharts and notification service map); actual source and package contracts were used as authority. Update those historical docs only with a separately scoped doc reconciliation.
8. Client slot revalidation is still a snapshot-level client check, not a transactional reservation lock; concurrent booking race is not claimed solved.

## 11. Phase 8 completion statement

Phase 8 is **COMPLETE**. The cross-app source inventory is classified across all tracked page files, components, stylesheets, hooks, and services in snapshot `c9381dd`; lifecycle and CSS token-alignment fixes are implemented; build, lint, full regression, PRD/Firestore security, and responsive browser smoke gates all passed in final Quality Gates run `42175183336` on branch HEAD `4aeef9c5e765526045c3c1aa9e473c3ac2f5494b`. Screenshot artifact `browser-responsive-smoke` (ID `13483012642`) uploaded successfully. This acceptance closes source inventory and automated responsive smoke only. Full route × viewport × theme visual inspection and authenticated Admin/Client/Guard walkthroughs remain Phase 9 work, blocked on safe isolated staging.