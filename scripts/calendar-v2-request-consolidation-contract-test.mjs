import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ADMIN_NAV_ITEMS,
} from '../src/config/adminNavigation.js';

const scheduleSource = readFileSync(
  resolve('src/pages/admin/SchedulePage.jsx'),
  'utf8',
);

const requestSource = readFileSync(
  resolve('src/pages/admin/BookingRequestsPage.jsx'),
  'utf8',
);

const drawerSource = readFileSync(
  resolve('src/components/booking/BookingDetailDrawer.jsx'),
  'utf8',
);

const scheduleCss = readFileSync(
  resolve('src/styles/modules/schedule.css'),
  'utf8',
);

const adminPageSource = readFileSync(
  resolve('src/pages/AdminPage.jsx'),
  'utf8',
);

const requestItem = ADMIN_NAV_ITEMS.find(
  (item) => item.key === 'requests',
);

assert.equal(
  requestItem?.path,
  '/admin/bookings/requests',
  'Calendar must navigate to the canonical Request Inbox route.',
);

/**
 * Request handling belongs to Request Inbox only.
 */
for (const forbidden of [
  'RequestQueueModal',
  'isRequestListOpen',
  'requestActionKey',
  'handleQuickRequestAction',
  'updateClientRequestStatus',
  'bookingCommunicationRepository',
  'requestBookings',
]) {
  assert.equal(
    scheduleSource.includes(forbidden),
    false,
    'Calendar must not own request workflow token: ' + forbidden,
  );
}

assert.equal(
  scheduleSource.includes(
    'const navigate = useNavigate();',
  ),
  true,
);

assert.equal(
  scheduleSource.includes(
    'REQUEST_INBOX_PATH',
  ),
  true,
);

assert.equal(
  scheduleSource.includes(
    'navigate(\n      REQUEST_INBOX_PATH,',
  ),
  true,
  'Calendar must expose a Request Inbox shortcut without maintaining a local queue.',
);

assert.equal(
  requestSource.includes(
    'bookingCommunicationRepository',
  ),
  true,
  'Request Inbox must retain the request write repository.',
);

assert.equal(
  requestSource.includes(
    'onRequestStatusChange=',
  ),
  true,
  'Request Inbox must remain able to mutate request status through the shared drawer.',
);

assert.equal(
  scheduleSource.includes(
    'onRequestStatusChange=',
  ),
  false,
  'Calendar drawer must be read/edit only for request status.',
);

assert.equal(
  drawerSource.includes(
    'const canManageRequest =',
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    'canManageRequest &&',
  ),
  true,
  'Shared drawer must hide request actions when the parent does not provide mutation capability.',
);

/**
 * Unconfirmed client requests are not scheduled.
 */
const unscheduledStart = scheduleSource.indexOf(
  'function isUnscheduledClientRequest(',
);

const unscheduledEnd = scheduleSource.indexOf(
  'function isUpcomingScheduleBooking(',
  unscheduledStart,
);

const unscheduledSource = scheduleSource.slice(
  unscheduledStart,
  unscheduledEnd,
);

for (const status of [
  'submitted',
  'rejected',
  'cancelled',
]) {
  assert.equal(
    unscheduledSource.includes(
      "'" + status + "'",
    ),
    true,
    'Unscheduled client state missing: ' + status,
  );
}

assert.equal(
  unscheduledSource.includes(
    "'cancellation_requested'",
  ),
  false,
  'Cancellation requested must continue to reserve its confirmed schedule slot.',
);

assert.equal(
  scheduleSource.includes(
    'if (isUnscheduledClientRequest(booking)) return false;',
  ),
  true,
  'Upcoming schedule must exclude submitted/rejected/cancelled client requests.',
);

assert.equal(
  scheduleSource.includes(
    "requestStatus === 'cancellation_requested'",
  ),
  true,
  'Calendar may retain a passive cancellation-request signal.',
);

assert.equal(
  scheduleSource.includes(
    "is-cancellation-requested",
  ),
  true,
);

assert.equal(
  scheduleSource.includes(
    'is-req-submitted',
  ),
  false,
);

/**
 * Date-range Calendar subscription must not perform full reconciliation.
 * AdminPage owns the global mirror reconciliation using an unbounded booking subscription.
 */
assert.equal(
  scheduleSource.includes(
    'syncClientCalendarSlotsFromBookings(data)',
  ),
  false,
  'Partial Calendar data must never drive global public-slot reconciliation.',
);

assert.equal(
  adminPageSource.includes(
    'syncClientCalendarSlotsFromBookings(data)',
  ),
  true,
  'Global Admin shell reconciliation must remain intact.',
);

/**
 * Local Request Queue styling should be gone.
 */
assert.equal(
  scheduleCss.includes(
    'schedule-request-modal',
  ),
  false,
);

assert.equal(
  scheduleCss.includes(
    'schedule-request-card',
  ),
  false,
);

process.stdout.write(
  '✅ Calendar V2 request consolidation contract passed.\n',
);
