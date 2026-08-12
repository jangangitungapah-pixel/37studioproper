import {
  getBookingRequestStatus,
  isBookingCancelled,
} from './bookingSelectors.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  submitted: Object.freeze(['confirmed', 'rejected']),
  cancellation_requested: Object.freeze(['cancelled', 'confirmed']),
});

const REASON_REQUIRED_STATUSES = Object.freeze([
  'rejected',
  'cancelled',
]);

function cleanText(value) {
  return String(value || '').trim();
}

function timestampKey(value) {
  if (!value) return '';

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (Number.isFinite(value?.seconds)) {
    return `${value.seconds}:${Number(value.nanoseconds) || 0}`;
  }

  return cleanText(value);
}

function hashText(value) {
  let hash = 2166136261;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function requiresBookingDecisionReason(status) {
  return REASON_REQUIRED_STATUSES.includes(status);
}

export function isNoDurationPackageBooking(booking) {
  const hasPackage =
    Boolean(
      booking?.packageId &&
      booking.packageId !== 'none',
    ) ||
    booking?.pricingMode === 'package';

  return (
    hasPackage &&
    Number(
      booking?.durationHours ??
      booking?.duration ??
      0,
    ) <= 0
  );
}

export function getBookingDecisionWindow(booking) {
  if (isNoDurationPackageBooking(booking)) {
    return null;
  }

  const start = Number(booking?.startHour);
  const duration = Number(
    booking?.durationHours ??
    booking?.duration,
  );

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(duration) ||
    start < 0 ||
    start >= 24 ||
    duration <= 0
  ) {
    return null;
  }

  const end = start + duration;

  if (end > 24) return null;

  return {
    end,
    start,
  };
}

export function doBookingDecisionWindowsOverlap(
  firstBooking,
  secondBooking,
) {
  if (
    cleanText(firstBooking?.date) !==
    cleanText(secondBooking?.date)
  ) {
    return false;
  }

  const first =
    getBookingDecisionWindow(firstBooking);
  const second =
    getBookingDecisionWindow(secondBooking);

  if (!first || !second) return false;

  // A session ending exactly when another begins is intentionally valid.
  return (
    Math.max(first.start, second.start) <
    Math.min(first.end, second.end)
  );
}

function isScheduleBlockingBooking(booking) {
  if (
    !booking ||
    isNoDurationPackageBooking(booking) ||
    isBookingCancelled(booking)
  ) {
    return false;
  }

  return ![
    'draft',
    'submitted',
    'rejected',
    'cancelled',
  ].includes(
    getBookingRequestStatus(booking),
  );
}

export function findBookingDecisionConflict(
  booking,
  currentBookings = [],
) {
  return (
    (Array.isArray(currentBookings)
      ? currentBookings
      : [])
      .filter(
        (candidate) =>
          candidate?.id !== booking?.id &&
          isScheduleBlockingBooking(candidate),
      )
      .find(
        (candidate) =>
          doBookingDecisionWindowsOverlap(
            booking,
            candidate,
          ),
      ) || null
  );
}

function getCompletenessIssue(booking) {
  if (!cleanText(booking?.customer)) {
    return 'Customer wajib tersedia sebelum booking dikonfirmasi.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(booking?.date))) {
    return 'Tanggal booking belum valid.';
  }

  if (!Number.isFinite(Number(booking?.startHour))) {
    return 'Jam mulai booking belum valid.';
  }

  const service = cleanText(
    booking?.sessionLabel ||
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.title ||
    booking?.serviceId ||
    booking?.packageId ||
    booking?.recordingTypeId,
  );

  if (!service) {
    return 'Layanan booking wajib dipilih sebelum dikonfirmasi.';
  }

  if (
    !isNoDurationPackageBooking(booking) &&
    !getBookingDecisionWindow(booking)
  ) {
    return 'Durasi booking belum valid.';
  }

  return '';
}

export function validateBookingDecision({
  booking,
  currentBookings = [],
  reason = '',
  status,
} = {}) {
  if (!booking?.id) {
    return {
      code: 'invalid-booking',
      message: 'Data booking belum lengkap.',
      ok: false,
    };
  }

  const currentStatus =
    getBookingRequestStatus(booking);
  const allowed =
    ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(status)) {
    return {
      code: 'invalid-transition',
      message:
        'Request ini sudah berubah dan tidak dapat diproses dengan aksi tersebut.',
      ok: false,
    };
  }

  if (
    requiresBookingDecisionReason(status) &&
    cleanText(reason).length < 4
  ) {
    return {
      code: 'reason-required',
      message: 'Masukkan alasan minimal 4 karakter.',
      ok: false,
    };
  }

  if (status === 'confirmed') {
    const completenessIssue =
      getCompletenessIssue(booking);

    if (completenessIssue) {
      return {
        code: 'incomplete-booking',
        message: completenessIssue,
        ok: false,
      };
    }

    const conflict =
      findBookingDecisionConflict(
        booking,
        currentBookings,
      );

    if (conflict) {
      const conflictName =
        cleanText(
          conflict.customer ||
          conflict.title ||
          conflict.sessionLabel,
        ) || 'booking lain';

      return {
        code: 'schedule-conflict',
        conflict,
        message:
          `Jadwal bentrok dengan ${conflictName} pada tanggal dan rentang waktu yang sama.`,
        ok: false,
      };
    }
  }

  return {
    code: 'ok',
    ok: true,
  };
}

export function buildBookingDecisionKey({
  booking,
  status,
} = {}) {
  const requestVersion =
    timestampKey(
      booking?.clientRequestUpdatedAt ||
      booking?.lastMessageAt ||
      booking?.updatedAt ||
      booking?.createdAt,
    ) || 'legacy';

  const source = [
    cleanText(booking?.id),
    getBookingRequestStatus(booking),
    cleanText(status),
    requestVersion,
  ].join('|');

  return `booking-decision-${hashText(source)}`;
}

export function buildBookingDecisionPatch({
  actor,
  decisionKey,
  note,
  status,
  timestamp,
} = {}) {
  const patch = {
    adminResponseAt: timestamp,
    adminResponseBy: cleanText(actor?.uid),
    adminResponseNote: cleanText(note),
    bookingRequestStatus: status,
    lastRequestDecisionKey: decisionKey,
    requestStatus: status,
    updatedAt: timestamp,
  };

  // Session cancellation is separate from request/payment state. Payment
  // fields are deliberately never touched by a request decision.
  if (status === 'cancelled') {
    patch.sessionStatus = 'cancelled';
  }

  return patch;
}
