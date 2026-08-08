import assert from 'node:assert/strict';

import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_PAYMENT_STATUS_META,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_STATUSES,
  BOOKING_REQUEST_STATUS_META,
  BOOKING_SESSION_STATUS,
  BOOKING_SESSION_STATUSES,
  BOOKING_SESSION_STATUS_META,
  BOOKING_STATUS_CONTRACT_VERSION,
  LEGACY_PAYMENT_STATUS,
  LEGACY_PAYMENT_STATUS_MAP,
  isBookingPaymentStatus,
  isBookingRequestStatus,
  isBookingSessionStatus,
} from '../src/domain/booking/bookingStatus.js';

/**
 * Contract 1
 *
 * Domain contract harus versioned supaya perubahan vocabulary di masa depan
 * dilakukan secara sadar.
 */
assert.equal(
  BOOKING_STATUS_CONTRACT_VERSION,
  1,
  'Unexpected canonical booking status contract version.',
);

/**
 * Contract 2
 *
 * Request status tidak boleh lagi tercampur dengan payment status.
 */
assert.deepEqual(
  BOOKING_REQUEST_STATUSES,
  [
    'draft',
    'submitted',
    'confirmed',
    'rejected',
    'cancellation_requested',
    'cancelled',
  ],
  'Canonical request status vocabulary berubah.',
);

/**
 * Contract 3
 *
 * Payment canonical tidak menggunakan pending/dp/lunas.
 */
assert.deepEqual(
  BOOKING_PAYMENT_STATUSES,
  [
    'unpaid',
    'partial',
    'paid',
    'refunded',
    'void',
  ],
  'Canonical payment status vocabulary berubah.',
);

/**
 * Contract 4
 *
 * Session lifecycle merupakan dimensi terpisah.
 */
assert.deepEqual(
  BOOKING_SESSION_STATUSES,
  [
    'upcoming',
    'in_progress',
    'completed',
    'no_show',
    'cancelled',
  ],
  'Canonical session status vocabulary berubah.',
);

/**
 * Contract 5
 *
 * Legacy payment vocabulary tetap didefinisikan secara eksplisit selama
 * compatibility migration berlangsung.
 */
assert.deepEqual(
  LEGACY_PAYMENT_STATUS,
  {
    PENDING: 'pending',
    DP: 'dp',
    LUNAS: 'lunas',
    VOID: 'void',
  },
  'Legacy payment status compatibility contract berubah.',
);

/**
 * Contract 6
 *
 * Legacy payment status mempunyai mapping deterministic ke canonical status.
 */
assert.deepEqual(
  LEGACY_PAYMENT_STATUS_MAP,
  {
    pending: 'unpaid',
    dp: 'partial',
    lunas: 'paid',
    void: 'void',
  },
  'Legacy -> canonical payment mapping berubah.',
);

/**
 * Contract 7
 *
 * Status metadata harus lengkap untuk seluruh vocabulary.
 */
assert.deepEqual(
  Object.keys(BOOKING_REQUEST_STATUS_META),
  BOOKING_REQUEST_STATUSES,
  'Request status metadata tidak lengkap.',
);

assert.deepEqual(
  Object.keys(BOOKING_PAYMENT_STATUS_META),
  BOOKING_PAYMENT_STATUSES,
  'Payment status metadata tidak lengkap.',
);

assert.deepEqual(
  Object.keys(BOOKING_SESSION_STATUS_META),
  BOOKING_SESSION_STATUSES,
  'Session status metadata tidak lengkap.',
);

/**
 * Contract 8
 *
 * Validator domain harus menerima canonical value dan menolak vocabulary
 * dari dimensi yang berbeda.
 */
assert.equal(
  isBookingRequestStatus(BOOKING_REQUEST_STATUS.SUBMITTED),
  true,
);

assert.equal(
  isBookingRequestStatus(BOOKING_PAYMENT_STATUS.UNPAID),
  false,
);

assert.equal(
  isBookingPaymentStatus(BOOKING_PAYMENT_STATUS.PARTIAL),
  true,
);

assert.equal(
  isBookingPaymentStatus(LEGACY_PAYMENT_STATUS.DP),
  false,
);

assert.equal(
  isBookingSessionStatus(BOOKING_SESSION_STATUS.COMPLETED),
  true,
);

assert.equal(
  isBookingSessionStatus(BOOKING_REQUEST_STATUS.CONFIRMED),
  false,
);

/**
 * Contract 9
 *
 * Canonical constants dan metadata bersifat immutable.
 */
assert.equal(
  Object.isFrozen(BOOKING_REQUEST_STATUS),
  true,
);

assert.equal(
  Object.isFrozen(BOOKING_PAYMENT_STATUS),
  true,
);

assert.equal(
  Object.isFrozen(BOOKING_SESSION_STATUS),
  true,
);

assert.equal(
  Object.isFrozen(BOOKING_REQUEST_STATUS_META),
  true,
);

assert.equal(
  Object.isFrozen(BOOKING_PAYMENT_STATUS_META),
  true,
);

assert.equal(
  Object.isFrozen(BOOKING_SESSION_STATUS_META),
  true,
);

/**
 * Contract 10
 *
 * Arti utama ketiga dimensi harus tetap berbeda.
 */
assert.equal(
  BOOKING_REQUEST_STATUS.CONFIRMED,
  'confirmed',
);

assert.equal(
  BOOKING_PAYMENT_STATUS.PAID,
  'paid',
);

assert.equal(
  BOOKING_SESSION_STATUS.COMPLETED,
  'completed',
);

process.stdout.write(
  '✅ Canonical booking domain status contract passed.\n',
);
