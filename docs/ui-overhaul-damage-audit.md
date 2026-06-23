# UI Overhaul Damage Audit - 37 Studio Proper

Generated at: 2026-06-23T18:57:48.598Z

## Scope

Audit ini membaca working tree lokal dan fokus pada kerusakan UI setelah overhaul.

Yang dicek:

1. JSX class tanpa CSS.
2. CSS class tanpa JSX usage.
3. CSS module yang tidak di-import aggregator.
4. Inline styles.
5. Hardcoded hex colors.
6. File terlalu besar.
7. CSS terlalu besar.
8. window.prompt/confirm/alert.
9. Prefix class yang tumbuh liar.

## Git State

- Branch: `main`
- Last commit: `7278db1 Add comprehensive UI audit prompt for Midnight Linear + Bento Box overhaul`

```txt
M .firebase/hosting.ZGlzdA.cache
?? scripts/audit-ui-overhaul-damage.cjs
```

## Executive Summary

- JS/React files scanned: 101
- CSS files scanned: 28
- Missing JSX classes in CSS: 934
- CSS classes not found in JSX scan: 180
- CSS modules not imported by admin-auth.css: 0
- Findings P0: 1
- Findings P1: 28
- Findings P2: 55
- Findings P3: 0
- Findings INFO: 13

## Findings

| Severity | Area | File | Problem | Evidence | Action | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | CSS Coverage | src/**/*.jsx | 934 JSX class tidak ditemukan di CSS. | admin, Menu, mobile, Navigasi, tambahan, ada, admin-notification-badge, bermasalah, notifikasi, Tidak, Buka, desktop, sidebar, Tutup, admin-notification-shortcut, admin-topbar-actions, 0, Akses, akun, auth-spin, Admin, booking, is-, Komunikasi, pesan, Studio, Tulis, border, Bukti, filter, flex-col, grid-cols-1, items-start, Latihan, leading-relaxed, Menunggu, noopener, noreferrer, overflow-hidden, pointer-events-none | VERIFY/CREATE/REWRITE | Class yang benar-benar dipakai harus punya style di module CSS yang tepat. Class utility/Tailwind boleh di-ignore setelah verifikasi. |
| P1 | Component Size | src/pages/admin/SettingsPage.jsx | File terlalu besar: 2431 lines. | 241 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | Component Size | src/pages/ClientPortalPage.jsx | File terlalu besar: 1750 lines. | 162 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | Component Size | src/pages/admin/CustomerPage.jsx | File terlalu besar: 1574 lines. | 185 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | Component Size | src/pages/admin/BillingPage.jsx | File terlalu besar: 1571 lines. | 140 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | Component Size | src/pages/admin/BookkeepingPage.jsx | File terlalu besar: 1371 lines. | 129 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | Component Size | src/pages/admin/SchedulePage.jsx | File terlalu besar: 1308 lines. | 109 classes, 5 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/ClientLandingPage.jsx | File terlalu besar: 1087 lines. | 206 classes, 1 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/admin/InventoryPage.jsx | File terlalu besar: 1059 lines. | 128 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/admin/GalleryPage.jsx | File terlalu besar: 933 lines. | 31 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/admin/OperatorFeePage.jsx | File terlalu besar: 831 lines. | 61 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/components/settings/OperatorFeeSettingsPanel.jsx | File terlalu besar: 783 lines. | 68 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/admin/NotificationsPage.jsx | File terlalu besar: 747 lines. | 77 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P2 | Component Size | src/pages/admin/DashboardPage.jsx | File terlalu besar: 716 lines. | 54 classes, 0 inline styles | SPLIT | Pecah menjadi shell, feature components, hooks, dan UI primitives. |
| P1 | CSS Size | src/styles/modules/customer.css | CSS file besar: 3645 lines. | 129 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P1 | CSS Size | src/styles/modules/booking.css | CSS file besar: 2827 lines. | 105 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P1 | CSS Size | src/styles/modules/settings.css | CSS file besar: 2069 lines. | 77 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P1 | CSS Size | src/styles/modules/schedule.css | CSS file besar: 1889 lines. | 72 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P1 | CSS Size | src/styles/modules/inventory.css | CSS file besar: 1857 lines. | 59 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | CSS Size | src/styles/modules/billing.css | CSS file besar: 1544 lines. | 54 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | CSS Size | src/styles/modules/shared.css | CSS file besar: 1328 lines. | 110 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | CSS Size | src/styles/client-portal-overhaul.css | CSS file besar: 1147 lines. | 73 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | CSS Size | src/styles/modules/primitives-override.css | CSS file besar: 1008 lines. | 256 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | CSS Size | src/styles/modules/dashboard.css | CSS file besar: 983 lines. | 39 classes | SPLIT/VERIFY | Pastikan isi file sesuai domain. Pindahkan style page-specific dari shared/base. |
| P2 | Inline Style | src/components/ui/ConfirmDialog.jsx | Ditemukan 12 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/ui/ErrorBoundary.jsx | Ditemukan 7 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/client/ClientCalendarTab.jsx | Ditemukan 5 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/admin/SchedulePage.jsx | Ditemukan 5 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/AdminPage.jsx | Ditemukan 4 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/App.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/gallery/GalleryAlbumsView.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/gallery/GalleryLightbox.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/gallery/GalleryTimelineView.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/gallery/GalleryTrashView.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/components/gallery/PhotoCard.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/ClientLandingPage.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/ClientLoginPage.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/LoginPage.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P2 | Inline Style | src/pages/PwaLaunchPage.jsx | Ditemukan 1 inline style. | style={{ ... }} | REWRITE | Pindahkan ke CSS module class berbasis token agar theme dan spacing konsisten. |
| P1 | Hardcoded Color | src/styles/modules/booking.css | Ditemukan 43 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/primitives-override.css | Ditemukan 33 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/shared.css | Ditemukan 29 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/schedule.css | Ditemukan 28 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/pages/ClientLoginPage.jsx | Ditemukan 24 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/client-portal-calendar-tight.css | Ditemukan 24 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/customer.css | Ditemukan 20 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/pages/ClientPortalPage.jsx | Ditemukan 19 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/client-payment-proof.css | Ditemukan 19 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/client-portal-overhaul.css | Ditemukan 19 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/services/emailService.js | Ditemukan 18 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/base.css | Ditemukan 17 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/inventory.css | Ditemukan 17 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/billing.css | Ditemukan 16 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/components/ui/ConfirmDialog.jsx | Ditemukan 15 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/pages/ClientLandingPage.jsx | Ditemukan 15 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P1 | Hardcoded Color | src/styles/modules/bookkeeping.css | Ditemukan 12 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/firebase-auth.css | Ditemukan 10 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/modules/guard-attendance.css | Ditemukan 10 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/onesignal-permission.css | Ditemukan 10 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/components/ui/ErrorBoundary.jsx | Ditemukan 8 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/modules/settings.css | Ditemukan 8 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/client-portal-calendar.css | Ditemukan 7 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/pages/LoginPage.jsx | Ditemukan 5 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/client-portal-polish.css | Ditemukan 4 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/modules/dashboard.css | Ditemukan 4 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/components/client/ClientCalendarTab.jsx | Ditemukan 3 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/components/client/ClientHistoryTab.jsx | Ditemukan 2 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/components/gallery/PhotoCard.jsx | Ditemukan 2 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/components/client/ClientBillingTab.jsx | Ditemukan 1 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/pages/admin/GalleryPage.jsx | Ditemukan 1 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/client-portal-bento-override.css | Ditemukan 1 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/modules/admin-shell.css | Ditemukan 1 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | Hardcoded Color | src/styles/modules/gallery.css | Ditemukan 1 hex color. | #RRGGBB / arbitrary color | REWRITE | Ganti warna status/surface/accent dengan CSS token. Fallback token boleh dipertahankan setelah verifikasi. |
| P2 | UX Modal | src/pages/admin/GalleryPage.jsx | Ditemukan 3 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/admin/CustomerPage.jsx | Ditemukan 2 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/admin/GuardAttendancePage.jsx | Ditemukan 2 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/components/guard/GuardAttendanceApprovalModal.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/components/settings/OperatorFeeSettingsPanel.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/components/ui/ConfirmDialog.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/admin/BillingPage.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/admin/BookkeepingPage.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/admin/SchedulePage.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| P2 | UX Modal | src/pages/ClientPortalPage.jsx | Ditemukan 1 window prompt/confirm/alert. | window.prompt / window.confirm / window.alert | REWRITE | Ganti dengan ReasonModal, ConfirmDialog, atau FeedbackAlert yang konsisten dan mobile-friendly. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "customer" muncul 78 kali. | customer | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "settings" muncul 74 kali. | settings | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "billing" muncul 56 kali. | billing | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "schedule" muncul 49 kali. | schedule | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "is" muncul 46 kali. | is | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "booking" muncul 38 kali. | booking | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "operator" muncul 37 kali. | operator | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "inventory" muncul 32 kali. | inventory | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "notification" muncul 31 kali. | notification | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "guard-attendance" muncul 22 kali. | guard-attendance | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "bookkeeping" muncul 22 kali. | bookkeeping | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "dashboard" muncul 22 kali. | dashboard | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| INFO | Class Prefix | src/**/*.jsx | Prefix class "auth" muncul 21 kali. | auth | VERIFY | Pastikan prefix punya module CSS domain yang jelas dan tidak tersebar lintas page tanpa komponen reusable. |
| P2 | Dead CSS | src/styles/**/*.css | 180 CSS class tidak ditemukan di JSX scan sederhana. | md, client-payment-proof-detail, client-proof-status, cp-auth-card, cp-band-card, cp-bottom-nav, cp-button, cp-calendar-cell, cp-calendar-grid, cp-calendar-header, cp-calendar-slot, cp-card, cp-fab, cp-hero, cp-history-card, cp-input, cp-invoice-card, cp-landing, cp-modal-content, cp-nav-item, cp-schedule-card, cp-select, cp-shell, cp-textarea, cp-ticket, cp-ticket-action, cp-title, cp-topbar, is-available, is-booked, is-occupied-other, is-today, schedule-day-head, is-dp, is-lunas, is-attention, is-confirmed, studio-select, client-portal-main, me, com, googleapis, admin-empty-canvas, admin-empty-panel, admin-page-kicker, admin-shell, is-sidebar-collapsed, auth-brand-mark, bento-grid, bento-item, expanded, mobile-accordion-content, safe-area-bottom, billing-settings-button, billing-settings-panel, billing-status-pill, billing-proof-status, booking-conversation-panel, booking-detail-compact-copy, booking-detail-compact-grid, booking-detail-compact-icon, booking-detail-compact-item, CSS, has-booking, has-client-message, is-cancelled, is-discount, is-own, is-paid, is-total, customer-activity-item, customer-activity-list, customer-contact-cell, customer-date-cell, customer-filter-pill, customer-filter-row, customer-filter-select-shell, customer-followup-badge, customer-followup-empty, customer-followup-list | VERIFY/DELETE | Verifikasi class dinamis dulu. Setelah aman, hapus CSS obsolete agar overhaul tidak meninggalkan puing. |

## Largest / Riskiest Files

| File | Type | Lines | Classes | Inline Styles | Hex Colors |
| --- | --- | ---: | ---: | ---: | ---: |
| src/styles/modules/customer.css | css | 3645 | 129 | 0 | 20 |
| src/styles/modules/booking.css | css | 2827 | 105 | 0 | 43 |
| src/pages/admin/SettingsPage.jsx | jsx/js | 2431 | 241 | 0 | 0 |
| src/styles/modules/settings.css | css | 2069 | 77 | 0 | 8 |
| src/styles/modules/schedule.css | css | 1889 | 72 | 0 | 28 |
| src/styles/modules/inventory.css | css | 1857 | 59 | 0 | 17 |
| src/pages/ClientPortalPage.jsx | jsx/js | 1750 | 162 | 0 | 19 |
| src/pages/admin/CustomerPage.jsx | jsx/js | 1574 | 185 | 0 | 0 |
| src/pages/admin/BillingPage.jsx | jsx/js | 1571 | 140 | 0 | 0 |
| src/styles/modules/billing.css | css | 1544 | 54 | 0 | 16 |
| src/pages/admin/BookkeepingPage.jsx | jsx/js | 1371 | 129 | 0 | 0 |
| src/styles/modules/shared.css | css | 1328 | 110 | 0 | 29 |
| src/pages/admin/SchedulePage.jsx | jsx/js | 1308 | 109 | 5 | 0 |
| src/styles/client-portal-overhaul.css | css | 1147 | 73 | 0 | 19 |
| src/pages/ClientLandingPage.jsx | jsx/js | 1087 | 206 | 1 | 15 |
| src/pages/admin/InventoryPage.jsx | jsx/js | 1059 | 128 | 0 | 0 |
| src/styles/modules/primitives-override.css | css | 1008 | 256 | 0 | 33 |
| src/styles/modules/dashboard.css | css | 983 | 39 | 0 | 4 |
| src/pages/admin/GalleryPage.jsx | jsx/js | 933 | 31 | 0 | 1 |
| src/styles/modules/guard-attendance.css | css | 879 | 44 | 0 | 10 |
| src/pages/admin/OperatorFeePage.jsx | jsx/js | 831 | 61 | 0 | 0 |
| src/styles/modules/bookkeeping.css | css | 812 | 32 | 0 | 12 |
| src/components/settings/OperatorFeeSettingsPanel.jsx | jsx/js | 783 | 68 | 0 | 0 |
| src/pages/admin/NotificationsPage.jsx | jsx/js | 747 | 77 | 0 | 0 |
| src/pages/admin/DashboardPage.jsx | jsx/js | 716 | 54 | 0 | 0 |
| src/pages/ClientLoginPage.jsx | jsx/js | 679 | 112 | 1 | 24 |
| src/components/schedule/BookingFormModal.jsx | jsx/js | 655 | 51 | 0 | 0 |
| src/components/gallery/GalleryLightbox.jsx | jsx/js | 624 | 148 | 1 | 0 |
| src/styles/client-portal-calendar.css | css | 601 | 24 | 0 | 7 |
| src/pages/LoginPage.jsx | jsx/js | 600 | 76 | 1 | 5 |
| src/settings/operatorFeeSettings.js | jsx/js | 596 | 24 | 0 | 0 |
| src/services/adminBookingRepository.js | jsx/js | 591 | 9 | 0 | 0 |
| src/pages/guard/GuardAttendancePage.jsx | jsx/js | 564 | 45 | 0 | 0 |
| src/styles/modules/operator-fee.css | css | 563 | 45 | 0 | 0 |
| src/pages/AdminPage.jsx | jsx/js | 557 | 31 | 4 | 0 |

## CSS Modules

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

### Modules Imported by admin-auth.css

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

## Missing JSX Classes in CSS

Total: 934

| Class | Files |
| --- | --- |
| admin | src/components/admin/AdminBottomNav.jsx<br>src/components/admin/AdminSidebar.jsx<br>src/components/client/ClientDashboardTab.jsx<br>src/pages/admin/DashboardPage.jsx<br>src/pages/admin/SettingsPage.jsx |
| Menu | src/components/admin/AdminBottomNav.jsx<br>src/components/admin/AdminSidebar.jsx |
| mobile | src/components/admin/AdminBottomNav.jsx |
| Navigasi | src/components/admin/AdminBottomNav.jsx<br>src/components/admin/AdminSidebar.jsx<br>src/pages/ClientPortalPage.jsx |
| tambahan | src/components/admin/AdminBottomNav.jsx<br>src/pages/admin/BookkeepingPage.jsx |
| ada | src/components/admin/AdminNotificationBadge.jsx<br>src/constants/scheduleConfig.js<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/CustomerPage.jsx |
| admin-notification-badge | src/components/admin/AdminNotificationBadge.jsx |
| bermasalah | src/components/admin/AdminNotificationBadge.jsx |
| notifikasi | src/components/admin/AdminNotificationBadge.jsx<br>src/components/notifications/OneSignalPermissionWidget.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/CustomerPage.jsx |
| Tidak | src/components/admin/AdminNotificationBadge.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/admin/InventoryPage.jsx |
| Buka | src/components/admin/AdminSidebar.jsx<br>src/components/gallery/GalleryToolbar.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/AdminPage.jsx<br>src/pages/ClientLoginPage.jsx |
| desktop | src/components/admin/AdminSidebar.jsx |
| sidebar | src/components/admin/AdminSidebar.jsx |
| Tutup | src/components/admin/AdminSidebar.jsx<br>src/components/gallery/GalleryToolbar.jsx<br>src/components/guard/GuardAttendanceApprovalModal.jsx<br>src/components/notifications/OneSignalPermissionWidget.jsx<br>src/components/schedule/BookingDetailModal.jsx |
| admin-notification-shortcut | src/components/admin/AdminTopbar.jsx |
| admin-topbar-actions | src/components/admin/AdminTopbar.jsx |
| 0 | src/components/auth/AccountRoleDecisionDialog.jsx<br>src/components/ui/ConfirmDialog.jsx<br>src/components/ui/ErrorBoundary.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/ClientLoginPage.jsx |
| Akses | src/components/auth/AccountRoleDecisionDialog.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/pages/AdminPage.jsx |
| akun | src/components/auth/AccountRoleDecisionDialog.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/pages/ClientLoginPage.jsx<br>src/pages/LoginPage.jsx<br>src/utils/accountSettings.js |
| auth-spin | src/components/auth/AccountRoleDecisionDialog.jsx<br>src/components/guard/GuardAttendanceApprovalModal.jsx<br>src/components/ui/AccessState.jsx<br>src/components/ui/Button.jsx<br>src/components/ui/LoadingState.jsx |
| Admin | src/components/booking/BookingConversationPanel.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/NotificationsPage.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/pages/AdminPage.jsx |
| booking | src/components/booking/BookingConversationPanel.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/schedule/BookingDetailModal.jsx<br>src/components/schedule/BookingFormModal.jsx<br>src/pages/admin/BillingPage.jsx |
| is- | src/components/booking/BookingConversationPanel.jsx<br>src/components/schedule/BookingDetailModal.jsx<br>src/components/ui/StudioSelect.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/admin/InventoryPage.jsx |
| Komunikasi | src/components/booking/BookingConversationPanel.jsx |
| pesan | src/components/booking/BookingConversationPanel.jsx |
| Studio | src/components/booking/BookingConversationPanel.jsx<br>src/components/client/ClientDashboardTab.jsx<br>src/components/settings/OperatorFeeSettingsPanel.jsx<br>src/constants/appConstants.js<br>src/pages/admin/BillingPage.jsx |
| Tulis | src/components/booking/BookingConversationPanel.jsx |
| border | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/EmptyGalleryState.jsx |
| Bukti | src/components/client/ClientBillingTab.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/pages/ClientPortalPage.jsx<br>src/services/paymentProofRepository.js |
| filter | src/components/client/ClientBillingTab.jsx<br>src/pages/ClientLandingPage.jsx |
| flex-col | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryBatchBanner.jsx |
| grid-cols-1 | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| items-start | src/components/client/ClientBillingTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientLoginPage.jsx<br>src/pages/ClientPortalPage.jsx |
| Latihan | src/components/client/ClientBillingTab.jsx<br>src/constants/scheduleConfig.js<br>src/pages/ClientPortalPage.jsx<br>src/settings/pricingSettings.js<br>src/utils/clientPortalHelpers.js |
| leading-relaxed | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/components/ui/AccessState.jsx |
| Menunggu | src/components/client/ClientBillingTab.jsx<br>src/pages/AdminPage.jsx<br>src/pages/guard/GuardAttendancePage.jsx<br>src/services/bookingCommunicationRepository.js<br>src/services/paymentProofRepository.js |
| noopener | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientDashboardTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| noreferrer | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientDashboardTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| overflow-hidden | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx |
| pointer-events-none | src/components/client/ClientBillingTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientLoginPage.jsx<br>src/pages/ClientPortalPage.jsx |
| pt-2 | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientPortalPage.jsx |
| Review | src/components/client/ClientBillingTab.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/OperatorFeePage.jsx<br>src/services/paymentProofRepository.js |
| right-0 | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/pages/ClientLandingPage.jsx |
| rounded-2xl | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/EmptyGalleryState.jsx |
| rounded-xl | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/GalleryAlbumsView.jsx<br>src/components/gallery/GalleryBatchBanner.jsx<br>src/components/gallery/GalleryLightbox.jsx |
| Sesi | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientDashboardTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/pages/admin/SchedulePage.jsx<br>src/pages/ClientLandingPage.jsx |
| shadow-xl | src/components/client/ClientBillingTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| space-y-1 | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryTrashView.jsx<br>src/components/gallery/PhotoCard.jsx |
| space-y-3 | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/pages/ClientLandingPage.jsx |
| tracking-wide | src/components/client/ClientBillingTab.jsx<br>src/components/gallery/GalleryTimelineView.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientLoginPage.jsx |
| tracking-wider | src/components/client/ClientBillingTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/admin/GalleryPage.jsx |
| Upload | src/components/client/ClientBillingTab.jsx<br>src/pages/ClientPortalPage.jsx |
| flex-wrap | src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| gap-x-4 | src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| gap-y-2 | src/components/client/ClientCalendarTab.jsx |
| h-8 | src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/ClientLandingPage.jsx |
| mode | src/components/client/ClientCalendarTab.jsx |
| rounded-lg | src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/GalleryBatchBanner.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/components/gallery/PhotoCard.jsx |
| rounded-md | src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx |
| self-start | src/components/client/ClientCalendarTab.jsx |
| transition-all | src/components/client/ClientCalendarTab.jsx<br>src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryAlbumsView.jsx<br>src/components/gallery/GalleryBatchBanner.jsx |
| transition-colors | src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/components/gallery/PhotoCard.jsx |
| w-8 | src/components/client/ClientCalendarTab.jsx<br>src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/ClientLandingPage.jsx |
| Bantuan | src/components/client/ClientDashboardTab.jsx |
| baru | src/components/client/ClientDashboardTab.jsx<br>src/pages/admin/InventoryPage.jsx<br>src/pages/admin/SchedulePage.jsx<br>src/services/adminBookingRepository.js<br>src/services/bookingCommunicationRepository.js |
| client | src/components/client/ClientDashboardTab.jsx<br>src/components/schedule/BookingDetailModal.jsx<br>src/pages/admin/SchedulePage.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/pages/ClientLoginPage.jsx |
| dari | src/components/client/ClientDashboardTab.jsx<br>src/components/schedule/BookingFormModal.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/admin/SettingsPage.jsx |
| Pesan | src/components/client/ClientDashboardTab.jsx<br>src/pages/admin/SchedulePage.jsx<br>src/pages/admin/SettingsPage.jsx<br>src/services/bookingCommunicationRepository.js |
| backdrop-blur-md | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/components/gallery/PhotoCard.jsx |
| client-history-tab | src/components/client/ClientHistoryTab.jsx |
| cursor-pointer | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/components/gallery/PhotoCard.jsx |
| duration-300 | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx |
| Filter | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/GalleryToolbar.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/GuardAttendancePage.jsx<br>src/pages/admin/SchedulePage.jsx |
| font-medium | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryTimelineView.jsx<br>src/components/gallery/GalleryUploadModal.jsx |
| gap-y-1 | src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| kode | src/components/client/ClientHistoryTab.jsx<br>src/pages/LoginPage.jsx |
| leading-tight | src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| max-w-xs | src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx |
| pt-3 | src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| riwayat | src/components/client/ClientHistoryTab.jsx |
| Salin | src/components/client/ClientHistoryTab.jsx |
| Selesai | src/components/client/ClientHistoryTab.jsx<br>src/pages/admin/NotificationsPage.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/guard/GuardAttendancePage.jsx |
| shrink-0 | src/components/client/ClientHistoryTab.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientLoginPage.jsx<br>src/pages/LoginPage.jsx |
| space-y-2 | src/components/client/ClientHistoryTab.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| duration-700 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx |
| from-zinc-950 | src/components/gallery/AlbumFolderCard.jsx |
| group | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx |
| h-12 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/pages/ClientLandingPage.jsx |
| inset-0 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| justify-end | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryBatchBanner.jsx<br>src/components/gallery/GalleryUploadModal.jsx |
| line-clamp-1 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx |
| object-cover | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx |
| opacity-20 | src/components/gallery/AlbumFolderCard.jsx |
| opacity-60 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryUploadModal.jsx |
| shadow-md | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx |
| to-transparent | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/GalleryTimelineView.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| transition-transform | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientPortalPage.jsx |
| w-12 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/pages/ClientLandingPage.jsx |
| w-fit | src/components/gallery/AlbumFolderCard.jsx<br>src/pages/LoginPage.jsx |
| z-0 | src/components/gallery/AlbumFolderCard.jsx |
| z-10 | src/components/gallery/AlbumFolderCard.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx<br>src/pages/ClientLandingPage.jsx<br>src/pages/ClientLoginPage.jsx |
| Ada | src/components/gallery/EmptyGalleryState.jsx<br>src/pages/admin/CustomerPage.jsx |
| Album | src/components/gallery/EmptyGalleryState.jsx |
| Belum | src/components/gallery/EmptyGalleryState.jsx<br>src/constants/scheduleConfig.js<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/CustomerPage.jsx<br>src/pages/admin/GuardAttendancePage.jsx |
| Foto | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryAlbumsView.jsx |
| Galeri | src/components/gallery/EmptyGalleryState.jsx |
| gallery-empty-state | src/components/gallery/EmptyGalleryState.jsx |
| h-16 | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryUploadModal.jsx<br>src/pages/ClientLandingPage.jsx |
| Ini | src/components/gallery/EmptyGalleryState.jsx<br>src/pages/admin/BillingPage.jsx<br>src/pages/admin/BookkeepingPage.jsx<br>src/pages/admin/DashboardPage.jsx<br>src/pages/admin/OperatorFeePage.jsx |
| Katalog | src/components/gallery/EmptyGalleryState.jsx |
| Kosong | src/components/gallery/EmptyGalleryState.jsx<br>src/pages/admin/NotificationsPage.jsx |
| max-w-lg | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryUploadModal.jsx |
| max-w-sm | src/components/gallery/EmptyGalleryState.jsx |
| opacity-65 | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryUploadModal.jsx |
| Sampah | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/GalleryLightbox.jsx<br>src/components/gallery/PhotoCard.jsx |
| Tempat | src/components/gallery/EmptyGalleryState.jsx<br>src/components/gallery/PhotoCard.jsx |
| Unggah | src/components/gallery/EmptyGalleryState.jsx |
| w-16 | src/components/gallery/EmptyGalleryState.jsx<br>src/pages/ClientLandingPage.jsx |
| 8 | src/components/gallery/GalleryAlbumsView.jsx |
| Baru | src/components/gallery/GalleryAlbumsView.jsx<br>src/pages/admin/InventoryPage.jsx |

## Potential Dead CSS Classes

Total: 180

| Class | Files |
| --- | --- |
| md | src/styles/client-landing-compact.css |
| client-payment-proof-detail | src/styles/client-payment-proof.css<br>src/styles/modules/primitives-override.css |
| client-proof-status | src/styles/client-payment-proof.css |
| cp-auth-card | src/styles/client-portal-bento-override.css |
| cp-band-card | src/styles/client-portal-bento-override.css |
| cp-bottom-nav | src/styles/client-portal-bento-override.css |
| cp-button | src/styles/client-portal-bento-override.css |
| cp-calendar-cell | src/styles/client-portal-bento-override.css |
| cp-calendar-grid | src/styles/client-portal-bento-override.css |
| cp-calendar-header | src/styles/client-portal-bento-override.css |
| cp-calendar-slot | src/styles/client-portal-bento-override.css |
| cp-card | src/styles/client-portal-bento-override.css |
| cp-fab | src/styles/client-portal-bento-override.css |
| cp-hero | src/styles/client-portal-bento-override.css |
| cp-history-card | src/styles/client-portal-bento-override.css |
| cp-input | src/styles/client-portal-bento-override.css |
| cp-invoice-card | src/styles/client-portal-bento-override.css |
| cp-landing | src/styles/client-portal-bento-override.css |
| cp-modal-content | src/styles/client-portal-bento-override.css |
| cp-nav-item | src/styles/client-portal-bento-override.css |
| cp-schedule-card | src/styles/client-portal-bento-override.css |
| cp-select | src/styles/client-portal-bento-override.css |
| cp-shell | src/styles/client-portal-bento-override.css |
| cp-textarea | src/styles/client-portal-bento-override.css |
| cp-ticket | src/styles/client-portal-bento-override.css |
| cp-ticket-action | src/styles/client-portal-bento-override.css |
| cp-title | src/styles/client-portal-bento-override.css |
| cp-topbar | src/styles/client-portal-bento-override.css |
| is-available | src/styles/client-portal-bento-override.css |
| is-booked | src/styles/client-portal-bento-override.css |
| is-occupied-other | src/styles/client-portal-calendar-tight.css<br>src/styles/client-portal-calendar.css |
| is-today | src/styles/client-portal-calendar-tight.css<br>src/styles/client-portal-calendar.css<br>src/styles/client-portal-overhaul.css<br>src/styles/modules/primitives-override.css<br>src/styles/modules/schedule.css |
| schedule-day-head | src/styles/client-portal-calendar-tight.css<br>src/styles/client-portal-calendar.css<br>src/styles/client-portal-overhaul.css<br>src/styles/modules/primitives-override.css<br>src/styles/modules/schedule.css |
| is-dp | src/styles/client-portal-calendar.css<br>src/styles/modules/billing.css<br>src/styles/modules/booking.css<br>src/styles/modules/customer.css<br>src/styles/modules/primitives-override.css |
| is-lunas | src/styles/client-portal-calendar.css<br>src/styles/modules/billing.css<br>src/styles/modules/booking.css<br>src/styles/modules/customer.css<br>src/styles/modules/primitives-override.css |
| is-attention | src/styles/client-portal-overhaul.css<br>src/styles/modules/booking.css<br>src/styles/modules/primitives-override.css |
| is-confirmed | src/styles/client-portal-overhaul.css<br>src/styles/modules/booking.css<br>src/styles/modules/primitives-override.css |
| studio-select | src/styles/client-portal-overhaul.css<br>src/styles/modules/booking.css<br>src/styles/modules/bookkeeping.css<br>src/styles/modules/customer.css<br>src/styles/modules/inventory.css |
| client-portal-main | src/styles/client-portal-polish.css |
| me | src/styles/client-portal-polish.css |
| com | src/styles/index.css |
| googleapis | src/styles/index.css |
| admin-empty-canvas | src/styles/modules/admin-shell.css<br>src/styles/modules/primitives-override.css |
| admin-empty-panel | src/styles/modules/admin-shell.css<br>src/styles/modules/primitives-override.css |
| admin-page-kicker | src/styles/modules/admin-shell.css |
| admin-shell | src/styles/modules/admin-shell.css<br>src/styles/modules/customer.css<br>src/styles/modules/dashboard.css<br>src/styles/modules/inventory.css<br>src/styles/modules/primitives-override.css |
| is-sidebar-collapsed | src/styles/modules/admin-shell.css<br>src/styles/modules/primitives-override.css |
| auth-brand-mark | src/styles/modules/auth.css |
| bento-grid | src/styles/modules/base.css |
| bento-item | src/styles/modules/base.css |
| expanded | src/styles/modules/base.css |
| mobile-accordion-content | src/styles/modules/base.css |
| safe-area-bottom | src/styles/modules/base.css |
| billing-settings-button | src/styles/modules/billing.css |
| billing-settings-panel | src/styles/modules/billing.css |
| billing-status-pill | src/styles/modules/billing.css<br>src/styles/modules/primitives-override.css |
| billing-proof-status | src/styles/modules/booking.css |
| booking-conversation-panel | src/styles/modules/booking.css |
| booking-detail-compact-copy | src/styles/modules/booking.css |
| booking-detail-compact-grid | src/styles/modules/booking.css |
| booking-detail-compact-icon | src/styles/modules/booking.css |
| booking-detail-compact-item | src/styles/modules/booking.css |
| CSS | src/styles/modules/booking.css<br>src/styles/modules/schedule.css |
| has-booking | src/styles/modules/booking.css |
| has-client-message | src/styles/modules/booking.css |
| is-cancelled | src/styles/modules/booking.css<br>src/styles/modules/primitives-override.css |
| is-discount | src/styles/modules/booking.css |
| is-own | src/styles/modules/booking.css |
| is-paid | src/styles/modules/booking.css<br>src/styles/modules/customer.css |
| is-total | src/styles/modules/booking.css |
| customer-activity-item | src/styles/modules/customer.css |
| customer-activity-list | src/styles/modules/customer.css |
| customer-contact-cell | src/styles/modules/customer.css |
| customer-date-cell | src/styles/modules/customer.css |
| customer-filter-pill | src/styles/modules/customer.css |
| customer-filter-row | src/styles/modules/customer.css |
| customer-filter-select-shell | src/styles/modules/customer.css |
| customer-followup-badge | src/styles/modules/customer.css |
| customer-followup-empty | src/styles/modules/customer.css |
| customer-followup-list | src/styles/modules/customer.css |
| customer-main-cell | src/styles/modules/customer.css |
| customer-number-cell | src/styles/modules/customer.css |
| customer-row-actions | src/styles/modules/customer.css |
| customer-row-main-button | src/styles/modules/customer.css |
| customer-status-pill | src/styles/modules/customer.css |
| customer-table-head | src/styles/modules/customer.css |
| customer-table-row | src/styles/modules/customer.css |
| is-duplicate | src/styles/modules/customer.css |
| is-idle | src/styles/modules/customer.css |
| dashboard-alert-stack | src/styles/modules/dashboard.css |
| dashboard-metric-card | src/styles/modules/dashboard.css<br>src/styles/modules/primitives-override.css |
| is-customer | src/styles/modules/dashboard.css |
| recharts-cartesian-axis-tick-value | src/styles/modules/dashboard.css |
| recharts-legend-item-text | src/styles/modules/dashboard.css |
| recharts-surface | src/styles/modules/dashboard.css |
| recharts-tooltip-wrapper | src/styles/modules/dashboard.css |
| recharts-wrapper | src/styles/modules/dashboard.css |
| bottom-2 | src/styles/modules/gallery.css |
| gallery-category-row | src/styles/modules/gallery.css |
| is-disetujui | src/styles/modules/guard-attendance.css |
| is-on | src/styles/modules/guard-attendance.css |
| is-broken | src/styles/modules/inventory.css |
| is-create | src/styles/modules/inventory.css |
| is-inactive | src/styles/modules/inventory.css |
| is-lost | src/styles/modules/inventory.css |
| is-low_stock | src/styles/modules/inventory.css |
| studio-select-menu | src/styles/modules/inventory.css |
| is-failed | src/styles/modules/notifications.css |
| is-ok | src/styles/modules/notifications.css |
| is-sent | src/styles/modules/notifications.css |
| is-posted | src/styles/modules/operator-fee.css |
| is-ready | src/styles/modules/operator-fee.css |
| is-review | src/styles/modules/operator-fee.css |
| accordion-hint | src/styles/modules/primitives-override.css |
| bg- | src/styles/modules/primitives-override.css |
| bg-amber-500 | src/styles/modules/primitives-override.css |
| border- | src/styles/modules/primitives-override.css |
| border-amber-500 | src/styles/modules/primitives-override.css |
| customer-contact-card | src/styles/modules/primitives-override.css |
| customer-list | src/styles/modules/primitives-override.css |

## Recommended Fix Order

1. Fix P0 missing CSS coverage first, especially guard-shift-*.
2. Restore broken mobile layout before refactor.
3. Remove inline styles only after visual baseline is stable.
4. Extract primitives after broken pages are readable.
5. Delete dead CSS only after manual verification because dynamic classes may not be detected by regex.

## Manual Screenshot Checklist

- /guard/attendance mobile
- /admin/dashboard mobile
- /admin/bookkeeping mobile
- /admin/operator-fee mobile
- /admin/notifications mobile
- /client/portal mobile
- /login mobile
