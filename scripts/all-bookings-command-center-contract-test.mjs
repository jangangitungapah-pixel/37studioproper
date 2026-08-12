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
  resolveAdminNavigationPath,
} from '../src/config/adminNavigation.js';

import {
  parseBookingListUrlState,
  updateBookingListSearch,
} from '../src/domain/booking/bookingUrlState.js';

const itemByKey =
  new Map(
    ADMIN_NAV_ITEMS.map(
      (item) => [
        item.key,
        item,
      ],
    ),
  );

const bookingsItem =
  itemByKey.get(
    'bookings',
  );

assert.equal(
  bookingsItem?.path,
  '/admin/bookings',
);

assert.equal(
  bookingsItem?.permissionKey,
  'schedule',
);

assert.equal(
  bookingsItem?.groupLabel,
  'Booking',
);

assert.equal(
  isAdminSidebarItem(
    bookingsItem,
  ),
  true,
);

assert.equal(
  isAdminMobileItem(
    bookingsItem,
  ),
  true,
);

assert.equal(
  ADMIN_MOBILE_PRIMARY_KEYS.includes(
    'bookings',
  ),
  false,
  'All Bookings belongs in mobile More, not the primary bottom nav.',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/bookings',
  ),
  '/admin/bookings',
  'Booking section root must now be the real All Bookings page.',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings',
  )?.key,
  'bookings',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings/requests',
  )?.key,
  'requests',
  'All Bookings parent route must not swallow Request Inbox.',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings/calendar',
  )?.key,
  'schedule',
  'All Bookings parent route must not swallow Calendar.',
);

const allBookingsUrlConfig = {
  paymentFilters: ['all', 'unpaid', 'paid'],
  requestFilters: ['all', 'submitted', 'confirmed'],
  sessionFilters: ['all', 'upcoming', 'completed'],
};
const urlState = parseBookingListUrlState(
  '?q=Raka&request=confirmed&payment=unpaid&session=upcoming&page=2&bookingId=bkg-1&tab=activity',
  allBookingsUrlConfig,
);

assert.deepEqual(
  urlState,
  {
    bookingId: 'bkg-1',
    page: 2,
    paymentFilter: 'unpaid',
    query: 'Raka',
    requestFilter: 'confirmed',
    sessionFilter: 'upcoming',
    tab: 'activity',
  },
);

const closedDrawerSearch = updateBookingListSearch(
  '?q=Raka&request=confirmed&payment=unpaid&session=upcoming&page=2&bookingId=bkg-1&tab=activity&utm=admin',
  { bookingId: '', tab: 'overview' },
  allBookingsUrlConfig,
);
const closedDrawerParams = new URLSearchParams(
  closedDrawerSearch,
);

assert.equal(closedDrawerParams.get('bookingId'), null);
assert.equal(closedDrawerParams.get('tab'), null);
assert.equal(closedDrawerParams.get('q'), 'Raka');
assert.equal(closedDrawerParams.get('request'), 'confirmed');
assert.equal(closedDrawerParams.get('page'), '2');
assert.equal(closedDrawerParams.get('utm'), 'admin');

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminPageSource.includes(
    "const AllBookingsPage = lazy(() => import('./admin/AllBookingsPage.jsx'));",
  ),
  true,
);

assert.equal(
  adminPageSource.includes(
    "activeKey === 'bookings'",
  ),
  true,
);

assert.equal(
  adminPageSource.includes(
    'bookings: ListChecks',
  ),
  true,
);

const pageSource =
  readFileSync(
    resolve(
      'src/pages/admin/AllBookingsPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  pageSource.includes(
    'subscribeManualBookings(',
  ),
  true,
  'All Bookings must use the existing booking repository.',
);

assert.equal(
  pageSource.includes(
    'startDate:',
  ),
  false,
  'All Bookings must be global, not date-range scoped.',
);

assert.equal(
  pageSource.includes(
    'endDate:',
  ),
  false,
  'All Bookings must be global, not date-range scoped.',
);

for (
  const selector
  of [
    'getBookingRequestStatus',
    'getBookingPaymentStatus',
    'getBookingSessionStatus',
  ]
) {
  assert.equal(
    pageSource.includes(
      selector,
    ),
    true,
    'Missing canonical status selector: ' +
      selector,
  );
}

for (
  const meta
  of [
    'BOOKING_REQUEST_STATUS_META',
    'BOOKING_PAYMENT_STATUS_META',
    'BOOKING_SESSION_STATUS_META',
  ]
) {
  assert.equal(
    pageSource.includes(
      meta,
    ),
    true,
    'Missing canonical status metadata: ' +
      meta,
  );
}

assert.equal(
  pageSource.includes(
    'PaginationControls',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'getPaginationSlice',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'BookingDetailDrawer',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'onRequestStatusChange=',
  ),
  false,
  'All Bookings must not become another request mutation owner.',
);

assert.equal(
  pageSource.includes(
    'onEdit=',
  ),
  false,
  'Phase 3D All Bookings drawer remains read-only.',
);

for (
  const forbidden
  of [
    'bookingCommunicationRepository',
    '.createManualBooking(',
    '.updateManualBooking(',
    '.deleteManualBooking(',
    'writeBatch',
  ]
) {
  assert.equal(
    pageSource.includes(
      forbidden,
    ),
    false,
    'All Bookings must not introduce write path: ' +
      forbidden,
  );
}

assert.equal(
  pageSource.includes(
    'requestFilter',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'paymentFilter',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'sessionFilter',
  ),
  true,
);

assert.equal(
  pageSource.includes(
    'getBookingSearchHaystack',
  ),
  true,
);

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/all-bookings.css',
    ),
    'utf8',
  );

assert.equal(
  cssSource.includes(
    '.all-bookings-page',
  ),
  true,
);

/**
 * Phase 3D visual ownership aligned with UI-4 spatial workspace.
 *
 * Phase 3D owns the read-only/global booking behavior.
 * UI-4 owns the current visual composition.
 *
 * Keep only stable owner-surface assertions here so presentation
 * evolution does not invalidate the older business contract.
 */
for (
  const requiredClass
  of [
    '.all-bookings-page',
    '.all-bookings-data-surface',
    '.all-bookings-mobile-rows',
  ]
) {
  assert.equal(
    cssSource.includes(
      requiredClass,
    ),
    true,
    'All Bookings owner stylesheet missing current surface: ' +
      requiredClass,
  );
}

for (
  const deprecatedClass
  of [
    '.all-bookings-table-shell',
    '.all-bookings-mobile-list',
  ]
) {
  assert.equal(
    cssSource.includes(
      deprecatedClass,
    ),
    false,
    'Deprecated Phase 3D presentation class must not return: ' +
      deprecatedClass,
  );
}

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'calendar-v2-request-consolidation-contract-test.mjs',
  ),
  true,
  'Phase 3C gate must remain in the pipeline.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'all-bookings-command-center-contract-test.mjs',
  ),
  true,
  'Phase 3D gate must be in the test pipeline.',
);

process.stdout.write(
  '✅ All Bookings Command Center contract passed.\n',
);
