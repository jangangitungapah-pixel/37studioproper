import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_REQUEST_STATUS,
  BOOKING_SESSION_STATUS,
} from './bookingStatus.js';
import {
  normalizePaymentStatus,
  normalizeRequestStatus,
  normalizeSessionStatus,
} from './normalizeBooking.js';

/**
 * Canonical selector layer.
 *
 * Consumer aplikasi harus mengambil keputusan status booking dari file ini,
 * bukan lagi membaca paymentStatus/status/bookingRequestStatus secara manual.
 *
 * Firestore legacy tetap tidak dimutasi oleh selector.
 */

export const LEGACY_PAYMENT_STATUS_BY_CANONICAL = Object.freeze({
  [BOOKING_PAYMENT_STATUS.UNPAID]: 'pending',
  [BOOKING_PAYMENT_STATUS.PARTIAL]: 'dp',
  [BOOKING_PAYMENT_STATUS.PAID]: 'lunas',
  [BOOKING_PAYMENT_STATUS.REFUNDED]: 'refunded',
  [BOOKING_PAYMENT_STATUS.VOID]: 'void',
});

function cleanStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

export function getBookingRequestStatus(booking) {
  return normalizeRequestStatus(booking);
}

export function getBookingPaymentStatus(booking) {
  return normalizePaymentStatus(booking);
}

export function getBookingSessionStatus(
  booking,
  options = {},
) {
  return normalizeSessionStatus(
    booking,
    options,
  );
}

/**
 * Temporary presentation adapter.
 *
 * Schedule/Billing UI masih memakai key:
 * pending / dp / lunas / void.
 *
 * Business decision tetap berasal dari canonical payment status.
 * Adapter ini boleh dihapus ketika UI vocabulary ikut dimigrasikan nanti.
 */
export function getLegacyBookingPaymentStatus(booking) {
  const rawPaymentStatus = cleanStatus(
    booking?.paymentStatus,
  );

  const rawGeneralStatus = cleanStatus(
    booking?.status,
  );

  const terminalLegacyStatuses = [
    'cancelled',
    'canceled',
    'deleted',
  ];

  if (
    terminalLegacyStatuses.includes(
      rawPaymentStatus,
    )
  ) {
    return rawPaymentStatus === 'canceled'
      ? 'cancelled'
      : rawPaymentStatus;
  }

  /**
   * Preserve old presentation behavior when paymentStatus is absent and
   * the old generic status carried cancellation information.
   */
  if (
    !rawPaymentStatus &&
    terminalLegacyStatuses.includes(
      rawGeneralStatus,
    )
  ) {
    return rawGeneralStatus === 'canceled'
      ? 'cancelled'
      : rawGeneralStatus;
  }

  const canonicalStatus =
    getBookingPaymentStatus(booking);

  return (
    LEGACY_PAYMENT_STATUS_BY_CANONICAL[
      canonicalStatus
    ] ||
    canonicalStatus ||
    'pending'
  );
}

export function isBookingPaymentOpen(booking) {
  const status =
    getBookingPaymentStatus(booking);

  return (
    status === BOOKING_PAYMENT_STATUS.UNPAID ||
    status === BOOKING_PAYMENT_STATUS.PARTIAL
  );
}

export function isBookingRequestActionable(booking) {
  const status =
    getBookingRequestStatus(booking);

  return (
    status === BOOKING_REQUEST_STATUS.SUBMITTED ||
    status ===
      BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED
  );
}

export function isBookingCancellationRequested(booking) {
  return (
    getBookingRequestStatus(booking) ===
    BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED
  );
}

/**
 * "Cancelled" di sini berarti booking tidak boleh dianggap sebagai sesi aktif.
 *
 * cancellation_requested TIDAK termasuk cancelled karena slot harus tetap
 * dianggap aktif sampai admin benar-benar menyetujui pembatalan.
 */
export function isBookingCancelled(booking) {
  const rawPaymentStatus = cleanStatus(
    booking?.paymentStatus,
  );

  const rawGeneralStatus = cleanStatus(
    booking?.status,
  );

  if (
    [
      'cancelled',
      'canceled',
      'deleted',
    ].includes(rawPaymentStatus) ||
    [
      'cancelled',
      'canceled',
      'deleted',
    ].includes(rawGeneralStatus)
  ) {
    return true;
  }

  const requestStatus =
    getBookingRequestStatus(booking);

  const paymentStatus =
    getBookingPaymentStatus(booking);

  const sessionStatus =
    getBookingSessionStatus(booking);

  return (
    requestStatus ===
      BOOKING_REQUEST_STATUS.REJECTED ||
    requestStatus ===
      BOOKING_REQUEST_STATUS.CANCELLED ||
    paymentStatus ===
      BOOKING_PAYMENT_STATUS.VOID ||
    sessionStatus ===
      BOOKING_SESSION_STATUS.CANCELLED
  );
}

export function isBookingScheduleActive(booking) {
  return !isBookingCancelled(booking);
}
