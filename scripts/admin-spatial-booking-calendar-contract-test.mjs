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

/**
 * UI-3.1 mobile gesture arbitration.
 *
 * Horizontal-dominant touch/pen drags move the Calendar grid explicitly.
 * Vertical-dominant gestures remain browser-owned so the page (or bounded
 * Month viewport) can keep scrolling from the same touch surface.
 */
for (
  const required
  of [
    'gridGestureRef',
    'gridClickReleaseTimerRef',
    'suppressGridClickRef',
    'handleGridPointerDown',
    'handleGridPointerMove',
    'finishGridPointerGesture',
    'handleGridClickCapture',
    "event.pointerType !== 'touch'",
    "event.pointerType !== 'pen'",
    "gesture.axis =\n        'horizontal'",
    "gesture.axis =\n          'vertical'",
    '.setPointerCapture?.(',
    '.releasePointerCapture(',
    "event.preventDefault();",
    "event.stopPropagation();",
    "scrollContainer.scrollLeft =",
    "'is-horizontal-dragging'",
    'onClickCapture={',
    'onPointerCancel={',
    'onPointerDown={',
    'onPointerMove={',
    'onPointerUp={',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      required,
    ),
    true,
    'UI-3.1 Calendar gesture contract missing: ' +
      required,
  );
}

assert.equal(
  scheduleSource.includes(
    'onTouchMove='
  ),
  false,
  'UI-3.1 must use Pointer Events instead of passive-sensitive touch handlers.',
);

const gridScrollCssMatch =
  cssSource.match(
    /\.schedule-grid-scroll\s*\{([\s\S]*?)\n\}/,
  );

assert.notEqual(
  gridScrollCssMatch,
  null,
  'UI-3.1 Calendar grid scroll CSS block must exist.',
);

const gridScrollCss =
  gridScrollCssMatch[1];

for (
  const required
  of [
    'overflow-x:\n    auto;',
    'overflow-y:\n    hidden;',
    'overscroll-behavior-x:\n    contain;',
    'overscroll-behavior-y:\n    auto;',
    'touch-action:\n    pan-y\n    pinch-zoom;',
    '-webkit-overflow-scrolling:\n    touch;',
  ]
) {
  assert.equal(
    gridScrollCss.includes(
      required,
    ),
    true,
    'UI-3.1 Calendar scroll CSS missing: ' +
      required,
  );
}

assert.equal(
  gridScrollCss.includes(
    'pan-x'
  ),
  false,
  'Browser horizontal panning must not compete with gesture arbitration.',
);

assert.equal(
  cssSource.includes(
    'UI-3.1 — Mobile Calendar Gesture Arbitration'
  ),
  true,
  'UI-3.1 Calendar gesture CSS marker must exist.',
);

assert.match(
  cssSource,
  /\.schedule-grid-scroll\.is-horizontal-dragging\s*\{[\s\S]*?user-select:\s*none;[\s\S]*?-webkit-user-select:\s*none;/,
  'UI-3.1 horizontal drag must suppress accidental selection.',
);

const monthScrollCssMatch =
  cssSource.match(
    /\.schedule-grid-scroll\.is-month-scroll\s*\{([\s\S]*?)\n\}/,
  );

assert.notEqual(
  monthScrollCssMatch,
  null,
  'UI-3.1 Month scroll CSS block must exist.',
);

for (
  const required
  of [
    'overscroll-behavior-x:\n    contain;',
    'overscroll-behavior-y:\n    auto;',
  ]
) {
  assert.equal(
    monthScrollCssMatch[1].includes(
      required,
    ),
    true,
    'UI-3.1 Month scroll chaining missing: ' +
      required,
  );
}

/**
 * UI-3M.1 compact, continuously scrolling planning deck.
 *
 * Mobile opens in the readable week view, keeps only the compact range context,
 * and leaves horizontal grid movement continuous instead of snapping columns.
 */
for (
  const required
  of [
    'data-schedule-mobile-ui="ui-3m-planning-deck"',
    'getInitialScheduleViewMode',
    "matchMedia?.('(max-width: 767px)')?.matches ? 'week' : 'month'",
    'getScheduleScrollBehavior',
    'schedule-mobile-date-copy',
    'schedule-mobile-gesture-hint',
    'data-calendar-day={dayIso}',
    'aria-describedby="schedule-grid-gesture-hint"',
    'tabIndex={0}',
    "(previewBookings.length ? '' : ' is-empty')",
  ]
) {
  assert.equal(
    scheduleSource.includes(
      required,
    ),
    true,
    'UI-3M Calendar source missing: ' +
      required,
  );
}

for (
  const required
  of [
    'UI-3M.1 — Compact Mobile Calendar Context',
    '.schedule-mobile-date-copy',
    '.schedule-mobile-gesture-hint',
    '.schedule-day-head.is-selected',
    '.schedule-upcoming-panel.is-empty',
    '--schedule-week-day-col:\n      116px;',
    '--schedule-time-col:\n      54px;',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-3M Calendar CSS missing: ' +
      required,
  );
}

for (
  const removedSource
  of [
    'schedule-mobile-day-rail',
    'mobileDayRailRef',
    'handleMobileDaySelect',
    'scrollGridToDay',
    'onDateSelect?.(startOfDay(day))',
    'onDateSelect={setSelectedDate}',
    'data-mobile-day={dayIso}',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      removedSource,
    ),
    false,
    'UI-3M.1 must remove redundant mobile date selector: ' +
      removedSource,
  );
}

for (
  const removedCss
  of [
    '.schedule-mobile-day-rail',
    'scroll-snap-type:',
    'scroll-snap-align:',
  ]
) {
  assert.equal(
    cssSource.includes(
      removedCss,
    ),
    false,
    'UI-3M.1 must keep horizontal Calendar movement continuous: ' +
      removedCss,
  );
}

assert.match(
  cssSource,
  /@media \(max-width: 767px\)[\s\S]*?\.schedule-editorial-header\s*\{[\s\S]*?grid-template-areas:[\s\S]*?'kicker count'[\s\S]*?'title title'[\s\S]*?'description description';/,
  'UI-3M must compact the mobile editorial header into a deliberate grid.',
);

assert.match(
  cssSource,
  /@media \(max-width: 767px\)[\s\S]*?\.schedule-command-primary\s*\{[\s\S]*?grid-template-columns:[\s\S]*?0\.82fr[\s\S]*?1\.18fr[\s\S]*?\);/,
  'UI-3M must keep mobile date navigation and view switching on one row.',
);

assert.match(
  cssSource,
  /@media \(max-width: 767px\)[\s\S]*?\.schedule-grid-corner,[\s\S]*?\.schedule-time-cell\s*\{[\s\S]*?background:[\s\S]*?--studio-surface-2[\s\S]*?box-shadow:/,
  'UI-3M sticky time objects must be opaque and separated from scrolled days.',
);

assert.match(
  cssSource,
  /@media \(min-width: 768px\)[\s\S]*?\.schedule-mobile-date-strip\s*\{[\s\S]*?display:\s*none;/,
  'UI-3M compact mobile date context must stay out of the desktop layout.',
);

/**
 * UI-3M.2 opaque sticky date headers.
 *
 * Tonal header overlays can contain alpha, so every sticky date header must
 * paint that tone over an opaque canvas before booking blocks pass behind it.
 */
for (
  const required
  of [
    'UI-3M.2 — Opaque Sticky Date Headers',
    '--schedule-day-head-overlay:',
    'background-color:\n    var(\n      --studio-canvas',
    'background-image:\n    linear-gradient(',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-3M.2 opaque date header CSS missing: ' +
      required,
  );
}

const dayHeaderOverlayAssignments =
  cssSource.match(
    /--schedule-day-head-overlay:/g,
  ) || [];

assert.equal(
  dayHeaderOverlayAssignments.length >= 5,
  true,
  'UI-3M.2 must cover default, today, dark today, mobile, and selected header states.',
);

assert.match(
  cssSource,
  /\.schedule-grid-corner,[\s\S]*?\.schedule-day-head\s*\{[\s\S]*?--schedule-day-head-overlay:[\s\S]*?background-color:[\s\S]*?--studio-canvas[\s\S]*?background-image:[\s\S]*?linear-gradient\([\s\S]*?--schedule-day-head-overlay/,
  'UI-3M.2 sticky headers must layer their tonal overlay over an opaque canvas.',
);

for (
  const transparentState
  of [
    '.schedule-day-head.is-today {\n  background:',
    '  .schedule-day-head.is-selected {\n    background:',
  ]
) {
  assert.equal(
    cssSource.includes(
      transparentState,
    ),
    false,
    'UI-3M.2 must not restore transparent header shorthand: ' +
      transparentState,
  );
}

process.stdout.write(
  '✅ Admin Spatial Booking Calendar UI-3 contract passed.\n',
);
