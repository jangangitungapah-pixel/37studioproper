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

assert.equal(
  requestPageSource.includes(
    '.filter(\n            isBookingRequestActionable,',
  ),
  true,
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
