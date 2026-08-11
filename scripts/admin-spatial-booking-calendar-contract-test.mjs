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

const scheduleSource =
  read(
    'src/pages/admin/SchedulePage.jsx',
  );

for (
  const required
  of [
    'data-schedule-ui="ui-3-spatial"',
    'schedule-editorial-header',
    'schedule-command-shelf',
    'schedule-view-switcher',
    'schedule-status-row',
    'schedule-mobile-date-strip',
    'schedule-calendar-surface',
    'schedule-upcoming-panel',
    'schedule-booking-request-flag',
    'schedule-loading',
    'CalendarGrid',
    'CalendarBookingBlock',
    'ScheduleUpcomingTable',
    'BookingFormModal',
    'BookingDetailDrawer',
    'REQUEST_INBOX_PATH',
    'isUnscheduledClientRequest',
    'getBookingConflictIssue',
    'getBookingOperatorFeeVisibility',
    'subscribeOperatorFeeEntries',
    'subscribeManualBookings',
    'createManualBooking',
    'updateManualBooking',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      required,
    ),
    true,
    'UI-3 Calendar missing: ' +
      required,
  );
}

/**
 * Month view must expose a dedicated vertical scroll viewport.
 */
assert.equal(
  scheduleSource.includes(
    "(viewMode === 'month' ? 'is-month-scroll' : '')"
  ),
  true,
  'Month Calendar must opt into the vertical scroll viewport.',
);

assert.equal(
  scheduleSource.includes(
    "style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}"
  ),
  false,
  'Calendar must not suppress scrollbar visibility through inline style.',
);

/**
 * Presentation debt from previous Calendar implementation must be gone.
 */
for (
  const deprecated
  of [
    '<style>{',
    'bg-[#0b0c0e]/80',
    'bg-[#ff8a2a]',
    'text-white/70',
    'backdrop-blur-md',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      deprecated,
    ),
    false,
    'UI-3 must remove old inline/Tailwind Calendar styling: ' +
      deprecated,
  );
}

assert.equal(
  /#[0-9a-fA-F]{3,8}\b/.test(
    scheduleSource,
  ),
  false,
  'SchedulePage JSX must not introduce raw hex visual values.',
);

/**
 * Request lifecycle semantics remain passive on Calendar.
 */
for (
  const status
  of [
    "'submitted'",
    "'rejected'",
    "'cancelled'",
    "'cancellation_requested'",
  ]
) {
  assert.equal(
    scheduleSource.includes(
      status,
    ),
    true,
    'Calendar lifecycle invariant missing: ' +
      status,
  );
}

assert.equal(
  scheduleSource.includes(
    'onRequestStatusChange='
  ),
  false,
  'Calendar must not own request-status mutation.',
);

assert.equal(
  scheduleSource.includes(
    'bookingCommunicationRepository'
  ),
  false,
  'Calendar must not import the Request Inbox write repository.',
);

assert.equal(
  scheduleSource.includes(
    'syncClientCalendarSlotsFromBookings(data)'
  ),
  false,
  'Date-scoped Calendar subscription must not drive global slot reconciliation.',
);

/**
 * Slot/save behavior remains repository-owned.
 */
for (
  const invariant
  of [
    'getBookingConflictIssue(booking, bookings)',
    'resolveBookingCustomerIdentity(booking, bookings)',
    'adminBookingRepository.updateManualBooking(nextBooking)',
    'adminBookingRepository.createManualBooking(nextBooking)',
    'startDate: dateRange.startDate',
    'endDate: dateRange.endDate',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      invariant,
    ),
    true,
    'Calendar booking invariant missing: ' +
      invariant,
  );
}

/**
 * Operator Fee is presentation-only and permission-gated.
 */
for (
  const invariant
  of [
    "hasAdminPagePermission(",
    "'operator-fee'",
    'canViewOperatorFee',
    'getBookingOperatorFeeVisibility(',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      invariant,
    ),
    true,
    'Operator Fee visibility invariant missing: ' +
      invariant,
  );
}

/**
 * Calendar CSS owns appearance through spatial semantic tokens.
 */
const cssSource =
  read(
    'src/styles/modules/schedule.css',
  );

for (
  const required
  of [
    'UI-3 — Spatial Booking Calendar',
    '.schedule-editorial-header',
    '.schedule-command-shelf',
    '.schedule-view-switcher',
    '.schedule-status-filter',
    '.schedule-workspace',
    '.schedule-calendar-surface',
    '.schedule-mobile-date-strip',
    '.schedule-grid',
    '.schedule-grid-corner',
    '.schedule-day-head',
    '.schedule-time-cell',
    '.schedule-slot-cell',
    '.schedule-booking-block',
    '.schedule-booking-request-flag',
    '.schedule-upcoming-panel',
    '.schedule-loading',
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
    '@media (max-width: 767px)',
    '@media (min-width: 768px)',
    '@media (min-width: 1180px)',
    '@media (max-width: 390px)',
    '@media (max-width: 340px)',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-3 Calendar CSS missing: ' +
      required,
  );
}

assert.match(
  cssSource,
  /\.schedule-grid-scroll\.is-month-scroll\s*\{[\s\S]*?max-height:[\s\S]*?overflow-y:\s*auto;[\s\S]*?scrollbar-gutter:\s*stable;[\s\S]*?scrollbar-width:\s*thin;/,
  'Month Calendar vertical scroll viewport must remain bounded and scrollbar-visible.',
);

for (
  const required
  of [
    '.schedule-grid-scroll.is-month-scroll::-webkit-scrollbar',
    '.schedule-grid-scroll.is-month-scroll::-webkit-scrollbar-track',
    '.schedule-grid-scroll.is-month-scroll::-webkit-scrollbar-thumb',
    'width:\n    10px;',
    'height:\n    0;',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'Month Calendar scrollbar styling missing: ' +
      required,
  );
}

assert.match(
  cssSource,
  /\.schedule-grid-corner,[\s\S]*?\.schedule-day-head\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/,
  'Calendar day header must remain sticky during vertical month scrolling.',
);

assert.match(
  cssSource,
  /\.schedule-time-cell\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?left:\s*0;/,
  'Calendar time column must remain sticky during Calendar scrolling.',
);

assert.equal(
  cssSource.includes(
    '--auth-'
  ),
  false,
  'UI-3 Calendar CSS must not depend on legacy auth visual tokens.',
);

assert.equal(
  /#[0-9a-fA-F]{3,8}\b/.test(
    cssSource,
  ),
  false,
  'UI-3 Calendar CSS must not contain raw hex colors.',
);

/**
 * CSS must stay registered through the main admin aggregator.
 */
const adminCss =
  read(
    'src/styles/admin-auth.css',
  );

assert.equal(
  adminCss.includes(
    "@import './modules/schedule.css';"
  ),
  true,
  'Schedule CSS must remain registered in admin-auth.css.',
);

/**
 * Existing business regression contracts remain permanent.
 */
const saveContract =
  read(
    'scripts/calendar-booking-save-regression-test.mjs',
  );

assert.equal(
  saveContract.includes(
    'Calendar booking save regression contract passed.'
  ),
  true,
  'Calendar save regression contract must remain present.',
);

const requestContract =
  read(
    'scripts/calendar-v2-request-consolidation-contract-test.mjs',
  );

assert.equal(
  requestContract.includes(
    '/navigate\\(\\s*REQUEST_INBOX_PATH'
  ),
  true,
  'Calendar Request Inbox navigation assertion must be formatting-agnostic.',
);

assert.equal(
  requestContract.includes(
    "'navigate(\\n      REQUEST_INBOX_PATH,'"
  ),
  false,
  'Brittle Calendar Request Inbox whitespace assertion must be removed.',
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
    'calendar-booking-save-regression-test.mjs',
    'calendar-v2-request-consolidation-contract-test.mjs',
    'admin-spatial-booking-calendar-contract-test.mjs',
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
    'Required Calendar contract not registered: ' +
      contract,
  );
}

/**
 * UI-3 stays presentation-focused.
 */
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
    'UI-3 must not introduce generic visual framework: ' +
      forbiddenDependency,
  );
}

process.stdout.write(
  '✅ Admin Spatial Booking Calendar UI-3 contract passed.\n',
);
