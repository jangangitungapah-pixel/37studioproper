import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

function assertImports(path, imports) {
  const source = read(path);

  for (const cssImport of imports) {
    assert.equal(
      source.includes(`import '${cssImport}';`) || source.includes(`@import '${cssImport}';`),
      true,
      `${path} must own ${cssImport}.`,
    );
  }
}

assert.equal(
  existsSync(resolve('src/styles/admin-auth.css')),
  false,
  'The global admin-auth feature aggregator must not be restored.',
);

const routeCoreFiles = [
  'src/styles/routes/admin.css',
  'src/styles/routes/auth.css',
  'src/styles/routes/client.css',
  'src/styles/routes/guard.css',
  'src/styles/routes/public.css',
];

const adminFeatureModules = [
  'all-bookings',
  'billing',
  'booking-requests',
  'booking',
  'bookkeeping',
  'customer',
  'dashboard',
  'gallery',
  'inventory',
  'notifications',
  'operator-fee',
  'schedule',
  'settings',
];

for (const routeCoreFile of routeCoreFiles) {
  const source = read(routeCoreFile);

  for (const feature of adminFeatureModules) {
    assert.equal(
      source.includes(`/modules/${feature}.css`),
      false,
      `${routeCoreFile} must not eagerly load ${feature}.css.`,
    );
  }
}

assertImports('src/pages/AdminPage.jsx', ['../styles/routes/admin.css']);
assertImports('src/pages/LoginPage.jsx', ['../styles/routes/auth.css', '../styles/firebase-auth.css']);
assertImports('src/pages/ClientLoginPage.jsx', [
  '../styles/routes/auth.css',
  '../styles/firebase-auth.css',
  '../styles/client-auth.css',
]);
assertImports('src/pages/PwaLaunchPage.jsx', ['../styles/routes/auth.css']);
assertImports('src/pages/PublicBookingPage.jsx', [
  '../styles/routes/public.css',
  '../styles/public-booking.css',
]);
assertImports('src/pages/ClientLandingPage.jsx', [
  '../styles/routes/client.css',
  '../styles/client-landing.css',
]);
assertImports('src/pages/ClientPortalPage.jsx', [
  '../styles/routes/client.css',
  '../styles/client-portal.css',
  '../styles/modules/client-portal-overhaul.css',
]);
assertImports('src/pages/guard/GuardAttendancePage.jsx', ['../../styles/routes/guard.css']);

const adminPageStyles = new Map([
  ['src/pages/admin/AllBookingsPage.jsx', ['../../styles/modules/all-bookings.css']],
  ['src/pages/admin/BillingPage.jsx', ['../../styles/modules/billing.css']],
  ['src/pages/admin/BookingRequestsPage.jsx', ['../../styles/modules/booking-requests.css']],
  ['src/pages/admin/BookkeepingPage.jsx', ['../../styles/modules/bookkeeping.css']],
  ['src/pages/admin/CustomerPage.jsx', ['../../styles/modules/customer.css']],
  ['src/pages/admin/DashboardPage.jsx', ['../../styles/modules/dashboard.css']],
  ['src/pages/admin/GalleryPage.jsx', ['../../styles/modules/gallery.css']],
  ['src/pages/admin/GuardAttendancePage.jsx', ['../../styles/modules/guard-attendance.css']],
  ['src/pages/admin/InventoryPage.jsx', ['../../styles/modules/inventory.css']],
  ['src/pages/admin/NotificationsPage.jsx', ['../../styles/modules/notifications.css']],
  ['src/pages/admin/OperatorFeePage.jsx', ['../../styles/modules/operator-fee.css']],
  ['src/pages/admin/SchedulePage.jsx', ['../../styles/modules/schedule.css']],
  ['src/pages/admin/SettingsPage.jsx', [
    '../../styles/modules/settings.css',
    '../../styles/modules/operator-fee.css',
  ]],
]);

for (const [page, imports] of adminPageStyles) {
  assertImports(page, imports);
}

assertImports('src/components/schedule/BookingFormModal.jsx', ['../../styles/modules/booking.css']);
assertImports('src/components/booking/BookingConversationPanel.jsx', ['../../styles/modules/booking.css']);
assertImports('src/components/booking/BookingDetailDrawer.jsx', ['../../styles/modules/booking-detail-drawer.css']);
assertImports('src/components/guard/GuardAttendanceApprovalModal.jsx', ['../../styles/modules/guard-attendance.css']);

console.log('css-route-ownership-contract-test: PASS');
