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

const pageSource =
  read(
    'src/pages/admin/BookingRequestsPage.jsx',
  );

for (
  const required
  of [
    'data-request-inbox-ui="ui-2-spatial"',
    'isBookingRequestActionable',
    'getBookingRequestStatus',
    'getLegacyBookingPaymentStatus',
    'subscribeManualBookings',
    'updateBookingRequestStatus',
    'BookingDetailDrawer',
    "'messages'",
    'booking-requests-editorial-header',
    'booking-request-live-summary',
    'booking-request-overview-strip',
    'booking-request-command-shelf',
    'booking-request-queue',
    'booking-request-queue-row',
    'booking-request-priority-rail',
    'booking-request-row-open',
    'booking-request-row-meta',
    'booking-request-payment',
    'booking-request-row-actions',
    'booking-request-loading',
    'booking-request-state',
  ]
) {
  assert.equal(
    pageSource.includes(
      required,
    ),
    true,
    'UI-2 Request Inbox missing: ' +
      required,
  );
}

/**
 * Canonical request lifecycle must stay untouched.
 */
assert.match(
  pageSource,
  /\.filter\(\s*isBookingRequestActionable\s*,?\s*\)/,
  'UI-2 must continue using canonical actionable request selection.',
);

assert.match(
  pageSource,
  /\.updateBookingRequestStatus\(\s*\{/,
  'UI-2 must reuse the existing communication write path.',
);

for (
  const status
  of [
    "'submitted'",
    "'cancellation_requested'",
    "'confirmed'",
    "'rejected'",
    "'cancelled'",
  ]
) {
  assert.equal(
    pageSource.includes(
      status,
    ),
    true,
    'Request lifecycle status missing: ' +
      status,
  );
}

assert.equal(
  pageSource.includes(
    'startDate:'
  ),
  false,
  'Request Inbox must remain global and must not gain a calendar start date.',
);

assert.equal(
  pageSource.includes(
    'endDate:'
  ),
  false,
  'Request Inbox must remain global and must not gain a calendar end date.',
);

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
    pageSource.includes(
      forbiddenWrite,
    ),
    false,
    'UI-2 must not introduce direct Firestore persistence: ' +
      forbiddenWrite,
  );
}

/**
 * Old card-dashboard visual composition must be gone.
 */
for (
  const deprecated
  of [
    'booking-requests-hero',
    'booking-request-stats',
    'booking-request-toolbar',
    'booking-request-card-open',
    'booking-request-card-details',
    'booking-request-card-actions',
  ]
) {
  assert.equal(
    pageSource.includes(
      deprecated,
    ),
    false,
    'UI-2 must remove old Request Inbox composition: ' +
      deprecated,
  );
}

const cssSource =
  read(
    'src/styles/modules/booking-requests.css',
  );

for (
  const required
  of [
    'UI-2 — Spatial Booking Request Decision Queue',
    '.booking-requests-editorial-header',
    '.booking-request-live-summary',
    '.booking-request-overview-strip',
    '.booking-request-command-shelf',
    '.booking-request-queue',
    '.booking-request-queue-row',
    '.booking-request-priority-rail',
    '.booking-request-row-open',
    '.booking-request-row-meta',
    '.booking-request-row-actions',
    '--studio-surface-1',
    '--studio-surface-2',
    '--studio-surface-floating',
    '--studio-text-primary',
    '--studio-text-tertiary',
    '--studio-edge-soft',
    '--studio-accent',
    '--studio-success',
    '--studio-warning',
    '--studio-danger',
    '--studio-info',
    '@media (max-width: 640px)',
    '@media (max-width: 430px)',
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
    'UI-2 CSS missing: ' +
      required,
  );
}

/**
 * UI-2.1 payment tone CSS integrity regression.
 *
 * Build-level regression guard for the payment status tones.
 * The warning block was previously corrupted by a malformed
 * generator output that left raw CSS fragments between selectors.
 */
assert.match(
  cssSource,
  /\\.booking-request-payment\\.is-warning\\s*\\{[\\s\\S]*?background:\\s*color-mix\\([\\s\\S]*?var\\(\\s*--studio-warning\\s*\\)[\\s\\S]*?10%,[\\s\\S]*?var\\(\\s*--studio-surface-1\\s*\\)[\\s\\S]*?\\);[\\s\\S]*?color:\\s*var\\(\\s*--studio-warning\\s*\\);[\\s\\S]*?\\}/,
  'Warning payment tone must remain a complete valid color-mix block.',
);

assert.equal(
  cssSource.includes(
    '.booking    color-mix('
  ),
  false,
  'Malformed booking/color-mix selector fragment must never return.',
);

assert.equal(
  /background:\\s*--studio-success\\s*\\);/.test(
    cssSource,
  ),
  false,
  'Malformed raw --studio-success background fragment must never return.',
);

assert.equal(
  cssSource.includes(
    '--auth-'
  ),
  false,
  'UI-2 must consume spatial semantic tokens rather than legacy auth tokens.',
);

assert.equal(
  /#[0-9a-fA-F]{3,8}\b/.test(
    cssSource,
  ),
  false,
  'UI-2 CSS must not introduce raw hex colors.',
);

for (
  const deprecated
  of [
    '.booking-requests-hero',
    '.booking-request-stats',
    '.booking-request-toolbar',
    '.booking-request-card',
    '.booking-request-card-details',
    '.booking-request-card-actions',
  ]
) {
  assert.equal(
    cssSource.includes(
      deprecated,
    ),
    false,
    'Deprecated Request Inbox CSS remains: ' +
      deprecated,
  );
}

/**
 * Existing shared drawer must remain shared.
 */
const drawerSource =
  read(
    'src/components/booking/BookingDetailDrawer.jsx',
  );

for (
  const invariant
  of [
    'getBookingRequestStatus(',
    'BookingConversationPanel',
    '{onEdit ? (',
  ]
) {
  assert.equal(
    drawerSource.includes(
      invariant,
    ),
    true,
    'Shared BookingDetailDrawer invariant missing: ' +
      invariant,
  );
}

/**
 * Legacy Request Inbox contract must remain registered and hardened.
 */
const legacyContract =
  read(
    'scripts/booking-request-inbox-contract-test.mjs',
  );

assert.match(
  legacyContract,
  /requestPageSource,\s*\/\\\.filter/,
  'Legacy Request Inbox contract must use a formatting-agnostic selector assertion.',
);

assert.equal(
  legacyContract.includes(
    "'.filter(\\\\n            isBookingRequestActionable,'"
  ),
  false,
  'Legacy brittle exact-whitespace selector assertion must be removed.',
);

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

for (
  const contract
  of [
    'booking-request-inbox-contract-test.mjs',
    'admin-spatial-dashboard-contract-test.mjs',
    'admin-spatial-request-inbox-contract-test.mjs',
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
    'Required contract is not registered: ' +
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
    'UI-2 must not introduce generic visual framework: ' +
      forbiddenDependency,
  );
}

process.stdout.write(
  '✅ Admin Spatial Request Inbox UI-2 contract passed.\\n',
);
