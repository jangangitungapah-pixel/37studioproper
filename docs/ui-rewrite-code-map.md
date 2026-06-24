# UI Rewrite Code Map — 37 Studio Proper

Dokumen ini adalah peta kerja resmi untuk rewrite UI 37 Studio Proper.

Tujuannya adalah memastikan rewrite dilakukan di file pemilik asli, bukan melalui override tambahan.

---

## 1. Prinsip Rewrite

1. Ubah file pemilik asli, bukan menambah override baru.
2. Jangan membuat selector hack untuk mengontrol shell dari feature page.
3. Jangan memakai `!important` kecuali emergency hotfix sementara.
4. Jangan mengubah route, auth, permission, repository, Firebase collection, pricing formula, invoice identity, atau data model tanpa phase khusus.
5. Satu komponen harus punya struktur DOM yang sama untuk dark dan light mode.
6. Perbedaan dark dan light hanya melalui token warna, surface, border, shadow, dan kontras.
7. Page CSS hanya mengatur layout halaman miliknya sendiri.
8. Shared UI component harus diatur dari shared layer.
9. Shell CSS hanya mengatur shell.
10. Feature CSS tidak boleh mengatur shell global.

---

## 2. Route Map

| Route | Owner Page | Catatan |
| --- | --- | --- |
| `/` | `src/pages/ClientLandingPage.jsx` | Landing client dan entry booking/request |
| `/launch` | `src/pages/PwaLaunchPage.jsx` | Launch/PWA gate |
| `/login` | `src/pages/LoginPage.jsx` | Admin login |
| `/client/login` | `src/pages/ClientLoginPage.jsx` | Client login |
| `/client/portal` | `src/pages/ClientPortalPage.jsx` | Portal client |
| `/client` | `src/pages/ClientLandingPage.jsx` | Alias landing |
| `/guard` | redirect ke `/guard/attendance` | Guard shortcut |
| `/guard/attendance` | `src/pages/guard/GuardAttendancePage.jsx` | Portal absensi guard |
| `/admin/*` | `src/pages/AdminPage.jsx` | Portal admin |
| `*` | redirect ke `/login` | Fallback |

---

## 3. Admin Portal Map

Admin portal tidak memakai nested route per page. Admin portal menggunakan router manual dari `src/pages/AdminPage.jsx`.

```txt
src/pages/AdminPage.jsx
  ├─ src/components/admin/AdminSidebar.jsx
  ├─ src/components/admin/AdminTopbar.jsx
  ├─ src/components/admin/AdminBottomNav.jsx
  ├─ src/components/guard/GuardAttendanceApprovalModal.jsx
  └─ renderAdminContent(activeKey)
      ├─ DashboardPage
      ├─ NotificationsPage
      ├─ SchedulePage
      ├─ CustomerPage
      ├─ BillingPage
      ├─ BookkeepingPage
      ├─ OperatorFeePage
      ├─ GuardAttendancePage
      ├─ InventoryPage
      ├─ GalleryPage
      └─ SettingsPage
```

Admin navigation source of truth:

```txt
src/pages/AdminPage.jsx
  ├─ mobilePrimaryNavKeys
  └─ navItems
```

Rule rewrite:

- Boleh ubah visual shell di `admin-shell.css`.
- Boleh ubah markup shell jika phase khusus admin shell.
- Jangan ubah permission filtering tanpa phase auth/permission.
- Jangan ubah active page key.
- Jangan ubah redirect behavior.

---

## 4. Auth, Role, dan Permission Map

Auth dan permission adalah area sensitif.

```txt
src/pages/LoginPage.jsx
  └─ src/services/adminAuthRepository.js

src/pages/ClientLoginPage.jsx
  └─ src/services/accountRoleRepository.js

src/pages/AdminPage.jsx
  ├─ subscribeAdminAuth
  ├─ hasAdminPagePermission
  └─ approval / blocked / wrong portal states
```

Forbidden during UI rewrite:

- Jangan ubah `subscribeAdminAuth`.
- Jangan ubah `resolvePortalAccount`.
- Jangan ubah owner bootstrap behavior.
- Jangan ubah role owner/admin/client.
- Jangan ubah permission map.
- Jangan ubah approval modal behavior.

---

## 5. Firebase Backbone

Firebase init owner:

```txt
src/lib/firebase.js
  ├─ firebaseConfig from import.meta.env
  ├─ isFirebaseConfigured
  ├─ firebaseApp
  ├─ firebaseAuth
  └─ firestoreDb
```

| Collection | Owner Service / Page |
| --- | --- |
| `bookings` | `adminBookingRepository` |
| `clientCalendarSlots` | `adminBookingRepository` |
| `customers` | `adminCustomerRepository` |
| `bookkeepingEntries` | `bookkeepingRepository` |
| `inventoryItems` | `inventoryRepository` |
| `inventoryMovements` | `inventoryRepository` |
| `users` | `accountRoleRepository` / admin auth / settings |
| `settings` | pricing / invoice / studio settings |
| `paymentProofs` | `paymentProofRepository` |
| `bookingMessages` | `bookingCommunicationRepository` |
| `gallery` | `galleryRepository` |
| `notificationEvents` | `notificationEventRepository` |

Forbidden during UI rewrite:

- Jangan rename collection.
- Jangan ubah document shape.
- Jangan ubah migration key.
- Jangan ubah localStorage key.
- Jangan ubah batch delete danger zone.
- Jangan ubah Firestore query ordering/filter tanpa phase data.

---

## 6. Booking Data Map

Booking adalah pusat data utama.

```txt
src/services/adminBookingRepository.js
  ├─ subscribeManualBookings
  ├─ createManualBooking
  ├─ createClientBookingRequest
  ├─ updateManualBooking
  ├─ deleteManualBooking
  ├─ migrateLocalBookingsToFirestore
  ├─ subscribeClientBookingsForUser
  ├─ subscribeClientCalendarSlots
  └─ syncClientCalendarSlotsFromBookings
```

| Consumer | Tujuan |
| --- | --- |
| DashboardPage | summary booking |
| SchedulePage | calendar CRUD |
| CustomerPage | customer activity |
| BillingPage | invoice/payment |
| BookkeepingPage | income reference |
| OperatorFeePage | fee source |
| ClientPortalPage | booking user dan request |
| ClientLandingPage | request booking |
| AdminPage | sync client calendar slots |

Rewrite boundary:

- Boleh ubah visual booking card, calendar block, status pill.
- Jangan ubah booking id, booking code, invoice number, payment status, client calendar slot sync.

---

## 7. Shared Schedule Config

Konfigurasi schedule berada di `src/constants/scheduleConfig.js`.

Shim backward compatibility:

```txt
src/pages/admin/scheduleConfig.js
  └─ export * from ../../constants/scheduleConfig.js
```

Dipakai oleh:

- Admin SchedulePage
- ClientPortalPage
- ClientLandingPage

Forbidden during UI rewrite:

- Jangan ubah jam operasional.
- Jangan ubah key status.
- Jangan ubah key session.
- Jangan ubah key duration.
- Jangan hapus shim sampai semua import dimigrasi dengan aman.

---

## 8. Admin Page Dependency Map

### Dashboard

```txt
src/pages/admin/DashboardPage.jsx
  ├─ adminBookingRepository
  ├─ adminCustomerRepository
  ├─ bookkeepingRepository
  ├─ inventoryRepository
  ├─ Recharts
  └─ StudioSelect
```

### Schedule

```txt
src/pages/admin/SchedulePage.jsx
  ├─ BookingFormModal
  ├─ BookingDetailModal
  ├─ StudioSelect
  ├─ scheduleConfig
  ├─ adminBookingRepository
  ├─ adminCustomerRepository
  ├─ bookingCommunicationRepository
  └─ firebaseAuth
```

### Customer

```txt
src/pages/admin/CustomerPage.jsx
  ├─ StudioSelect
  ├─ StudioTextField
  ├─ PaginationControls
  ├─ pagination utils
  ├─ adminBookingRepository
  └─ adminCustomerRepository
```

### Billing

```txt
src/pages/admin/BillingPage.jsx
  ├─ StudioSelect
  ├─ PaginationControls
  ├─ adminBookingRepository
  ├─ paymentProofRepository
  ├─ invoiceSettings
  └─ studioSettings
```

### Bookkeeping

```txt
src/pages/admin/BookkeepingPage.jsx
  ├─ StudioSelect
  ├─ PaginationControls
  ├─ adminBookingRepository
  └─ bookkeepingRepository
```

### Inventory

```txt
src/pages/admin/InventoryPage.jsx
  ├─ StudioSelect
  ├─ PaginationControls
  └─ inventoryRepository
```

### Settings

```txt
src/pages/admin/SettingsPage.jsx
  ├─ Firestore direct imports
  ├─ ConfirmDialog
  ├─ StudioSelect
  ├─ StudioTextField
  ├─ OperatorFeeSettingsPanel
  ├─ adminAuthRepository
  ├─ accountSettings utils
  ├─ adminPermissions utils
  ├─ invoiceSettings
  ├─ studioSettings
  └─ pricingSettings
```

### Gallery

```txt
src/pages/admin/GalleryPage.jsx
  ├─ cloudinaryUploadService
  ├─ galleryRepository
  ├─ gallery components
  ├─ gallery utils
  └─ LofiAmbientSynth
```

### Notifications

```txt
src/pages/admin/NotificationsPage.jsx
  ├─ notificationEventRepository
  ├─ oneSignalService
  └─ notificationSubscriptionRepository
```

### Operator Fee

```txt
src/pages/admin/OperatorFeePage.jsx
  ├─ adminBookingRepository
  ├─ bookkeepingRepository
  ├─ guardAttendanceRepository
  ├─ operatorFeeRepository
  ├─ operatorFeeSettings
  └─ adminPermissions
```

---

## 9. Client Portal Map

```txt
src/pages/ClientPortalPage.jsx
  ├─ Firebase Auth
  ├─ adminBookingRepository
  ├─ clientProfileRepository
  ├─ accountRoleRepository
  ├─ bookingCommunicationRepository
  ├─ pricingSettings
  ├─ invoiceSettings
  ├─ studioSettings
  ├─ cloudinaryUploadService
  ├─ paymentProofRepository
  ├─ scheduleConfig
  ├─ StudioSelect
  ├─ BookingConversationPanel
  ├─ ClientDashboardTab
  ├─ ClientCalendarTab
  ├─ ClientHistoryTab
  └─ ClientBillingTab
```

Client portal CSS imports:

```txt
src/styles/admin-auth.css
src/styles/client-portal.css
```

Client landing CSS imports:

```txt
src/styles/admin-auth.css
src/styles/client-landing.css
```

---

## 10. CSS Ownership Map

| CSS File | Owner Area |
| --- | --- |
| `src/index.css` | global reset, font, root token |
| `src/styles/modules/base.css` | base admin/auth token bridge |
| `src/styles/modules/shared.css` | shared UI primitives |
| `src/styles/modules/modal.css` | shared modal primitives and confirm dialog |
| `src/styles/modules/auth.css` | admin login/auth pages |
| `src/styles/modules/admin-shell.css` | admin sidebar/topbar/bottom nav/stage |
| `src/styles/modules/schedule.css` | admin schedule page |
| `src/styles/modules/booking.css` | booking modal/detail/conversation |
| `src/styles/modules/customer.css` | admin customer page |
| `src/styles/modules/billing.css` | admin billing page |
| `src/styles/modules/settings.css` | admin settings page |
| `src/styles/modules/inventory.css` | admin inventory page |
| `src/styles/modules/bookkeeping.css` | admin bookkeeping page |
| `src/styles/modules/dashboard.css` | admin dashboard page |
| `src/styles/modules/gallery.css` | admin gallery page and gallery components |
| `src/styles/modules/operator-fee.css` | admin operator fee page |
| `src/styles/modules/notifications.css` | admin notification page |
| `src/styles/modules/guard-attendance.css` | guard attendance |
| `src/styles/firebase-auth.css` | shared Firebase auth helpers and role dialog support |
| `src/styles/client-auth.css` | client login surface |
| `src/styles/client-portal.css` | client portal tabs, calendar, billing, proof upload |
| `src/styles/client-landing.css` | client public landing and booking entry |

Rewrite rule:

- Rewrite owner file directly.
- Do not add new override file.
- Existing override files should be deleted only after their rules are migrated to owner files.

---

## 11. Shared UI Component Map

```txt
src/components/ui
  ├─ AccessState.jsx
  ├─ Button.jsx
  ├─ ConfirmDialog.jsx
  ├─ ErrorBoundary.jsx
  ├─ LoadingState.jsx
  ├─ PaginationControls.jsx
  ├─ StatusPill.jsx
  ├─ StudioSelect.jsx
  └─ StudioTextField.jsx
```

Rule:

- Button, input, select, card, badge, modal primitive harus tokenized dari shared CSS.
- Page CSS tidak boleh membuat duplicate primitive system.
- Inline styles di shared UI components harus dimigrasi ke CSS class di phase khusus.

---

## 12. Rewrite Phase Order

| Phase | Target | Goal |
| --- | --- | --- |
| 2A | `docs/ui-rewrite-code-map.md` | peta resmi rewrite UI |
| 2B | `index.css`, `base.css`, `shared.css`, `admin-shell.css` | foundation token/shell/shared |
| 3 | `dashboard.css`, `billing.css` | dashboard dan payment hierarchy |
| 4 | `customer.css`, `bookkeeping.css` | readable cards/tables |
| 5 | `inventory.css`, `operator-fee.css`, `notifications.css` | operational modules alignment |
| 6 | `schedule.css`, `booking.css` | calendar dan booking modal cleanup |
| 7 | client portal CSS | migrate override ke owner files |
| 8 | client login and auth surfaces | semantic classes dan token alignment |
| 9 | client landing | migrate polish/compact layers to owner CSS |
| 10 | settings and gallery | remaining admin surfaces owner rewrite |
| 11 | shared controls and modal primitives | split modal owner from shared primitives |
| 12 | guard attendance and final CSS sweep | final guard surface rewrite and CSS audit doc |

---

## 13. Forbidden Touch List During Visual Rewrite

- Firebase config
- Firestore collection names
- auth persistence
- role decision logic
- permission checks
- booking code generation
- invoice number generation
- payment status transitions
- payment proof upload/review
- booking request notification queue
- client calendar slot sync
- pricing formula
- invoice setting save/load
- studio setting save/load
- danger zone delete batch
- OneSignal setup
- Cloudinary upload payload
- guard attendance eligibility
- operator fee posting to bookkeeping

---

## 14. Validation Checklist Per Phase

Every phase should run:

```powershell
npm run lint
npm test
npm run build
```

Manual smoke checklist:

1. Admin login page loads.
2. Admin portal loads after login.
3. Sidebar desktop works.
4. Bottom nav mobile works.
5. Dashboard renders.
6. Schedule renders day/week/month.
7. Booking modal opens.
8. Customer page renders list/detail.
9. Billing page renders invoice/payment rows.
10. Settings page opens without permission crash.
11. Client landing loads.
12. Client login loads.
13. Client portal tabs render.
14. Guard attendance page loads.
15. No modal hidden behind bottom nav.
16. No text below readable minimum on mobile.

---

## 15. Design Direction Lock

Design direction:

```txt
37 Studio OS — warm premium operational interface
```

Rules:

- Admin is clean, readable, data-first.
- Client is more cinematic but still uses the same token system.
- Accent is warm amber/orange studio light.
- Layout uses one structure for dark and light.
- Theme differences come from token palettes.
- No new override layer.
- Rewrite owners, not patches.
