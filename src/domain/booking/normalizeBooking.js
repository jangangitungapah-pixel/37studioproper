import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_REQUEST_STATUS,
  BOOKING_SESSION_STATUS,
  LEGACY_PAYMENT_STATUS_MAP,
  isBookingPaymentStatus,
  isBookingRequestStatus,
  isBookingSessionStatus,
} from './bookingStatus.js';

/**
 * Booking normalization layer.
 *
 * Tugas file ini:
 * 1. membaca dokumen booking legacy maupun canonical;
 * 2. menghasilkan tiga dimensi status canonical;
 * 3. tidak melakukan write ke Firestore;
 * 4. tidak memutasi object input;
 * 5. mempertahankan field legacy selama compatibility phase.
 */

function cleanStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getPaymentHistoryTotal(booking) {
  const history = Array.isArray(booking?.paymentHistory)
    ? booking.paymentHistory
    : [];

  return history.reduce(
    (sum, payment) =>
      sum + Math.max(0, toFiniteNumber(payment?.amount)),
    0,
  );
}

function getPaymentEvidenceAmount(booking) {
  return Math.max(
    0,
    toFiniteNumber(booking?.paidAmount),
    toFiniteNumber(booking?.dpAmount),
    getPaymentHistoryTotal(booking),
  );
}

function getBookingTotal(booking) {
  return Math.max(
    0,
    toFiniteNumber(
      booking?.total ??
      booking?.subtotal ??
      booking?.invoiceAmount,
    ),
  );
}

function normalizeRequestAlias(value) {
  const status = cleanStatus(value);

  const aliases = {
    draft: BOOKING_REQUEST_STATUS.DRAFT,

    submitted: BOOKING_REQUEST_STATUS.SUBMITTED,
    pending_request: BOOKING_REQUEST_STATUS.SUBMITTED,
    awaiting_confirmation: BOOKING_REQUEST_STATUS.SUBMITTED,

    confirmed: BOOKING_REQUEST_STATUS.CONFIRMED,
    approved: BOOKING_REQUEST_STATUS.CONFIRMED,
    accepted: BOOKING_REQUEST_STATUS.CONFIRMED,

    rejected: BOOKING_REQUEST_STATUS.REJECTED,
    denied: BOOKING_REQUEST_STATUS.REJECTED,
    declined: BOOKING_REQUEST_STATUS.REJECTED,

    cancellation_requested:
      BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED,
    cancel_requested:
      BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED,

    cancelled: BOOKING_REQUEST_STATUS.CANCELLED,
    canceled: BOOKING_REQUEST_STATUS.CANCELLED,
  };

  return aliases[status] || '';
}

function normalizeSessionAlias(value) {
  const status = cleanStatus(value);

  const aliases = {
    upcoming: BOOKING_SESSION_STATUS.UPCOMING,
    scheduled: BOOKING_SESSION_STATUS.UPCOMING,

    in_progress: BOOKING_SESSION_STATUS.IN_PROGRESS,
    active: BOOKING_SESSION_STATUS.IN_PROGRESS,
    ongoing: BOOKING_SESSION_STATUS.IN_PROGRESS,

    completed: BOOKING_SESSION_STATUS.COMPLETED,
    complete: BOOKING_SESSION_STATUS.COMPLETED,
    finished: BOOKING_SESSION_STATUS.COMPLETED,
    done: BOOKING_SESSION_STATUS.COMPLETED,

    no_show: BOOKING_SESSION_STATUS.NO_SHOW,
    noshow: BOOKING_SESSION_STATUS.NO_SHOW,
    absent: BOOKING_SESSION_STATUS.NO_SHOW,

    cancelled: BOOKING_SESSION_STATUS.CANCELLED,
    canceled: BOOKING_SESSION_STATUS.CANCELLED,
  };

  return aliases[status] || '';
}

function getCurrentDateParts(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).formatToParts(safeDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
    timestamp: safeDate.getTime(),
  };
}
function getScheduleDateKey(booking) {
  const value = String(booking?.date || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return '';
}

function getScheduleStartMinute(booking) {
  const startHour = Number(booking?.startHour);

  if (Number.isFinite(startHour)) {
    return Math.max(
      0,
      Math.round(startHour * 60),
    );
  }

  const rawTime = String(
    booking?.startTime ||
    booking?.startTimeLabel ||
    '',
  ).trim();

  const match = rawTime.match(
    /^(\d{1,2})[:.](\d{2})/,
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function getDurationMinutes(booking) {
  const duration = Number(
    booking?.durationHours ??
    booking?.duration ??
    1,
  );

  if (!Number.isFinite(duration) || duration <= 0) {
    return 60;
  }

  return Math.max(
    1,
    Math.round(duration * 60),
  );
}

/**
 * Request normalization.
 *
 * Priority:
 * canonical requestStatus
 * -> legacy bookingRequestStatus
 * -> safe compatibility default.
 *
 * Persisted legacy bookings without request status are treated as confirmed.
 * This avoids accidentally demoting historical/manual bookings into a new
 * pending request merely because the old schema did not have requestStatus.
 */
export function normalizeRequestStatus(booking = {}) {
  const canonicalStatus = cleanStatus(
    booking?.requestStatus,
  );

  if (isBookingRequestStatus(canonicalStatus)) {
    return canonicalStatus;
  }

  const legacyStatus = normalizeRequestAlias(
    booking?.bookingRequestStatus,
  );

  if (legacyStatus) {
    return legacyStatus;
  }

  return BOOKING_REQUEST_STATUS.CONFIRMED;
}

/**
 * Payment normalization.
 *
 * Priority:
 * explicit void marker
 * -> canonical paymentStatus
 * -> legacy paymentStatus/status
 * -> numeric payment evidence
 * -> unpaid.
 */
export function normalizePaymentStatus(booking = {}) {
  const rawPaymentStatus = cleanStatus(
    booking?.paymentStatus,
  );

  const rawLegacyStatus = cleanStatus(
    booking?.status,
  );

  if (
    booking?.voidedAt ||
    rawPaymentStatus === 'void' ||
    rawLegacyStatus === 'void'
  ) {
    return BOOKING_PAYMENT_STATUS.VOID;
  }

  if (isBookingPaymentStatus(rawPaymentStatus)) {
    return rawPaymentStatus;
  }

  if (LEGACY_PAYMENT_STATUS_MAP[rawPaymentStatus]) {
    return LEGACY_PAYMENT_STATUS_MAP[rawPaymentStatus];
  }

  if (LEGACY_PAYMENT_STATUS_MAP[rawLegacyStatus]) {
    return LEGACY_PAYMENT_STATUS_MAP[rawLegacyStatus];
  }

  if (
    rawPaymentStatus === 'refund' ||
    rawPaymentStatus === 'refunded' ||
    rawLegacyStatus === 'refund' ||
    rawLegacyStatus === 'refunded'
  ) {
    return BOOKING_PAYMENT_STATUS.REFUNDED;
  }

  const paidAmount = getPaymentEvidenceAmount(booking);
  const total = getBookingTotal(booking);

  if (
    total > 0 &&
    paidAmount >= total
  ) {
    return BOOKING_PAYMENT_STATUS.PAID;
  }

  if (paidAmount > 0) {
    return BOOKING_PAYMENT_STATUS.PARTIAL;
  }

  return BOOKING_PAYMENT_STATUS.UNPAID;
}

export const BOOKING_NO_SHOW_GRACE_MINUTES = 15;

/**
 * Schedule timing is a read-only clock signal. It never changes the recorded
 * session lifecycle. A past slot without an execution event is flagged for
 * review instead of being treated as completed.
 */
export function getScheduleTimingStatus(booking = {}, options = {}) {
  const scheduleDate = getScheduleDateKey(booking);
  if (!scheduleDate) return 'schedule_unknown';
  const current = getCurrentDateParts(options.now);
  if (scheduleDate > current.dateKey) return 'before_start';
  if (scheduleDate < current.dateKey) return 'past_due';
  const startMinute = getScheduleStartMinute(booking);
  if (startMinute === null) return 'schedule_unknown';
  if (current.minuteOfDay < startMinute) return 'before_start';
  if (current.minuteOfDay < startMinute + getDurationMinutes(booking)) return 'scheduled_window';
  return 'past_due';
}

export function isBookingNoShowEligible(booking = {}, options = {}) {
  const scheduleDate = getScheduleDateKey(booking);
  const startMinute = getScheduleStartMinute(booking);
  if (!scheduleDate || startMinute === null) return false;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (Number.isNaN(now.getTime())) return false;
  const scheduledStart = new Date(`${scheduleDate}T00:00:00+07:00`).getTime() + startMinute * 60_000;
  return now.getTime() >= scheduledStart + BOOKING_NO_SHOW_GRACE_MINUTES * 60_000;
}

/**
 * Session status is event-backed. Calendar time alone is not evidence that
 * staff actually started or completed the session.
 */
export function normalizeSessionStatus(booking = {}) {
  const canonicalStatus = cleanStatus(booking?.sessionStatus);
  if (isBookingSessionStatus(canonicalStatus)) return canonicalStatus;

  const explicitAlias = normalizeSessionAlias(booking?.sessionStatus)
    || normalizeSessionAlias(booking?.sessionState)
    || normalizeSessionAlias(booking?.status);
  if (explicitAlias) return explicitAlias;

  const requestStatus = normalizeRequestStatus(booking);
  if ([BOOKING_REQUEST_STATUS.REJECTED, BOOKING_REQUEST_STATUS.CANCELLED].includes(requestStatus)) {
    return BOOKING_SESSION_STATUS.CANCELLED;
  }

  return BOOKING_SESSION_STATUS.UPCOMING;
}
/**
 * Main read-model adapter.
 *
 * paymentStatus intentionally becomes canonical in the returned object.
 * The original legacy values remain available under statusSource.
 *
 * Input object itself is never modified.
 */
export function normalizeBooking(
  booking,
  options = {},
) {
  if (
    !booking ||
    typeof booking !== 'object' ||
    Array.isArray(booking)
  ) {
    return null;
  }

  const requestStatus =
    normalizeRequestStatus(booking);

  const paymentStatus =
    normalizePaymentStatus(booking);

  const sessionStatus = normalizeSessionStatus({
    ...booking,
    requestStatus,
  });
  const scheduleTimingStatus = getScheduleTimingStatus(booking, options);
  const noShowEligible = isBookingNoShowEligible(booking, options);

  return {
    ...booking,

    bookingStatusContractVersion: 1,

    requestStatus,
    paymentStatus,
    sessionStatus,
    scheduleTimingStatus,
    noShowEligible,

    statusSource: {
      requestStatus:
        booking.requestStatus ??
        booking.bookingRequestStatus ??
        '',

      paymentStatus:
        booking.paymentStatus ??
        booking.status ??
        '',

      sessionStatus:
        booking.sessionStatus ??
        booking.sessionState ??
        '',
    },
  };
}

export function normalizeBookings(
  bookings,
  options = {},
) {
  if (!Array.isArray(bookings)) {
    return [];
  }

  return bookings
    .map((booking) =>
      normalizeBooking(booking, options),
    )
    .filter(Boolean);
}
