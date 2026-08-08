import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
  getLegacyBookingPaymentStatus,
  isBookingCancellationRequested,
  isBookingCancelled,
  isBookingPaymentOpen,
  isBookingRequestActionable,
  isBookingScheduleActive,
} from '../src/domain/booking/bookingSelectors.js';

/**
 * Canonical payment selectors.
 */
assert.equal(
  getBookingPaymentStatus({
    paymentStatus: 'pending',
  }),
  'unpaid',
);

assert.equal(
  getBookingPaymentStatus({
    paymentStatus: 'dp',
  }),
  'partial',
);

assert.equal(
  getBookingPaymentStatus({
    paymentStatus: 'lunas',
  }),
  'paid',
);

/**
 * Legacy UI adapter still serves old visual/filter keys.
 */
assert.equal(
  getLegacyBookingPaymentStatus({
    paymentStatus: 'pending',
  }),
  'pending',
);

assert.equal(
  getLegacyBookingPaymentStatus({
    paymentStatus: 'partial',
  }),
  'dp',
);

assert.equal(
  getLegacyBookingPaymentStatus({
    paymentStatus: 'paid',
  }),
  'lunas',
);

assert.equal(
  getLegacyBookingPaymentStatus({
    status: 'cancelled',
  }),
  'cancelled',
);

/**
 * Request selectors.
 */
assert.equal(
  getBookingRequestStatus({
    bookingRequestStatus: 'submitted',
  }),
  'submitted',
);

assert.equal(
  getBookingRequestStatus({
    bookingRequestStatus: 'approved',
  }),
  'confirmed',
);

assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus: 'submitted',
  }),
  true,
);

assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus: 'cancellation_requested',
  }),
  true,
);

assert.equal(
  isBookingRequestActionable({
    bookingRequestStatus: 'confirmed',
  }),
  false,
);

assert.equal(
  isBookingCancellationRequested({
    bookingRequestStatus: 'cancellation_requested',
  }),
  true,
);

/**
 * Payment-open selector.
 */
assert.equal(
  isBookingPaymentOpen({
    paymentStatus: 'pending',
  }),
  true,
);

assert.equal(
  isBookingPaymentOpen({
    paymentStatus: 'dp',
  }),
  true,
);

assert.equal(
  isBookingPaymentOpen({
    paymentStatus: 'lunas',
  }),
  false,
);

/**
 * Cancellation is cross-dimensional.
 */
assert.equal(
  isBookingCancelled({
    bookingRequestStatus: 'rejected',
  }),
  true,
);

assert.equal(
  isBookingCancelled({
    bookingRequestStatus: 'cancelled',
  }),
  true,
);

assert.equal(
  isBookingCancelled({
    bookingRequestStatus: 'cancellation_requested',
    paymentStatus: 'pending',
  }),
  false,
);

assert.equal(
  isBookingCancelled({
    paymentStatus: 'void',
  }),
  true,
);

assert.equal(
  isBookingCancelled({
    status: 'deleted',
  }),
  true,
);

assert.equal(
  isBookingScheduleActive({
    bookingRequestStatus: 'confirmed',
    paymentStatus: 'pending',
  }),
  true,
);

/**
 * Session selector remains deterministic.
 */
assert.equal(
  getBookingSessionStatus(
    {
      date: '2026-08-09',
      startHour: 10,
      durationHours: 2,
    },
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
  getBookingSessionStatus(
    {
      date: '2026-08-08',
      startHour: 19,
      durationHours: 2,
    },
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
  'in_progress',
);

/**
 * Static migration guard.
 *
 * These core consumers must route status decisions through bookingSelectors.
 */
const migratedConsumers = [
  'src/services/adminBookingRepository.js',
  'src/services/bookingCommunicationRepository.js',
  'src/pages/admin/SchedulePage.jsx',
  'src/pages/admin/BillingPage.jsx',
  'src/pages/ClientPortalPage.jsx',
  'src/components/client/ClientDashboardTab.jsx',
  'src/components/client/ClientCalendarTab.jsx',
];

for (const relativePath of migratedConsumers) {
  const source = readFileSync(
    resolve(relativePath),
    'utf8',
  );

  assert.equal(
    source.includes('bookingSelectors.js'),
    true,
    relativePath + ' must import canonical booking selectors.',
  );
}

const adminRepositorySource = readFileSync(
  resolve('src/services/adminBookingRepository.js'),
  'utf8',
);

assert.equal(
  adminRepositorySource.includes(
    "String(booking?.paymentStatus || booking?.status || 'pending')",
  ),
  false,
  'adminBookingRepository still contains direct legacy status selection.',
);

const scheduleSource = readFileSync(
  resolve('src/pages/admin/SchedulePage.jsx'),
  'utf8',
);

assert.equal(
  scheduleSource.includes(
    "return booking.paymentStatus || booking.status || 'pending';",
  ),
  false,
  'SchedulePage still contains the old payment status helper.',
);

const portalSource = readFileSync(
  resolve('src/pages/ClientPortalPage.jsx'),
  'utf8',
);

assert.equal(
  portalSource.includes(
    "return booking.paymentStatus || booking.status || 'pending';",
  ),
  false,
  'ClientPortalPage still contains the old payment status helper.',
);

assert.equal(
  portalSource.includes(
    "(booking.paymentStatus || booking.status || 'pending').toLowerCase()",
  ),
  false,
  'ClientPortal calendar still bypasses canonical selectors.',
);

const billingSource = readFileSync(
  resolve('src/pages/admin/BillingPage.jsx'),
  'utf8',
);

assert.equal(
  billingSource.includes(
    "cleanLower(booking?.paymentStatus || booking?.status || 'pending')",
  ),
  false,
  'BillingPage still bypasses canonical payment selectors.',
);

process.stdout.write(
  '✅ Booking selector and consumer migration contract passed.\n',
);
