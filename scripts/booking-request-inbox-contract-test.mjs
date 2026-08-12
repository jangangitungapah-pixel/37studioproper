import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  ADMIN_MOBILE_PRIMARY_KEYS,
  ADMIN_NAV_ITEMS,
  findAdminNavigationItem,
  isAdminMobileItem,
  isAdminSidebarItem,
} from '../src/config/adminNavigation.js';

import {
  getBookingRequestStatus,
  isBookingRequestActionable,
} from '../src/domain/booking/bookingSelectors.js';

import {
  buildBookingDecisionKey,
  buildBookingDecisionPatch,
  doBookingDecisionWindowsOverlap,
  validateBookingDecision,
} from '../src/domain/booking/bookingDecision.js';

import {
  parseBookingListUrlState,
  updateBookingListSearch,
} from '../src/domain/booking/bookingUrlState.js';

const requestsItem =
  ADMIN_NAV_ITEMS.find(
    (item) =>
      item.key ===
      'requests',
  );

assert.ok(
  requestsItem,
  'Request Inbox navigation item must exist.',
);

assert.equal(
  requestsItem.path,
  '/admin/bookings/requests',
);

assert.equal(
  requestsItem.permissionKey,
  'schedule',
);

assert.equal(
  requestsItem.group,
  'booking',
);

assert.equal(
  requestsItem.groupLabel,
  'Booking',
);

assert.equal(
  isAdminSidebarItem(
    requestsItem,
  ),
  true,
);

assert.equal(
  isAdminMobileItem(
    requestsItem,
  ),
  true,
);

assert.deepEqual(
  ADMIN_MOBILE_PRIMARY_KEYS,
  [
    'dashboard',
    'requests',
    'schedule',
    'billing',
  ],
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings/requests',
  )?.key,
  'requests',
);

/**
 * Actionable request semantics.
 */
assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus:
      'submitted',
  }),
  true,
);

assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus:
      'cancellation_requested',
  }),
  true,
);

assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus:
      'confirmed',
  }),
  false,
);

assert.equal(
  getBookingRequestStatus({
    bookingRequestStatus:
      'submitted',
  }),
  'submitted',
);

/**
 * Decision integrity and URL restoration are behavioral contracts.
 */
const submittedRequest = {
  bookingRequestStatus: 'submitted',
  clientRequestUpdatedAt: '2026-08-12T08:00:00.000Z',
  customer: 'Nadia',
  date: '2026-08-14',
  durationHours: 2,
  id: 'request-1',
  paymentStatus: 'dp',
  sessionLabel: 'Recording',
  startHour: 10,
  status: 'dp',
};

assert.equal(
  validateBookingDecision({
    booking: submittedRequest,
    status: 'confirmed',
  }).ok,
  true,
);

assert.equal(
  validateBookingDecision({
    booking: { ...submittedRequest, customer: '' },
    status: 'confirmed',
  }).code,
  'incomplete-booking',
);

assert.equal(
  validateBookingDecision({
    booking: submittedRequest,
    currentBookings: [{
      bookingRequestStatus: 'confirmed',
      customer: 'Existing session',
      date: '2026-08-14',
      durationHours: 2,
      id: 'existing-1',
      startHour: 11,
    }],
    status: 'confirmed',
  }).code,
  'schedule-conflict',
);

assert.equal(
  validateBookingDecision({
    booking: {
      ...submittedRequest,
      durationHours: 0,
      packageId: 'package-production',
      pricingMode: 'package',
    },
    status: 'confirmed',
  }).ok,
  true,
  'A package without studio duration must not create a blocking interval.',
);

assert.equal(
  validateBookingDecision({
    booking: submittedRequest,
    currentBookings: [{
      bookingRequestStatus: 'cancelled',
      customer: 'Cancelled session',
      date: '2026-08-14',
      durationHours: 2,
      id: 'cancelled-1',
      startHour: 11,
    }],
    status: 'confirmed',
  }).ok,
  true,
  'Cancelled sessions must not block confirmation.',
);

assert.equal(
  doBookingDecisionWindowsOverlap(
    submittedRequest,
    {
      date: '2026-08-14',
      durationHours: 1,
      startHour: 12,
    },
  ),
  false,
  'Back-to-back sessions must remain valid.',
);

assert.equal(
  validateBookingDecision({
    booking: submittedRequest,
    status: 'rejected',
  }).code,
  'reason-required',
);

assert.equal(
  validateBookingDecision({
    booking: submittedRequest,
    reason: 'Jadwal tidak tersedia',
    status: 'rejected',
  }).ok,
  true,
);

const firstDecisionKey = buildBookingDecisionKey({
  booking: submittedRequest,
  status: 'confirmed',
});

assert.equal(
  firstDecisionKey,
  buildBookingDecisionKey({
    booking: { ...submittedRequest },
    status: 'confirmed',
  }),
  'The same retry must produce the same idempotency key.',
);

assert.notEqual(
  firstDecisionKey,
  buildBookingDecisionKey({
    booking: submittedRequest,
    status: 'rejected',
  }),
);

assert.notEqual(
  firstDecisionKey,
  buildBookingDecisionKey({
    booking: {
      ...submittedRequest,
      clientRequestUpdatedAt: '2026-08-12T10:00:00.000Z',
    },
    status: 'confirmed',
  }),
  'A new request version must receive a new decision key.',
);

const cancelledPatch = buildBookingDecisionPatch({
  actor: { uid: 'admin-1' },
  decisionKey: 'decision-1',
  note: 'Client meminta pembatalan',
  status: 'cancelled',
  timestamp: '2026-08-12T09:00:00.000Z',
});

assert.equal(cancelledPatch.requestStatus, 'cancelled');
assert.equal(cancelledPatch.sessionStatus, 'cancelled');
assert.equal('paymentStatus' in cancelledPatch, false);
assert.equal('status' in cancelledPatch, false);

const requestUrlConfig = {
  requestFilters: ['all', 'submitted', 'cancellation_requested'],
  requestParam: 'filter',
};
const requestUrlState = parseBookingListUrlState(
  '?q=Nadia&filter=submitted&page=3&bookingId=request-1&tab=messages',
  requestUrlConfig,
);

assert.equal(requestUrlState.query, 'Nadia');
assert.equal(requestUrlState.requestFilter, 'submitted');
assert.equal(requestUrlState.page, 3);
assert.equal(requestUrlState.bookingId, 'request-1');
assert.equal(requestUrlState.tab, 'messages');

const closedRequestSearch = updateBookingListSearch(
  '?q=Nadia&filter=submitted&page=3&bookingId=request-1&tab=messages',
  { bookingId: '', tab: 'overview' },
  requestUrlConfig,
);

assert.equal(closedRequestSearch.includes('bookingId='), false);
assert.equal(closedRequestSearch.includes('tab='), false);
assert.equal(closedRequestSearch.includes('q=Nadia'), true);
assert.equal(closedRequestSearch.includes('filter=submitted'), true);
assert.equal(closedRequestSearch.includes('page=3'), true);

/**
 * Admin shell integration.
 */
const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminPageSource.includes(
    'BookingRequestsPage',
  ),
  true,
  'AdminPage must lazy-load the real Request Inbox.',
);

assert.equal(
  adminPageSource.includes(
    "activeKey === 'requests'",
  ),
  true,
  'AdminPage must render Request Inbox for the requests nav item.',
);

assert.equal(
  adminPageSource.includes(
    'requests: Inbox',
  ),
  true,
  'Request Inbox must have a dedicated navigation icon.',
);

/**
 * Request Inbox data contract.
 */
const requestPageSource =
  readFileSync(
    resolve(
      'src/pages/admin/BookingRequestsPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  requestPageSource.includes(
    'adminBookingRepository',
  ),
  true,
);

assert.equal(
  requestPageSource.includes(
    '.subscribeManualBookings(',
  ),
  true,
  'Request Inbox must subscribe to Firestore bookings.',
);

assert.equal(
  requestPageSource.includes(
    'startDate:',
  ),
  false,
  'Request Inbox must not be restricted by the current calendar start date.',
);

assert.equal(
  requestPageSource.includes(
    'endDate:',
  ),
  false,
  'Request Inbox must not be restricted by the current calendar end date.',
);

assert.match(
  requestPageSource,
  /\.filter\(\s*isBookingRequestActionable\s*,?\s*\)/,
  'Request Inbox must use the canonical actionable request selector.',
);

assert.equal(
  requestPageSource.includes(
    '.updateBookingRequestStatus({',
  ),
  true,
  'Request Inbox must reuse the existing communication write path.',
);

assert.equal(
  requestPageSource.includes(
    "'submitted'",
  ),
  true,
);

assert.equal(
  requestPageSource.includes(
    "'cancellation_requested'",
  ),
  true,
);

assert.equal(
  requestPageSource.includes(
    'BookingDetailDrawer',
  ),
  true,
  'Request Inbox must expose the unified booking detail drawer.',
);

/**
 * BookingDetailDrawer is the shared booking detail surface.
 */
const detailSource =
  readFileSync(
    resolve(
      'src/components/booking/BookingDetailDrawer.jsx',
    ),
    'utf8',
  );

assert.equal(
  detailSource.includes(
    'getBookingPaymentStatus',
  ),
  true,
);

assert.equal(
  detailSource.includes(
    'getBookingRequestStatus(',
  ),
  true,
);

assert.equal(
  detailSource.includes(
    'BookingConversationPanel',
  ),
  true,
);

assert.equal(
  detailSource.includes(
    '{onEdit ? (',
  ),
  true,
  'BookingDetailDrawer edit action must remain optional for Request Inbox.',
);

assert.equal(
  requestPageSource.includes(
    "'messages',",
  ),
  true,
  'Detail & Chat must be able to open the drawer directly on Messages.',
);

/**
 * Phase 3D introduces All Bookings as a real destination.
 * Request Inbox routing remains protected by the assertion above.
 */
assert.equal(
  ADMIN_NAV_ITEMS.some(
    (item) =>
      item.path ===
      '/admin/bookings',
  ),
  true,
);

process.stdout.write(
  '✅ Booking Request Inbox contract passed.\n',
);
