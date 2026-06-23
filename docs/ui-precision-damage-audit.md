# UI Precision Damage Audit - 37 Studio Proper

Generated at: 2026-06-23T19:17:21.568Z

## Purpose

Audit ini adalah precision pass setelah audit damage pertama terlalu banyak false positive.

Yang dihitung sebagai class hanya:

1. className eksplisit di JSX.
2. project class dengan prefix domain seperti admin-, booking-, guard-shift-, client-, studio-, dan is-*.
3. bukan teks biasa.
4. bukan utility Tailwind umum.

## Git State

- Branch: `main`
- Last commit: `7278db1 Add comprehensive UI audit prompt for Midnight Linear + Bento Box overhaul`

```txt
M .firebase/hosting.ZGlzdA.cache
?? docs/ui-overhaul-damage-audit.json
?? docs/ui-overhaul-damage-audit.md
?? scripts/audit-ui-overhaul-damage.cjs
?? scripts/precision-ui-damage-audit.cjs
```

## Executive Summary

- JS/React files scanned: 101
- CSS files scanned: 28
- Project JSX classes detected: 690
- Project CSS classes detected: 779
- Missing project classes in CSS: 64
- Potential dead project CSS classes: 123
- CSS modules not imported: 0
- guard-shift classes used: 19
- guard-shift missing CSS: 0
- Findings P0: 0
- Findings P1: 28
- Findings P2: 56
- Findings INFO: 2

## Damage Triage

Guard portal tidak lagi terdeteksi missing CSS untuk class guard-shift-*. Lanjutkan screenshot check sebelum patch visual.

## Findings

| Severity | Area | File | Problem | Evidence | Action | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Component Size | src/pages/admin/BillingPage.jsx | File terlalu besar: 1571 lines. | 65 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | Component Size | src/pages/admin/BookkeepingPage.jsx | File terlalu besar: 1371 lines. | 32 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | Component Size | src/pages/admin/CustomerPage.jsx | File terlalu besar: 1574 lines. | 91 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | Component Size | src/pages/admin/SchedulePage.jsx | File terlalu besar: 1308 lines. | 52 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | Component Size | src/pages/admin/SettingsPage.jsx | File terlalu besar: 2431 lines. | 86 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | Component Size | src/pages/ClientPortalPage.jsx | File terlalu besar: 1750 lines. | 39 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P1 | CSS Coverage | src/**/*.jsx | 64 project class terdeteksi di JSX tapi tidak ada di CSS. | admin-notification-badge, admin-notification-shortcut, admin-page-loading, admin-topbar-actions, auth-spin, booking-detail-compact-quick-grid, client-history-tab, gallery-album-grid, gallery-empty-state, gallery-filter-row, guard-attendance-approval-actions, guard-attendance-approval-backdrop, guard-attendance-approval-close, guard-attendance-approval-copy, guard-attendance-approval-facts, guard-attendance-approval-icon, guard-attendance-approval-link, guard-attendance-approval-modal, guard-attendance-approval-note, is-, is-action, is-add-rule, is-compact, is-danger-settings, is-expanded, is-fee-settings, is-full, is-highlight, is-history, is-no-duration-package, is-other, is-price-compact, is-slim, is-submitted, is-user-settings, schedule-grid--, schedule-upcoming-empty, schedule-upcoming-head, schedule-upcoming-item, schedule-upcoming-list, schedule-upcoming-main, schedule-upcoming-meta, schedule-upcoming-more, schedule-upcoming-panel, schedule-upcoming-side, settings-account-profile-section, settings-account-security, settings-danger-actions, settings-danger-alert, settings-danger-check, settings-danger-collection, settings-danger-collections, settings-danger-confirm, settings-danger-hero, settings-danger-icon, settings-danger-message, settings-danger-summary, settings-invoice-form, settings-owner-danger-zone, settings-studio-form, settings-studio-section, settings-studio-subhead, settings-user-access-section, studio-button-spinner | VERIFY/CREATE/REWRITE | Tambahkan CSS hanya untuk class yang benar-benar dipakai. |
| P1 | CSS Size | src/styles/modules/booking.css | CSS terlalu besar: 2827 lines. | 101 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P1 | CSS Size | src/styles/modules/customer.css | CSS terlalu besar: 3645 lines. | 129 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P1 | CSS Size | src/styles/modules/inventory.css | CSS terlalu besar: 1857 lines. | 59 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P1 | CSS Size | src/styles/modules/schedule.css | CSS terlalu besar: 1889 lines. | 71 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P1 | CSS Size | src/styles/modules/settings.css | CSS terlalu besar: 2069 lines. | 77 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P1 | Hardcoded Color | src/components/ui/ConfirmDialog.jsx | 15 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/pages/ClientLandingPage.jsx | 15 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/pages/ClientLoginPage.jsx | 24 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/pages/ClientPortalPage.jsx | 19 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/client-payment-proof.css | 19 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/client-portal-calendar-tight.css | 24 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/client-portal-overhaul.css | 19 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/base.css | 17 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/billing.css | 16 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/booking.css | 43 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/customer.css | 20 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/inventory.css | 17 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/primitives-override.css | 33 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/schedule.css | 28 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Hardcoded Color | src/styles/modules/shared.css | 29 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P1 | Inline Style | src/components/ui/ConfirmDialog.jsx | 12 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Component Size | src/components/settings/OperatorFeeSettingsPanel.jsx | File terlalu besar: 783 lines. | 25 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/admin/DashboardPage.jsx | File terlalu besar: 716 lines. | 27 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/admin/GalleryPage.jsx | File terlalu besar: 933 lines. | 3 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/admin/InventoryPage.jsx | File terlalu besar: 1059 lines. | 37 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/admin/NotificationsPage.jsx | File terlalu besar: 747 lines. | 34 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/admin/OperatorFeePage.jsx | File terlalu besar: 831 lines. | 18 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | Component Size | src/pages/ClientLandingPage.jsx | File terlalu besar: 1087 lines. | 2 project classes | SPLIT | Pecah bertahap setelah visual stabil. |
| P2 | CSS Size | src/styles/client-portal-overhaul.css | CSS terlalu besar: 1147 lines. | 73 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P2 | CSS Size | src/styles/modules/billing.css | CSS terlalu besar: 1544 lines. | 54 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P2 | CSS Size | src/styles/modules/dashboard.css | CSS terlalu besar: 983 lines. | 32 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P2 | CSS Size | src/styles/modules/primitives-override.css | CSS terlalu besar: 1008 lines. | 226 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P2 | CSS Size | src/styles/modules/shared.css | CSS terlalu besar: 1328 lines. | 103 project classes | SPLIT/VERIFY | Pecah berdasarkan subdomain/component setelah usage map akurat. |
| P2 | Hardcoded Color | src/components/client/ClientBillingTab.jsx | 1 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/components/client/ClientCalendarTab.jsx | 3 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/components/client/ClientHistoryTab.jsx | 2 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/components/gallery/PhotoCard.jsx | 2 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/components/ui/ErrorBoundary.jsx | 8 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/pages/admin/GalleryPage.jsx | 1 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/pages/LoginPage.jsx | 5 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/services/emailService.js | 18 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Email HTML boleh punya hex sebagai exception, tapi tetap dokumentasikan. |
| P2 | Hardcoded Color | src/styles/client-portal-bento-override.css | 1 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/client-portal-calendar.css | 7 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/client-portal-polish.css | 4 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/firebase-auth.css | 10 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/admin-shell.css | 1 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/bookkeeping.css | 12 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/dashboard.css | 4 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/gallery.css | 1 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/guard-attendance.css | 10 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/modules/settings.css | 8 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Hardcoded Color | src/styles/onesignal-permission.css | 10 hex color ditemukan. | #RRGGBB | VERIFY/REWRITE | Ganti warna surface/status/accent dengan token tanpa mengubah layout. |
| P2 | Inline Style | src/App.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/client/ClientCalendarTab.jsx | 5 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/gallery/GalleryAlbumsView.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/gallery/GalleryLightbox.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/gallery/GalleryTimelineView.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/gallery/GalleryTrashView.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/gallery/PhotoCard.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/components/ui/ErrorBoundary.jsx | 7 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/admin/SchedulePage.jsx | 5 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/AdminPage.jsx | 4 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/ClientLandingPage.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/ClientLoginPage.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/LoginPage.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Inline Style | src/pages/PwaLaunchPage.jsx | 1 inline style ditemukan. | style={{ ... }} | REWRITE | Pindahkan ke CSS class berbasis token. Prioritaskan reusable components. |
| P2 | Native Dialog | src/components/guard/GuardAttendanceApprovalModal.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/components/settings/OperatorFeeSettingsPanel.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/components/ui/ConfirmDialog.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/BillingPage.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/BookkeepingPage.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/CustomerPage.jsx | 2 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/GalleryPage.jsx | 3 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/GuardAttendancePage.jsx | 2 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/admin/SchedulePage.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Native Dialog | src/pages/ClientPortalPage.jsx | 1 window.prompt/confirm/alert ditemukan. | window.prompt / window.confirm / window.alert | REWRITE | Ganti ke ConfirmDialog/ReasonModal/FeedbackAlert secara bertahap. |
| P2 | Potential Dead CSS | src/styles/**/*.css | 123 project CSS class tidak ditemukan di className JSX precision scan. | admin-empty-canvas, admin-empty-panel, admin-page-kicker, admin-shell, admin-topbar-action, auth-brand-mark, bento-grid, bento-item, billing-proof-status, billing-settings-button, billing-settings-panel, billing-status-pill, booking-conversation, booking-conversation-panel, booking-detail-compact-copy, booking-detail-compact-grid, booking-detail-compact-icon, booking-detail-compact-item, booking-detail-compact-status, booking-request-state, bookkeeping-form-actions, client-booking-actions, client-payment-proof-detail, client-portal-main, client-proof-status, client-request-state, cp-auth-card, cp-band-card, cp-bottom-nav, cp-button, cp-calendar-cell, cp-calendar-grid, cp-calendar-header, cp-calendar-slot, cp-card, cp-fab, cp-hero, cp-history-card, cp-input, cp-invoice-card, cp-landing, cp-modal-content, cp-nav-item, cp-schedule-card, cp-select, cp-shell, cp-textarea, cp-ticket, cp-ticket-action, cp-title, cp-topbar, customer-activity-item, customer-activity-list, customer-contact-card, customer-contact-cell, customer-date-cell, customer-filter-pill, customer-filter-row, customer-filter-select-shell, customer-followup-badge, customer-followup-empty, customer-followup-list, customer-list, customer-main-cell, customer-mini-status, customer-number-cell, customer-row, customer-row-actions, customer-row-main-button, customer-row-wrapper, customer-status-pill, customer-table-head, customer-table-row, dashboard-alert-stack, gallery-batch-banner, gallery-bento-card, gallery-category-row, gallery-clean-card, gallery-lightbox, gallery-lightbox-panel, gallery-page-title, gallery-photo-card, gallery-upload-modal, gallery-upload-panel, guard-attendance-summary-card, inventory-attention-row, inventory-item-card, inventory-movement-row, is-admin-permission-modal-open, is-elevated, is-flat, is-focus-target, is-neutral, is-outline, is-quiet, is-shape-circle, is-shape-pill, is-size-icon, is-size-lg, is-size-md | VERIFY/DELETE | Jangan delete massal. Verifikasi dynamic class dan third-party class dulu. |
| INFO | CSS Import | src/styles/admin-auth.css | Semua module CSS di src/styles/modules sudah diimport aggregator. | admin-shell.css, auth.css, base.css, billing.css, booking.css, bookkeeping.css, customer.css, dashboard.css, gallery.css, guard-attendance.css, inventory.css, notifications.css, operator-fee.css, primitives-override.css, schedule.css, settings.css, shared.css | KEEP | Pertahankan aggregator eksplisit. |
| INFO | Guard Styling | src/pages/guard/GuardAttendancePage.jsx | Semua class guard-shift-* yang terdeteksi sudah punya CSS. | guard-shift-brand, guard-shift-card, guard-shift-current, guard-shift-date-chip, guard-shift-feedback, guard-shift-form, guard-shift-ghost-button, guard-shift-hero, guard-shift-hero-actions, guard-shift-history, guard-shift-login, guard-shift-main-button, guard-shift-page, guard-shift-shell, guard-shift-status, guard-shift-status-copy, guard-shift-status-facts, guard-shift-title, guard-shift-workspace | VERIFY | Cek screenshot mobile karena coverage CSS tidak menjamin layout rapi. |

## CSS Module Import Check

### Modules Found

```txt
admin-shell.css
auth.css
base.css
billing.css
booking.css
bookkeeping.css
customer.css
dashboard.css
gallery.css
guard-attendance.css
inventory.css
notifications.css
operator-fee.css
primitives-override.css
schedule.css
settings.css
shared.css
```

### Modules Imported

```txt
base.css
shared.css
auth.css
admin-shell.css
schedule.css
booking.css
customer.css
billing.css
settings.css
inventory.css
bookkeeping.css
dashboard.css
gallery.css
operator-fee.css
notifications.css
guard-attendance.css
primitives-override.css
```

### Modules Not Imported

```txt
(none)
```

## guard-shift Coverage

### guard-shift classes used in JSX

```txt
guard-shift-brand
guard-shift-card
guard-shift-current
guard-shift-date-chip
guard-shift-feedback
guard-shift-form
guard-shift-ghost-button
guard-shift-hero
guard-shift-hero-actions
guard-shift-history
guard-shift-login
guard-shift-main-button
guard-shift-page
guard-shift-shell
guard-shift-status
guard-shift-status-copy
guard-shift-status-facts
guard-shift-title
guard-shift-workspace
```

### guard-shift classes missing CSS

```txt
(none)
```

## Missing Project Classes in CSS

```txt
admin-notification-badge
admin-notification-shortcut
admin-page-loading
admin-topbar-actions
auth-spin
booking-detail-compact-quick-grid
client-history-tab
gallery-album-grid
gallery-empty-state
gallery-filter-row
guard-attendance-approval-actions
guard-attendance-approval-backdrop
guard-attendance-approval-close
guard-attendance-approval-copy
guard-attendance-approval-facts
guard-attendance-approval-icon
guard-attendance-approval-link
guard-attendance-approval-modal
guard-attendance-approval-note
is-
is-action
is-add-rule
is-compact
is-danger-settings
is-expanded
is-fee-settings
is-full
is-highlight
is-history
is-no-duration-package
is-other
is-price-compact
is-slim
is-submitted
is-user-settings
schedule-grid--
schedule-upcoming-empty
schedule-upcoming-head
schedule-upcoming-item
schedule-upcoming-list
schedule-upcoming-main
schedule-upcoming-meta
schedule-upcoming-more
schedule-upcoming-panel
schedule-upcoming-side
settings-account-profile-section
settings-account-security
settings-danger-actions
settings-danger-alert
settings-danger-check
settings-danger-collection
settings-danger-collections
settings-danger-confirm
settings-danger-hero
settings-danger-icon
settings-danger-message
settings-danger-summary
settings-invoice-form
settings-owner-danger-zone
settings-studio-form
settings-studio-section
settings-studio-subhead
settings-user-access-section
studio-button-spinner
```

## Potential Dead Project CSS Classes

```txt
admin-empty-canvas
admin-empty-panel
admin-page-kicker
admin-shell
admin-topbar-action
auth-brand-mark
bento-grid
bento-item
billing-proof-status
billing-settings-button
billing-settings-panel
billing-status-pill
booking-conversation
booking-conversation-panel
booking-detail-compact-copy
booking-detail-compact-grid
booking-detail-compact-icon
booking-detail-compact-item
booking-detail-compact-status
booking-request-state
bookkeeping-form-actions
client-booking-actions
client-payment-proof-detail
client-portal-main
client-proof-status
client-request-state
cp-auth-card
cp-band-card
cp-bottom-nav
cp-button
cp-calendar-cell
cp-calendar-grid
cp-calendar-header
cp-calendar-slot
cp-card
cp-fab
cp-hero
cp-history-card
cp-input
cp-invoice-card
cp-landing
cp-modal-content
cp-nav-item
cp-schedule-card
cp-select
cp-shell
cp-textarea
cp-ticket
cp-ticket-action
cp-title
cp-topbar
customer-activity-item
customer-activity-list
customer-contact-card
customer-contact-cell
customer-date-cell
customer-filter-pill
customer-filter-row
customer-filter-select-shell
customer-followup-badge
customer-followup-empty
customer-followup-list
customer-list
customer-main-cell
customer-mini-status
customer-number-cell
customer-row
customer-row-actions
customer-row-main-button
customer-row-wrapper
customer-status-pill
customer-table-head
customer-table-row
dashboard-alert-stack
gallery-batch-banner
gallery-bento-card
gallery-category-row
gallery-clean-card
gallery-lightbox
gallery-lightbox-panel
gallery-page-title
gallery-photo-card
gallery-upload-modal
gallery-upload-panel
guard-attendance-summary-card
inventory-attention-row
inventory-item-card
inventory-movement-row
is-admin-permission-modal-open
is-elevated
is-flat
is-focus-target
is-neutral
is-outline
is-quiet
is-shape-circle
is-shape-pill
is-size-icon
is-size-lg
is-size-md
is-size-sm
is-today-focus-pulse
operator-fee-status
safe-area-bottom
schedule-booking-pill
schedule-count
schedule-day-head
schedule-filter-chip
schedule-filter-group
schedule-filter-label
schedule-filter-row
schedule-payment-counter
schedule-row
schedule-segment
schedule-summary-card
settings-grid
studio-badge
studio-button
studio-card
studio-select
studio-select-menu
studio-select-value
studio-status-pill
```

## Largest Files

| File | Type | Lines | Project Classes | Inline Styles | Hex Colors | Native Dialogs |
| --- | --- | --- | --- | --- | --- | --- |
| src/styles/modules/customer.css | css | 3645 | 129 | 0 | 20 | 0 |
| src/styles/modules/booking.css | css | 2827 | 101 | 0 | 43 | 0 |
| src/pages/admin/SettingsPage.jsx | js | 2431 | 86 | 0 | 0 | 0 |
| src/styles/modules/settings.css | css | 2069 | 77 | 0 | 8 | 0 |
| src/styles/modules/schedule.css | css | 1889 | 71 | 0 | 28 | 0 |
| src/styles/modules/inventory.css | css | 1857 | 59 | 0 | 17 | 0 |
| src/pages/ClientPortalPage.jsx | js | 1750 | 39 | 0 | 19 | 1 |
| src/pages/admin/CustomerPage.jsx | js | 1574 | 91 | 0 | 0 | 2 |
| src/pages/admin/BillingPage.jsx | js | 1571 | 65 | 0 | 0 | 1 |
| src/styles/modules/billing.css | css | 1544 | 54 | 0 | 16 | 0 |
| src/pages/admin/BookkeepingPage.jsx | js | 1371 | 32 | 0 | 0 | 1 |
| src/styles/modules/shared.css | css | 1328 | 103 | 0 | 29 | 0 |
| src/pages/admin/SchedulePage.jsx | js | 1308 | 52 | 5 | 0 | 1 |
| src/styles/client-portal-overhaul.css | css | 1147 | 73 | 0 | 19 | 0 |
| src/pages/ClientLandingPage.jsx | js | 1087 | 2 | 1 | 15 | 0 |
| src/pages/admin/InventoryPage.jsx | js | 1059 | 37 | 0 | 0 | 0 |
| src/styles/modules/primitives-override.css | css | 1008 | 226 | 0 | 33 | 0 |
| src/styles/modules/dashboard.css | css | 983 | 32 | 0 | 4 | 0 |
| src/pages/admin/GalleryPage.jsx | js | 933 | 3 | 0 | 1 | 3 |
| src/styles/modules/guard-attendance.css | css | 879 | 44 | 0 | 10 | 0 |
| src/pages/admin/OperatorFeePage.jsx | js | 831 | 18 | 0 | 0 | 0 |
| src/styles/modules/bookkeeping.css | css | 812 | 32 | 0 | 12 | 0 |
| src/components/settings/OperatorFeeSettingsPanel.jsx | js | 783 | 25 | 0 | 0 | 1 |
| src/pages/admin/NotificationsPage.jsx | js | 747 | 34 | 0 | 0 | 0 |
| src/pages/admin/DashboardPage.jsx | js | 716 | 27 | 0 | 0 | 0 |
| src/pages/ClientLoginPage.jsx | js | 679 | 0 | 1 | 24 | 0 |
| src/components/schedule/BookingFormModal.jsx | js | 655 | 13 | 0 | 0 | 0 |
| src/components/gallery/GalleryLightbox.jsx | js | 624 | 0 | 1 | 0 | 0 |
| src/styles/client-portal-calendar.css | css | 601 | 24 | 0 | 7 | 0 |
| src/pages/LoginPage.jsx | js | 600 | 21 | 1 | 5 | 0 |
| src/settings/operatorFeeSettings.js | js | 596 | 0 | 0 | 0 | 0 |
| src/services/adminBookingRepository.js | js | 591 | 0 | 0 | 0 | 0 |
| src/pages/guard/GuardAttendancePage.jsx | js | 564 | 29 | 0 | 0 | 0 |
| src/styles/modules/operator-fee.css | css | 563 | 45 | 0 | 0 | 0 |
| src/pages/AdminPage.jsx | js | 557 | 4 | 4 | 0 | 0 |

## Inline Style Files

| File | Inline Styles | Lines |
| --- | --- | --- |
| src/components/ui/ConfirmDialog.jsx | 12 | 236 |
| src/components/ui/ErrorBoundary.jsx | 7 | 91 |
| src/components/client/ClientCalendarTab.jsx | 5 | 158 |
| src/pages/admin/SchedulePage.jsx | 5 | 1308 |
| src/pages/AdminPage.jsx | 4 | 557 |
| src/App.jsx | 1 | 37 |
| src/components/gallery/GalleryAlbumsView.jsx | 1 | 143 |
| src/components/gallery/GalleryLightbox.jsx | 1 | 624 |
| src/components/gallery/GalleryTimelineView.jsx | 1 | 66 |
| src/components/gallery/GalleryTrashView.jsx | 1 | 74 |
| src/components/gallery/PhotoCard.jsx | 1 | 149 |
| src/pages/ClientLandingPage.jsx | 1 | 1087 |
| src/pages/ClientLoginPage.jsx | 1 | 679 |
| src/pages/LoginPage.jsx | 1 | 600 |
| src/pages/PwaLaunchPage.jsx | 1 | 91 |

## Hardcoded Hex Files

| File | Hex Count | Lines |
| --- | --- | --- |
| src/styles/modules/booking.css | 43 | 2827 |
| src/styles/modules/primitives-override.css | 33 | 1008 |
| src/styles/modules/shared.css | 29 | 1328 |
| src/styles/modules/schedule.css | 28 | 1889 |
| src/pages/ClientLoginPage.jsx | 24 | 679 |
| src/styles/client-portal-calendar-tight.css | 24 | 455 |
| src/styles/modules/customer.css | 20 | 3645 |
| src/pages/ClientPortalPage.jsx | 19 | 1750 |
| src/styles/client-payment-proof.css | 19 | 359 |
| src/styles/client-portal-overhaul.css | 19 | 1147 |
| src/services/emailService.js | 18 | 124 |
| src/styles/modules/base.css | 17 | 94 |
| src/styles/modules/inventory.css | 17 | 1857 |
| src/styles/modules/billing.css | 16 | 1544 |
| src/components/ui/ConfirmDialog.jsx | 15 | 236 |
| src/pages/ClientLandingPage.jsx | 15 | 1087 |
| src/styles/modules/bookkeeping.css | 12 | 812 |
| src/styles/firebase-auth.css | 10 | 310 |
| src/styles/modules/guard-attendance.css | 10 | 879 |
| src/styles/onesignal-permission.css | 10 | 109 |
| src/components/ui/ErrorBoundary.jsx | 8 | 91 |
| src/styles/modules/settings.css | 8 | 2069 |
| src/styles/client-portal-calendar.css | 7 | 601 |
| src/pages/LoginPage.jsx | 5 | 600 |
| src/styles/client-portal-polish.css | 4 | 425 |
| src/styles/modules/dashboard.css | 4 | 983 |
| src/components/client/ClientCalendarTab.jsx | 3 | 158 |
| src/components/client/ClientHistoryTab.jsx | 2 | 132 |
| src/components/gallery/PhotoCard.jsx | 2 | 149 |
| src/components/client/ClientBillingTab.jsx | 1 | 125 |
| src/pages/admin/GalleryPage.jsx | 1 | 933 |
| src/styles/client-portal-bento-override.css | 1 | 115 |
| src/styles/modules/admin-shell.css | 1 | 352 |
| src/styles/modules/gallery.css | 1 | 479 |

## Recommended Next Fix Order

1. Jika guard-shift missing CSS = 0, lanjut screenshot review halaman yang paling rusak.
2. Fix visual paling rusak dulu, bukan file terbesar dulu.
3. Clean inline styles di shared primitives: ConfirmDialog, ErrorBoundary, AccessState, Button/Card.
4. Tokenize high-impact shared CSS sebelum page-specific CSS.
5. Split huge pages setelah UI stabil.
6. Verify dead CSS manual sebelum delete.

## Screenshot Checklist

- /guard/attendance mobile
- /admin/dashboard mobile
- /admin/bookkeeping mobile
- /admin/operator-fee mobile
- /admin/notifications mobile
- /client/portal mobile
- /login mobile
