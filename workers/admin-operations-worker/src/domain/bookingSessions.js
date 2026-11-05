import { HttpError, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

export const BOOKING_SESSION_ACTIONS = Object.freeze({
  CHECK_IN: 'check_in',
  START: 'start',
  COMPLETE: 'complete',
  NO_SHOW: 'no_show',
});

export const BOOKING_NO_SHOW_GRACE_MINUTES = 15;

function currentSessionStatus(booking) {
  const value = cleanText(booking.sessionStatus || booking.sessionState, 40).toLowerCase().replace(/[-\s]+/g, '_');
  if (['upcoming', 'scheduled'].includes(value)) return 'upcoming';
  if (['in_progress', 'active', 'ongoing'].includes(value)) return 'in_progress';
  if (['completed', 'complete', 'finished', 'done'].includes(value)) return 'completed';
  if (['no_show', 'noshow', 'absent'].includes(value)) return 'no_show';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  const requestStatus = cleanText(booking.requestStatus || booking.bookingRequestStatus, 40).toLowerCase();
  return ['rejected', 'cancelled', 'canceled'].includes(requestStatus) ? 'cancelled' : 'upcoming';
}

function getScheduledStartTimestamp(booking) {
  const date = cleanText(booking.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsedDate = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  let startMinute;
  const startHour = Number(booking.startHour);
  if (Number.isFinite(startHour) && Number.isInteger(startHour) && startHour >= 0 && startHour < 24) {
    startMinute = startHour * 60;
  } else {
    const match = cleanText(booking.startTimeLabel || booking.startTime, 20).match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    startMinute = hour * 60 + minute;
  }
  return parsedDate.getTime() + startMinute * 60_000;
}

function validateNoShowEligibility(booking, now) {
  const scheduledStart = getScheduledStartTimestamp(booking);
  if (scheduledStart === null) {
    throw new HttpError(400, 'invalid_booking_schedule', 'Tanggal dan jam mulai booking harus valid sebelum no-show dicatat.');
  }
  const eligibleAt = scheduledStart + BOOKING_NO_SHOW_GRACE_MINUTES * 60_000;
  if (now.getTime() < eligibleAt) {
    throw new HttpError(409, 'no_show_grace_not_elapsed', 'No-show baru dapat dicatat 15 menit setelah jam mulai booking.', { eligibleAt: new Date(eligibleAt).toISOString() });
  }
}

function buildSessionEvent({ actor, action, booking, eventId, fromStatus, reason, timestamp, toStatus }) {
  return {
    action,
    actorName: cleanText(actor.displayName || 'Admin Studio', 120),
    actorUid: cleanText(actor.uid, 128),
    bookingId: booking.id,
    createdAt: timestamp,
    fromStatus,
    id: eventId,
    reason: cleanText(reason, 600),
    toStatus,
    type: 'booking-session-event',
  };
}

export async function recordBookingSessionAction({ actor, body, firestore, request, now = new Date() }) {
  const key = getIdempotencyKey(request, body);
  const bookingId = cleanText(body.bookingId || body.id, 160);
  const action = cleanText(body.action, 40).toLowerCase();
  const reason = cleanText(body.reason, 600);
  if (!bookingId) throw new HttpError(400, 'booking_id_required', 'Booking ID wajib tersedia.');
  if (!Object.values(BOOKING_SESSION_ACTIONS).includes(action)) {
    throw new HttpError(400, 'invalid_session_action', 'Aksi sesi tidak dikenal.');
  }
  if (action === BOOKING_SESSION_ACTIONS.NO_SHOW && reason.length < 4) {
    throw new HttpError(400, 'session_reason_required', 'Alasan no-show wajib diisi minimal 4 karakter.');
  }

  const type = 'booking-session-action';
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const current = await firestore.getDocument('bookings', bookingId);
  if (!current) throw new HttpError(404, 'booking_not_found', 'Booking tidak ditemukan.');
  const booking = { id: current.id, ...current.data };
  const fromStatus = currentSessionStatus(booking);
  if (['completed', 'no_show', 'cancelled'].includes(fromStatus)) {
    throw new HttpError(409, 'session_terminal', 'Sesi sudah berada pada status akhir dan tidak menerima aksi operasional baru.');
  }
  if (action === BOOKING_SESSION_ACTIONS.CHECK_IN && booking.checkedInAt) {
    throw new HttpError(409, 'already_checked_in', 'Customer sudah tercatat check-in.');
  }
  if (action === BOOKING_SESSION_ACTIONS.NO_SHOW && booking.checkedInAt) {
    throw new HttpError(409, 'checked_in_cannot_be_no_show', 'Customer sudah check-in sehingga tidak dapat ditandai no-show.');
  }

  const timestamp = now.toISOString();
  const nextBooking = { ...booking, updatedAt: timestamp };
  let toStatus = fromStatus;
  if (action === BOOKING_SESSION_ACTIONS.CHECK_IN) {
    if (fromStatus !== 'upcoming') throw new HttpError(409, 'invalid_session_transition', 'Check-in hanya dapat dicatat sebelum sesi dimulai.');
    nextBooking.checkedInAt = timestamp;
    nextBooking.checkedInByUid = actor.uid;
    nextBooking.checkedInByName = cleanText(actor.displayName || 'Admin Studio', 120);
  } else if (action === BOOKING_SESSION_ACTIONS.START) {
    if (fromStatus !== 'upcoming') throw new HttpError(409, 'invalid_session_transition', 'Sesi hanya dapat dimulai dari status Akan Datang.');
    nextBooking.sessionStatus = 'in_progress';
    nextBooking.actualStartAt = timestamp;
    nextBooking.actualStartByUid = actor.uid;
    nextBooking.actualStartByName = cleanText(actor.displayName || 'Admin Studio', 120);
    toStatus = 'in_progress';
  } else if (action === BOOKING_SESSION_ACTIONS.COMPLETE) {
    if (fromStatus !== 'in_progress') throw new HttpError(409, 'invalid_session_transition', 'Selesaikan sesi hanya dapat dilakukan setelah sesi dimulai.');
    const actualStart = new Date(booking.actualStartAt || '');
    if (Number.isNaN(actualStart.getTime())) throw new HttpError(409, 'session_start_missing', 'Waktu mulai aktual tidak tersedia.');
    const actualDurationMinutes = Math.max(1, Math.round((now.getTime() - actualStart.getTime()) / 60_000));
    nextBooking.sessionStatus = 'completed';
    nextBooking.actualEndAt = timestamp;
    nextBooking.actualEndByUid = actor.uid;
    nextBooking.actualEndByName = cleanText(actor.displayName || 'Admin Studio', 120);
    nextBooking.actualDurationMinutes = actualDurationMinutes;
    toStatus = 'completed';
  } else if (action === BOOKING_SESSION_ACTIONS.NO_SHOW) {
    if (fromStatus !== 'upcoming') throw new HttpError(409, 'invalid_session_transition', 'No-show hanya dapat dicatat sebelum sesi dimulai.');
    validateNoShowEligibility(booking, now);
    nextBooking.sessionStatus = 'no_show';
    nextBooking.noShowAt = timestamp;
    nextBooking.noShowByUid = actor.uid;
    nextBooking.noShowByName = cleanText(actor.displayName || 'Admin Studio', 120);
    nextBooking.noShowReason = reason;
    toStatus = 'no_show';
  }

  const eventId = await stableDocumentId('booking-session-event', bookingId + ':' + key);
  const event = buildSessionEvent({ actor, action, booking, eventId, fromStatus, reason, timestamp, toStatus });
  nextBooking.lastSessionEventAt = timestamp;
  nextBooking.lastSessionEventType = action;
  nextBooking.lastSessionEventId = eventId;
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      booking: { collectionId: 'bookings', documentId: bookingId },
      event: { collectionId: 'bookingSessionEvents', documentId: eventId },
    },
    firestore,
    key,
    receipt: {},
    result: { booking: nextBooking, event },
    targetId: bookingId,
    type,
    writes: [
      firestore.setWrite('bookings', bookingId, nextBooking, { updateTime: current.updateTime }),
      firestore.setWrite('bookingSessionEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
