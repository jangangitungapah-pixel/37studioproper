import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
} from '../src/domain/booking/bookingSelectors.js';

import {
  getBookingBillingTotal,
  getBookingOutstandingAmount,
  getBookingPaidAmount,
  getBookingPaymentHistory,
} from '../src/utils/bookingPaymentUtils.js';

/**
 * Shared detail read-model semantics.
 */
const legacyBooking = {
  id: 'drawer-legacy',
  bookingRequestStatus: 'confirmed',
  paymentStatus: 'dp',
  status: 'dp',
  total: 600000,
  dpAmount: 200000,
  paidAmount: 200000,
  paymentHistory: [
    {
      amount: 200000,
      createdAt: '2026-08-08T12:00:00.000Z',
      id: 'payment-1',
      method: 'transfer',
    },
  ],
  date: '2026-08-09',
  startHour: 10,
  durationHours: 2,
};

assert.equal(
  getBookingRequestStatus(
    legacyBooking,
  ),
  'confirmed',
);

assert.equal(
  getBookingPaymentStatus(
    legacyBooking,
  ),
  'partial',
);

assert.equal(
  getBookingSessionStatus(
    legacyBooking,
    {
      now: new Date(
        2026,
        7,
        8,
        20,
        0,
        0,
      ),
    },
  ),
  'upcoming',
);

assert.equal(
  getBookingBillingTotal(
    legacyBooking,
  ),
  600000,
);

assert.equal(
  getBookingPaidAmount(
    legacyBooking,
  ),
  200000,
);

assert.equal(
  getBookingOutstandingAmount(
    legacyBooking,
  ),
  400000,
);

assert.equal(
  getBookingPaymentHistory(
    legacyBooking,
  ).length,
  1,
);

/**
 * Drawer architecture.
 */
const drawerSource =
  readFileSync(
    resolve(
      'src/components/booking/BookingDetailDrawer.jsx',
    ),
    'utf8',
  );

for (
  const tab
  of [
    'overview',
    'messages',
    'payment',
    'activity',
  ]
) {
  assert.equal(
    drawerSource.includes(
      "key: '" +
      tab +
      "'",
    ),
    true,
    'Missing drawer tab: ' +
      tab,
  );
}

assert.equal(
  drawerSource.includes(
    'role="tablist"',
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    'role="tabpanel"',
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    "event.key ===\n        'Escape'",
  ),
  true,
  'Drawer must support Escape dismissal.',
);

assert.equal(
  drawerSource.includes(
    "document.body.style\n      .overflow = 'hidden'",
  ),
  true,
  'Drawer must lock page scrolling while open.',
);

assert.equal(
  drawerSource.includes(
    "event.key !== 'Tab'",
  ),
  true,
  'Drawer must trap keyboard focus while open.',
);

assert.equal(
  drawerSource.includes(
    'previousFocusRef.current?.focus?.()',
  ),
  true,
  'Drawer must restore focus to the trigger on close.',
);

assert.equal(
  drawerSource.includes(
    "event.key === 'ArrowRight'",
  ),
  true,
  'Drawer tablist must support arrow-key navigation.',
);

assert.equal(
  drawerSource.includes(
    'activeTab: controlledActiveTab',
  ),
  true,
  'Drawer tab must be controllable by deep-link URL state.',
);

assert.equal(
  drawerSource.includes(
    'BookingConversationPanel',
  ),
  true,
  'Messages tab must reuse the real-time conversation component.',
);

assert.equal(
  drawerSource.includes(
    'getBookingPaymentHistory',
  ),
  true,
  'Payment tab must reuse the payment utility contract.',
);

assert.equal(
  drawerSource.includes(
    'getBookingPaidAmount',
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    'getBookingOutstandingAmount',
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    'buildBookingActivity',
  ),
  true,
  'Activity tab must derive its read-only booking timeline.',
);

assert.equal(
  drawerSource.includes(
    'audit log permanen',
  ),
  true,
  'Derived activity must not pretend to be a persistent audit log.',
);

assert.equal(
  drawerSource.includes(
    'adminBookingRepository',
  ),
  false,
  'Shared detail drawer must not introduce a second booking write path.',
);

assert.equal(
  drawerSource.includes(
    'writeBatch',
  ),
  false,
  'Drawer must not write directly to Firestore.',
);

/**
 * Calendar and Request Inbox must use the same component.
 */
const scheduleSource =
  readFileSync(
    resolve(
      'src/pages/admin/SchedulePage.jsx',
    ),
    'utf8',
  );

const requestSource =
  readFileSync(
    resolve(
      'src/pages/admin/BookingRequestsPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  scheduleSource.includes(
    'BookingDetailDrawer',
  ),
  true,
  'Calendar must use BookingDetailDrawer.',
);

assert.equal(
  requestSource.includes(
    'BookingDetailDrawer',
  ),
  true,
  'Request Inbox must use BookingDetailDrawer.',
);

assert.equal(
  scheduleSource.includes(
    'BookingDetailModal',
  ),
  false,
  'Calendar must no longer depend on the old modal.',
);

assert.equal(
  requestSource.includes(
    'BookingDetailModal',
  ),
  false,
  'Request Inbox must no longer depend on the old modal.',
);

assert.equal(
  requestSource.includes(
    "'messages',",
  ),
  true,
  'Request Inbox Detail & Chat must open the Messages tab.',
);

assert.equal(
  scheduleSource.includes(
    'onRequestStatusChange=',
  ),
  false,
  'Calendar drawer must not own request status mutations after Phase 3C.',
);

assert.equal(
  requestSource.includes(
    'onRequestStatusChange=',
  ),
  true,
  'Request Inbox must remain the request mutation owner.',
);

assert.equal(
  drawerSource.includes(
    'canManageRequest &&',
  ),
  true,
  'Drawer request actions must be capability-gated by the parent.',
);

/**
 * Drawer styling exists independently from Calendar styling.
 */
const drawerCssSource =
  readFileSync(
    resolve(
      'src/styles/modules/booking-detail-drawer.css',
    ),
    'utf8',
  );

assert.equal(
  drawerCssSource.includes(
    '.booking-detail-drawer-backdrop',
  ),
  true,
);

assert.equal(
  drawerCssSource.includes(
    '.booking-detail-drawer-tabs',
  ),
  true,
);

assert.equal(
  drawerCssSource.includes(
    '.booking-detail-drawer-activity',
  ),
  true,
);

process.stdout.write(
  '✅ Unified Booking Detail Drawer contract passed.\n',
);
