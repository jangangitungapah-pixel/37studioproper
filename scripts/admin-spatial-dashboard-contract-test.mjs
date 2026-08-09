import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

function read(path) {
  return readFileSync(
    resolve(
      path,
    ),
    'utf8',
  );
}

const dashboardSource =
  read(
    'src/pages/admin/DashboardPage.jsx',
  );

for (
  const required
  of [
    'data-dashboard-ui="ui-1-spatial"',
    'isBookingRequestActionable',
    'getBookingRequestStatus',
    'isBookingCancelled',
    'getLegacyBookingPaymentStatus',
    'ADMIN_NAV_ITEMS',
    'subscribeManualBookings',
    'subscribeManualCustomers',
    'subscribeBookkeepingEntries',
    'subscribeInventoryItems',
    'syncClientCalendarSlotsFromBookings',
    'dashboard-editorial-header',
    'dashboard-attention-hub',
    'dashboard-action-queue',
    'dashboard-today-surface',
    'dashboard-timeline',
    'dashboard-metric-strip',
    'dashboard-secondary-grid',
    'dashboard-health-surface',
    'dashboard-loading',
    'dashboard-empty-state',
    'dashboard-error-state',
    'StatusPill',
    'StudioSelect',
  ]
) {
  assert.equal(
    dashboardSource.includes(
      required,
    ),
    true,
    'UI-1 Dashboard missing: ' +
      required,
  );
}

/**
 * Old equal-card dashboard composition must not remain.
 */
for (
  const deprecated
  of [
    'function DashboardMetricCard',
    'dashboard-hero',
    'dashboard-metric-grid',
    'dashboard-bottom-grid',
    'dashboard-mini-card',
  ]
) {
  assert.equal(
    dashboardSource.includes(
      deprecated,
    ),
    false,
    'UI-1 must remove old dashboard composition: ' +
      deprecated,
  );
}

/**
 * UI-1 may consume repositories but must not add direct Firestore writes.
 * Existing calendar-slot sync behavior is intentionally preserved above.
 */
for (
  const forbiddenWrite
  of [
    'addDoc(',
    'setDoc(',
    'updateDoc(',
    'deleteDoc(',
    'writeBatch(',
    'runTransaction(',
  ]
) {
  assert.equal(
    dashboardSource.includes(
      forbiddenWrite,
    ),
    false,
    'Dashboard must not introduce direct persistence primitive: ' +
      forbiddenWrite,
  );
}

assert.match(
  dashboardSource,
  /bookings\.filter\(\s*isBookingRequestActionable\s*,?\s*\)/,
  'Request attention must use the canonical actionable-request selector.',
);

assert.match(
  dashboardSource,
  /!isBookingCancelled\(\s*booking\s*,?\s*\)/,
  'Today timeline must exclude canonically cancelled bookings.',
);

assert.match(
  dashboardSource,
  /\[\s*'submitted',\s*'rejected',\s*'cancelled',\s*\]\.includes\(\s*requestStatus\s*,?\s*\)/,
  'Dashboard schedule filtering must preserve existing unscheduled client-request semantics.',
);

const cssSource =
  read(
    'src/styles/modules/dashboard.css',
  );

for (
  const required
  of [
    'UI-1 — Spatial Operational Dashboard',
    '.dashboard-editorial-header',
    '.dashboard-attention-hub',
    '.dashboard-action-queue',
    '.dashboard-today-surface',
    '.dashboard-timeline',
    '.dashboard-metric-strip',
    '.dashboard-secondary-grid',
    '.dashboard-health-surface',
    '--studio-surface-1',
    '--studio-surface-2',
    '--studio-text-primary',
    '--studio-text-tertiary',
    '--studio-edge-soft',
    '--studio-shadow-surface',
    '--studio-accent',
    '--studio-success',
    '--studio-warning',
    '--studio-danger',
    '--studio-info',
    '@media (min-width: 768px)',
    '@media (min-width: 1120px)',
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
    'UI-1 Dashboard CSS missing: ' +
      required,
  );
}

assert.equal(
  cssSource.includes(
    '--auth-'
  ),
  false,
  'UI-1 Dashboard must consume the spatial semantic token family, not old auth tokens.',
);

assert.equal(
  /#[0-9a-fA-F]{3,8}\b/.test(
    cssSource,
  ),
  false,
  'UI-1 Dashboard CSS must not introduce raw hex colors.',
);

for (
  const deprecated
  of [
    '.dashboard-hero',
    '.dashboard-metric-card',
    '.dashboard-bottom-grid',
    '.dashboard-mini-card',
  ]
) {
  assert.equal(
    cssSource.includes(
      deprecated,
    ),
    false,
    'Old card CSS must be removed: ' +
      deprecated,
  );
}

const adminCssSource =
  read(
    'src/styles/admin-auth.css',
  );

assert.equal(
  adminCssSource.includes(
    "@import './modules/dashboard.css';",
  ),
  true,
  'Dashboard stylesheet must remain registered in the admin CSS aggregator.',
);

const selectorSource =
  read(
    'src/domain/booking/bookingSelectors.js',
  );

for (
  const invariant
  of [
    'export function isBookingRequestActionable',
    'export function getBookingRequestStatus',
    'export function isBookingCancelled',
  ]
) {
  assert.equal(
    selectorSource.includes(
      invariant,
    ),
    true,
    'Canonical selector invariant missing: ' +
      invariant,
  );
}

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

assert.equal(
  packageJson
    .scripts
    .test
    .includes(
      'admin-spatial-shell-hardening-contract-test.mjs',
    ),
  true,
  'UI-0 final shell contract must remain registered.',
);

assert.equal(
  packageJson
    .scripts
    .test
    .includes(
      'admin-spatial-dashboard-contract-test.mjs',
    ),
  true,
  'UI-1 Dashboard contract must be registered.',
);

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
    'UI-1 must not introduce a generic visual framework: ' +
      forbiddenDependency,
  );
}

process.stdout.write(
  '✅ Admin Spatial Dashboard UI-1 contract passed.\n',
);
