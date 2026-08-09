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
 * UI-2.1 payment tone CSS integrity regression — string-safe.
 *
 * Validate the warning payment tone without complex regular
 * expressions. This keeps the contract syntax-safe while still
 * protecting the exact CSS region that previously became corrupt.
 */
const warningPaymentStart =
  cssSource.indexOf(
    '.booking-request-payment.is-warning {',
  );

const dangerPaymentStart =
  cssSource.indexOf(
    '.booking-request-payment.is-danger {',
    warningPaymentStart,
  );

assert.notEqual(
  warningPaymentStart,
  -1,
  'Warning payment tone selector must exist.',
);

assert.notEqual(
  dangerPaymentStart,
  -1,
  'Danger payment tone selector must follow warning tone.',
);

assert.equal(
  dangerPaymentStart >
    warningPaymentStart,
  true,
  'Warning payment tone region must end before danger tone.',
);

const warningPaymentCss =
  cssSource.slice(
    warningPaymentStart,
    dangerPaymentStart,
  );

for (
  const required
  of [
    '.booking-request-payment.is-warning {',
    'background:',
    'color-mix(',
    '--studio-warning',
    '--studio-surface-1',
    'color:',
  ]
) {
  assert.equal(
    warningPaymentCss.includes(
      required,
    ),
    true,
    'Warning payment tone missing CSS fragment: ' +
      required,
  );
}

assert.equal(
  warningPaymentCss
    .split(
      '--studio-warning',
    )
    .length -
    1,
  2,
  'Warning payment tone must use --studio-warning for background mix and text color.',
);

assert.equal(
  warningPaymentCss.includes(
    '--studio-success'
  ),
  false,
  'Warning payment tone must not contain the success token.',
);

assert.equal(
  warningPaymentCss.includes(
    '.booking    color-mix('
  ),
  false,
  'Malformed booking/color-mix fragment must never return.',
);

assert.equal(
  warningPaymentCss
    .split(
      '{',
    )
    .length -
    1,
  1,
  'Warning payment tone must contain exactly one opening block brace.',
);

assert.equal(
  warningPaymentCss
    .split(
      '}',
    )
    .length -
    1,
  1,
  'Warning payment tone must contain exactly one closing block brace.',
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
