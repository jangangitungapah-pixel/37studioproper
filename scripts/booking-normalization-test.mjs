import assert from 'node:assert/strict';

import {
  normalizeBooking,
  normalizeBookings,
  normalizePaymentStatus,
  normalizeRequestStatus,
  normalizeSessionStatus,
} from '../src/domain/booking/normalizeBooking.js';

/**
 * Request status compatibility.
 */
assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'submitted',
  }),
  'submitted',
);

assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'approved',
  }),
  'confirmed',
);

assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'canceled',
  }),
  'cancelled',
);

assert.equal(
  normalizeRequestStatus({
    requestStatus: 'cancellation_requested',
    bookingRequestStatus: 'confirmed',
  }),
  'cancellation_requested',
);

/**
 * Persisted legacy/manual bookings had no request dimension.
 * Compatibility default must remain confirmed.
 */
assert.equal(
  normalizeRequestStatus({
    paymentStatus: 'pending',
    source: 'admin',
  }),
  'confirmed',
);

/**
 * Legacy payment vocabulary.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'pending',
  }),
  'unpaid',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'dp',
  }),
  'partial',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'lunas',
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    status: 'lunas',
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    status: 'void',
  }),
  'void',
);

/**
 * Canonical payment values must pass through untouched.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'refunded',
  }),
  'refunded',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'partial',
  }),
  'partial',
);

/**
 * Numeric fallback handles partially-modernized documents.
 */
assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paidAmount: 200000,
  }),
  'partial',
);

assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paymentHistory: [
      { amount: 250000 },
      { amount: 350000 },
    ],
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paymentHistory: [],
  }),
  'unpaid',
);

/**
 * Void marker has highest payment priority.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'paid',
    voidedAt: '2026-08-08T10:00:00.000Z',
  }),
  'void',
);

/**
 * Session status is derived independently from payment.
 */
const todayMorning = new Date(
  2026,
  7,
  8,
  9,
  0,
  0,
);

const todayDuringSession = new Date(
  2026,
  7,
  8,
  11,
  0,
  0,
);

const todayAfterSession = new Date(
  2026,
  7,
  8,
  14,
  0,
  0,
);

const scheduledBooking = {
  date: '2026-08-08',
  startHour: 10,
  durationHours: 3,
};

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayMorning },
  ),
  'upcoming',
);

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayDuringSession },
  ),
  'in_progress',
);

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayAfterSession },
  ),
  'completed',
);

/**
 * Future/past date handling.
 */
assert.equal(
  normalizeSessionStatus(
    {
      date: '2026-08-09',
      startHour: 10,
      durationHours: 2,
    },
    { now: todayAfterSession },
  ),
  'upcoming',
);

assert.equal(
  normalizeSessionStatus(
    {
      date: '2026-08-07',
      startHour: 10,
      durationHours: 2,
    },
    { now: todayMorning },
  ),
  'completed',
);

/**
 * Explicit session values beat schedule inference.
 */
assert.equal(
  normalizeSessionStatus(
    {
      sessionStatus: 'no_show',
      date: '2026-08-09',
    },
    { now: todayMorning },
  ),
  'no_show',
);

/**
 * Rejected/cancelled request cannot remain an active session.
 */
assert.equal(
  normalizeSessionStatus(
    {
      bookingRequestStatus: 'rejected',
      date: '2026-08-09',
      startHour: 10,
    },
    { now: todayMorning },
  ),
  'cancelled',
);

assert.equal(
  normalizeSessionStatus(
    {
      bookingRequestStatus: 'cancelled',
      date: '2026-08-09',
      startHour: 10,
    },
    { now: todayMorning },
  ),
  'cancelled',
);

/**
 * Full booking normalization.
 *
 * Legacy source:
 * request=submitted
 * payment=dp
 * session schedule still upcoming
 */
{
  const original = {
    id: 'booking-normalize-001',
    bookingCode: 'BKG-20260809-TEST1',
    customer: 'Normalization Customer',
    source: 'clientPortal',

    bookingRequestStatus: 'submitted',

    paymentStatus: 'dp',
    status: 'dp',

    total: 600000,
    dpAmount: 200000,
    paidAmount: 200000,

    date: '2026-08-09',
    startHour: 10,
    durationHours: 2,
  };

  const snapshot = JSON.stringify(original);

  const normalized = normalizeBooking(
    original,
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.requestStatus,
    'submitted',
  );

  assert.equal(
    normalized.paymentStatus,
    'partial',
  );

  assert.equal(
    normalized.sessionStatus,
    'upcoming',
  );

  assert.equal(
    normalized.bookingStatusContractVersion,
    1,
  );

  assert.equal(
    normalized.statusSource.requestStatus,
    'submitted',
  );

  assert.equal(
    normalized.statusSource.paymentStatus,
    'dp',
  );

  assert.equal(
    normalized.customer,
    'Normalization Customer',
    'Non-status legacy booking fields must remain compatible.',
  );

  assert.equal(
    normalized.status,
    'dp',
    'Legacy general status must remain available during compatibility phase.',
  );

  assert.equal(
    JSON.stringify(original),
    snapshot,
    'normalizeBooking must not mutate its input.',
  );

  assert.notEqual(
    normalized,
    original,
    'normalizeBooking must return a new read-model object.',
  );
}

/**
 * Manual legacy booking defaults to confirmed request while preserving
 * independent unpaid payment state.
 */
{
  const normalized = normalizeBooking(
    {
      id: 'manual-legacy',
      paymentStatus: 'pending',
      status: 'pending',
      date: '2026-08-09',
      startHour: 12,
      durationHours: 1,
    },
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.requestStatus,
    'confirmed',
  );

  assert.equal(
    normalized.paymentStatus,
    'unpaid',
  );

  assert.equal(
    normalized.sessionStatus,
    'upcoming',
  );
}

/**
 * normalizeBookings should be safe for invalid collections/items.
 */
assert.deepEqual(
  normalizeBookings(null),
  [],
);

{
  const normalized = normalizeBookings(
    [
      null,
      {
        id: 'one',
        paymentStatus: 'pending',
      },
      false,
      {
        id: 'two',
        paymentStatus: 'lunas',
      },
    ],
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.length,
    2,
  );

  assert.equal(
    normalized[0].paymentStatus,
    'unpaid',
  );

  assert.equal(
    normalized[1].paymentStatus,
    'paid',
  );
}

process.stdout.write(
  '✅ Booking normalization compatibility contract passed.\n',
);
