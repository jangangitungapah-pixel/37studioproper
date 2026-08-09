import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

function read(file) {
  return readFileSync(
    resolve(
      file,
    ),
    'utf8',
  );
}

const pageSource =
  read(
    'src/pages/admin/AllBookingsPage.jsx',
  );

for (
  const required
  of [
    'data-all-bookings-ui="ui-4-spatial"',
    'StudioSelect',
    'PaginationControls',
    'BookingDetailDrawer',
    'all-bookings-editorial-header',
    'all-bookings-metric-strip',
    'all-bookings-command-shelf',
    'all-bookings-data-surface',
    'all-bookings-data-head',
    'all-bookings-table-wrap',
    'all-bookings-mobile-rows',
    'all-bookings-mobile-row',
    'all-bookings-loading',
    'all-bookings-state',
    'getBookingRequestStatus',
    'getBookingPaymentStatus',
    'getBookingSessionStatus',
    'isBookingRequestActionable',
    'isBookingPaymentOpen',
    'subscribeManualBookings(',
    'getPaginationSlice',
  ]
) {
  assert.equal(
    pageSource.includes(
      required,
    ),
    true,
    'UI-4 All Bookings missing: ' +
      required,
  );
}

/**
 * Global read-only semantics.
 */
assert.equal(
  pageSource.includes(
    'startDate:'
  ),
  false,
  'All Bookings must remain a global index.',
);

assert.equal(
  pageSource.includes(
    'endDate:'
  ),
  false,
  'All Bookings must remain a global index.',
);

for (
  const forbidden
  of [
    'bookingCommunicationRepository',
    '.createManualBooking(',
    '.updateManualBooking(',
    '.deleteManualBooking(',
    'writeBatch',
    'runTransaction',
    'addDoc(',
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    'onRequestStatusChange=',
    'onEdit=',
  ]
) {
  assert.equal(
    pageSource.includes(
      forbidden,
    ),
    false,
    'UI-4 must remain read-only: ' +
      forbidden,
  );
}

/**
 * Native select presentation is replaced by existing StudioSelect.
 */
assert.equal(
  pageSource.includes(
    '<select'
  ),
  false,
  'UI-4 filter shelf must use the existing custom StudioSelect behavior.',
);

for (
  const control
  of [
    'REQUEST_SELECT_OPTIONS',
    'PAYMENT_SELECT_OPTIONS',
    'SESSION_SELECT_OPTIONS',
    'selectedKey={requestFilter}',
    'selectedKey={paymentFilter}',
    'selectedKey={sessionFilter}',
    'changeRequestFilter',
    'changePaymentFilter',
    'changeSessionFilter',
  ]
) {
  assert.equal(
    pageSource.includes(
      control,
    ),
    true,
    'UI-4 filter invariant missing: ' +
      control,
  );
}

/**
 * Old visual composition must be gone.
 */
for (
  const deprecated
  of [
    'all-bookings-hero',
    'all-bookings-stats',
    'all-bookings-toolbar',
    'all-bookings-result-bar',
    'all-bookings-table-shell',
    'all-bookings-mobile-list',
    'all-bookings-card',
  ]
) {
  assert.equal(
    pageSource.includes(
      deprecated,
    ),
    false,
    'Deprecated All Bookings composition remains: ' +
      deprecated,
  );
}

/**
 * CSS.
 */
const cssSource =
  read(
    'src/styles/modules/all-bookings.css',
  );

for (
  const required
  of [
    'UI-4 — Spatial All Bookings Workspace',
    '.all-bookings-editorial-header',
    '.all-bookings-metric-strip',
    '.all-bookings-command-shelf',
    '.all-bookings-filter-select',
    '.all-bookings-data-surface',
    '.all-bookings-data-head',
    '.all-bookings-table-wrap',
    '.all-bookings-mobile-rows',
    '.all-bookings-mobile-row',
    '.all-bookings-status',
    '.all-bookings-loading',
    '.all-bookings-state',
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
    '@media (min-width: 768px)',
    '@media (max-width: 520px)',
    '@media (max-width: 359px)',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-4 CSS missing: ' +
      required,
  );
}

assert.equal(
  cssSource.includes(
    '--auth-'
  ),
  false,
  'UI-4 must consume Spatial semantic tokens.',
);

const rawHex =
  cssSource.match(
    /#[0-9a-fA-F]{3,8}\b/g,
  ) ||
  [];

assert.equal(
  rawHex.length,
  0,
  'UI-4 CSS must not contain raw hex colors.',
);

for (
  const deprecated
  of [
    '.all-bookings-hero',
    '.all-bookings-stats',
    '.all-bookings-toolbar',
    '.all-bookings-table-shell',
    '.all-bookings-mobile-list',
    '.all-bookings-card',
  ]
) {
  assert.equal(
    cssSource.includes(
      deprecated,
    ),
    false,
    'Deprecated UI-4 CSS remains: ' +
      deprecated,
  );
}

/**
 * Existing Phase 3D business contract remains permanent.
 */
const existingContract =
  read(
    'scripts/all-bookings-command-center-contract-test.mjs',
  );

for (
  const invariant
  of [
    'All Bookings must use the existing booking repository.',
    'All Bookings must be global, not date-range scoped.',
    'All Bookings must not become another request mutation owner.',
    'Phase 3D All Bookings drawer remains read-only.',
  ]
) {
  assert.equal(
    existingContract.includes(
      invariant,
    ),
    true,
    'Existing All Bookings contract invariant missing: ' +
      invariant,
  );
}

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

for (
  const contract
  of [
    'all-bookings-command-center-contract-test.mjs',
    'admin-spatial-all-bookings-contract-test.mjs',
  ]
) {
  assert.equal(
    packageJson
      .scripts
      .test
      .includes(
        contract,
      ),
    true,
    'Required All Bookings contract not registered: ' +
      contract,
  );
}

for (
  const forbiddenDependency
  of [
    '@mui/material',
    'antd',
    'bootstrap',
    '@chakra-ui/react',
    '@mantine/core',
  ]
) {
  assert.equal(
    Boolean(
      packageJson
        .dependencies[
          forbiddenDependency
        ],
    ),
    false,
    'UI-4 must not introduce generic visual framework: ' +
      forbiddenDependency,
  );
}

process.stdout.write(
  '✅ Admin Spatial All Bookings UI-4 contract passed.\n',
);
