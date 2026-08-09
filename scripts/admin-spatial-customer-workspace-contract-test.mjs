import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(file) {
  return readFileSync(resolve(file), 'utf8');
}

const pageSource = read('src/pages/admin/CustomerPage.jsx');
const cssSource = read('src/styles/modules/customer.css');
const customerRepositorySource = read(
  'src/services/adminCustomerRepository.js'
);
const bookingRepositorySource = read(
  'src/services/adminBookingRepository.js'
);
const packageJson = JSON.parse(read('package.json'));

for (const required of [
  'data-customer-ui="ui-5-spatial"',
  'data-customer-detail-ui="ui-5-spatial"',
  'data-customer-modal-ui="ui-5-spatial"',
  "import { Dialog } from 'radix-ui';",
  '<Dialog.Root',
  '<Dialog.Portal>',
  '<Dialog.Overlay',
  '<Dialog.Content',
  'CustomerWorkspaceLoading',
  'CustomerToast',
  'customer-editorial-header',
  'customer-overview',
  'customer-command-shelf',
  'customer-followup-surface',
  'customer-directory-surface',
  'StudioSelect',
  'StudioTextField',
  'PaginationControls',
  'adminCustomerRepository.subscribeManualCustomers(',
  'adminBookingRepository.subscribeManualBookings(',
  'migrateLocalCustomersToFirestore(local)',
  "navigate('/admin/customers/'",
  'getPaginationSlice',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'UI-5 Customer workspace missing: ' + required
  );
}

for (const writeInvariant of [
  'adminCustomerRepository.createManualCustomer(nextCustomer)',
  'adminCustomerRepository.updateManualCustomer(nextCustomer)',
  'customerId: targetCustomer.id',
  'customerPhoneKey: targetCustomer.phoneKey',
  'await adminCustomerRepository.deleteManualCustomer(sourceCustomer.id);',
]) {
  assert.equal(
    pageSource.includes(writeInvariant),
    true,
    'UI-5 customer write invariant missing: ' + writeInvariant
  );
}

const bookingRepointIndex = pageSource.indexOf('await Promise.all(');
const duplicateDeleteIndex = pageSource.indexOf(
  'await adminCustomerRepository.deleteManualCustomer(sourceCustomer.id);'
);

assert.equal(
  bookingRepointIndex >= 0 &&
    duplicateDeleteIndex > bookingRepointIndex,
  true,
  'Duplicate merge must repoint booking records before deleting the duplicate customer.'
);

for (const removedDebt of [
  'document.body.style.overflow',
  "document.addEventListener('keydown'",
  'handleBackdropClick',
  'style={{',
  'role="dialog"',
  'customer-hero-strip',
  'customer-toolbar-compact',
  'customer-table-shell',
  'customer-list-row-compact',
  'customer-followup-center',
  'customer-modal-backdrop',
]) {
  assert.equal(
    pageSource.includes(removedDebt),
    false,
    'Legacy customer presentation debt remains: ' + removedDebt
  );
}

assert.equal(
  pageSource.includes('<select'),
  false,
  'UI-5 must keep the existing StudioSelect behavior layer.'
);

for (const required of [
  'UI-5 — Spatial Customer Relationship Workspace',
  '.customer-editorial-header',
  '.customer-overview',
  '.customer-command-shelf',
  '.customer-search-command',
  '.customer-followup-surface',
  '.customer-followup-queue',
  '.customer-directory-surface',
  '.customer-directory-row',
  '.customer-detail-info-grid',
  '.customer-activity-card',
  '.customer-loading-surface',
  '.customer-dialog-overlay',
  '.customer-dialog-content',
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-surface-floating',
  '--studio-text-primary',
  '--studio-text-secondary',
  '--studio-text-tertiary',
  '--studio-edge-soft',
  '--studio-edge-normal',
  '--studio-accent',
  '--studio-success',
  '--studio-warning',
  '--studio-danger',
  '--studio-info',
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
  '@media (max-width: 359px)',
  '@media (forced-colors: active)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.equal(
    cssSource.includes(required),
    true,
    'UI-5 CSS missing: ' + required
  );
}

assert.equal(
  cssSource.includes('--auth-'),
  false,
  'UI-5 customer CSS must consume spatial semantic tokens.'
);

assert.equal(
  (cssSource.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length,
  0,
  'UI-5 customer CSS must not contain raw hex colors.'
);

for (const deprecatedCss of [
  '.customer-hero-strip',
  '.customer-toolbar-compact',
  '.customer-table-shell',
  '.customer-list-row-compact',
  '.customer-followup-center',
  '.customer-modal-backdrop',
]) {
  assert.equal(
    cssSource.includes(deprecatedCss),
    false,
    'Deprecated UI-5 CSS remains: ' + deprecatedCss
  );
}

for (const repositoryInvariant of [
  'subscribeManualCustomers',
  'createManualCustomer',
  'updateManualCustomer',
  'deleteManualCustomer',
  'findCustomerByPhone',
  'migrateLocalCustomersToFirestore',
]) {
  assert.equal(
    customerRepositorySource.includes(repositoryInvariant),
    true,
    'Customer repository invariant missing: ' + repositoryInvariant
  );
}

for (const bookingInvariant of [
  'subscribeManualBookings',
  'updateManualBooking',
  "collection(firestoreDb, 'bookings')",
]) {
  assert.equal(
    bookingRepositorySource.includes(bookingInvariant),
    true,
    'Booking repository invariant missing: ' + bookingInvariant
  );
}

assert.equal(
  packageJson.scripts.test.includes(
    'admin-spatial-customer-workspace-contract-test.mjs'
  ),
  true,
  'UI-5 contract must be registered in npm test.'
);

for (const forbiddenDependency of [
  '@mui/material',
  'antd',
  'bootstrap',
  '@chakra-ui/react',
  '@mantine/core',
]) {
  assert.equal(
    Boolean(packageJson.dependencies[forbiddenDependency]),
    false,
    'UI-5 must not introduce generic visual framework: ' +
      forbiddenDependency
  );
}

process.stdout.write(
  '✅ Admin Spatial Customer UI-5 contract passed.\n'
);
