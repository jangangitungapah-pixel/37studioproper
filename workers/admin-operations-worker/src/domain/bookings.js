import { HttpError, cleanMoney, cleanText, getIdempotencyKey } from '../lib/http.js';
import { stableDocumentId } from '../lib/firestore.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';

const PAYMENT_METHODS = new Set(['cash', 'transfer', 'qris', 'other']);
const CANCELLED_STATES = new Set(['cancelled', 'canceled', 'rejected', 'deleted']);
const NON_BLOCKING_REQUEST_STATES = new Set(['draft', 'submitted', 'rejected', 'cancelled', 'canceled', 'deleted']);
const BOOKING_DECISION_TRANSITIONS = Object.freeze({
  submitted: new Set(['confirmed', 'rejected']),
  cancellation_requested: new Set(['cancelled', 'confirmed']),
});

function cleanDate(value) {
  const date = cleanText(value, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'invalid_date', 'Tanggal booking tidak valid.');
  }
  return date;
}

function cleanNumber(value, minimum, maximum, code, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new HttpError(400, code, message);
  }
  return number;
}

function paymentMethod(value) {
  const method = cleanText(value, 20).toLowerCase();
  if (!PAYMENT_METHODS.has(method)) {
    throw new HttpError(400, 'invalid_payment_method', 'Metode wajib cash, transfer, qris, atau other.');
  }
  return method;
}

function normalizeStatus(value) {
  return cleanText(value, 40).toLowerCase().replace(/[-\\s]+/g, '_');
}

function requestStatus(booking) {
  const value = booking?.requestStatus || booking?.bookingRequestStatus;
  return normalizeStatus(value || (booking?.source === 'clientPortal' ? 'submitted' : 'confirmed'));
}

function isCancelled(booking) {
  const values = [
    booking?.requestStatus,
    booking?.bookingRequestStatus,
    booking?.sessionStatus,
    booking?.status,
    booking?.paymentStatusCanonical,
    booking?.paymentStatus,
  ];
  return values.some((value) => {
    const status = normalizeStatus(value);
    return CANCELLED_STATES.has(status) || status === 'void';
  });
}

function isScheduleBlockingBooking(booking) {
  if (!booking || isCancelled(booking)) return false;
  return !NON_BLOCKING_REQUEST_STATES.has(requestStatus(booking));
}

function isValidStartHour(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !/^\\d+$/.test(value.trim()))
  ) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number < 24;
}

function isValidDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 && duration <= 24;
}

function isNoDurationPackage(booking) {
  const hasPackage = Boolean(booking?.packageId && booking.packageId !== 'none')
    || booking?.pricingMode === 'package';
  return hasPackage && Number(booking?.durationHours ?? booking?.duration ?? 0) <= 0;
}

function scheduleWindow(booking) {
  if (isNoDurationPackage(booking)) return null;
  const start = Number(booking?.startHour);
  const duration = Number(booking?.durationHours ?? booking?.duration);
  if (
    !isValidStartHour(booking?.startHour) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 24 ||
    start + duration > 24
  ) return null;
  return { end: start + duration, start };
}

async function assertSlotAvailable(firestore, booking) {
  if (booking.durationHours === 0) return;
  const rows = await firestore.runQuery({
    from: [{ collectionId: 'bookings' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'date' },
        op: 'EQUAL',
        value: { stringValue: booking.date },
      },
    },
  });
  const start = booking.startHour;
  const end = start + booking.durationHours;
  const conflict = rows.find((row) => {
    if (!isScheduleBlockingBooking(row.data)) return false;
    const window = scheduleWindow(row.data);
    if (!window) return false;
    return start < window.end && end > window.start;
  });

  if (conflict) {
    throw new HttpError(409, 'booking_conflict', 'Slot bertabrakan dengan booking lain.', {
      bookingId: conflict.id,
    });
  }
}

function buildBooking(body, actor, key) {
  const id = cleanText(body.id, 160);
  if (!id) throw new HttpError(400, 'booking_id_required', 'Booking ID wajib tersedia.');
  const customer = cleanText(body.customer, 120);
  if (!customer) throw new HttpError(400, 'customer_required', 'Nama customer wajib diisi.');
  const date = cleanDate(body.date);
  const startHour = cleanNumber(body.startHour, 0, 23, 'invalid_start_hour', 'Jam mulai booking tidak valid.');
  const durationHours = cleanNumber(body.durationHours, 0, 24, 'invalid_duration', 'Durasi booking tidak valid.');
  const pricingMode = cleanText(body.pricingMode || 'session', 40);
  if (durationHours === 0 && pricingMode !== 'package') {
    throw new HttpError(400, 'duration_required', 'Durasi booking harus lebih dari 0 jam.');
  }
  if (startHour + durationHours > 24) {
    throw new HttpError(400, 'booking_outside_day', 'Waktu selesai booking melewati batas hari.');
  }

  const total = cleanMoney(body.total);
  const requestedPayment = Array.isArray(body.paymentHistory) ? body.paymentHistory[0] : null;
  const initialAmount = cleanMoney(requestedPayment?.amount ?? body.paidAmount ?? body.dpAmount);
  if (initialAmount > total) {
    throw new HttpError(400, 'amount_exceeds_total', 'Pembayaran awal melebihi total booking.');
  }

  const now = new Date().toISOString();
  const method = initialAmount > 0
    ? paymentMethod(requestedPayment?.method || body.paymentMethod || body.lastPaymentMethod)
    : '';
  const payment = initialAmount > 0 ? {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: initialAmount,
    createdAt: now,
    date: now.slice(0, 10),
    id: `payment_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method,
    note: cleanText(requestedPayment?.note || 'Pembayaran awal booking', 600),
    source: 'manual-booking-create',
  } : null;
  const paymentStatus = total > 0 && initialAmount >= total
    ? 'lunas'
    : initialAmount > 0 ? 'dp' : 'pending';
  const canonicalStatus = paymentStatus === 'lunas' ? 'paid' : paymentStatus === 'dp' ? 'partial' : 'unpaid';
  const bookingCode = cleanText(body.bookingCode || body.bookingId, 120) || `BKG-${id}`;
  const invoiceNumber = cleanText(body.invoiceNumber, 120) || `INV-${bookingCode.replace(/^BKG-/, '')}`;

  return {
    appliedDiscounts: Array.isArray(body.appliedDiscounts) ? body.appliedDiscounts.slice(0, 50) : [],
    bandName: cleanText(body.bandName, 120),
    bookingCode,
    bookingId: bookingCode,
    bookingRequestStatus: 'confirmed',
    clientUid: cleanText(body.clientUid, 128),
    createdAt: now,
    customer,
    customerId: cleanText(body.customerId, 160),
    customerIdentityMode: cleanText(body.customerIdentityMode, 60),
    customerPhoneKey: cleanText(body.customerPhoneKey, 32),
    date,
    discountAmount: cleanMoney(body.discountAmount),
    dpAmount: paymentStatus === 'dp' ? initialAmount : 0,
    durationHours,
    email: cleanText(body.email, 254),
    id,
    invoiceAmount: Math.max(0, total - initialAmount),
    invoiceNumber,
    lastPaymentAt: payment?.createdAt || '',
    lastPaymentMethod: method,
    packageId: cleanText(body.packageId, 80),
    packageLabel: cleanText(body.packageLabel, 160),
    paidAmount: initialAmount,
    paymentHistory: payment ? [payment] : [],
    paymentMethod: method,
    paymentStatus,
    paymentStatusCanonical: canonicalStatus,
    pricingMode,
    recordingTypeId: cleanText(body.recordingTypeId, 80),
    recordingTypeLabel: cleanText(body.recordingTypeLabel, 160),
    refundHistory: [],
    refundedAmount: 0,
    sessionLabel: cleanText(body.sessionLabel || 'Sesi Studio', 160),
    sessionStatus: 'scheduled',
    sessionType: cleanText(body.sessionType || 'session', 80),
    source: 'admin',
    startHour,
    startTimeLabel: cleanText(body.startTimeLabel, 40),
    status: paymentStatus,
    subtotal: cleanMoney(body.subtotal ?? total),
    title: cleanText(body.title || body.bandName || body.sessionLabel || 'Sesi Studio', 160),
    total,
    updatedAt: now,
  };
}

async function initialLedgerWrite({ actor, booking, firestore, payment }) {
  if (!payment) return null;
  const id = await stableDocumentId('ledger', `booking-payment:${booking.id}:${payment.idempotencyKey}`);
  return firestore.setWrite('bookkeepingEntries', id, {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: payment.amount,
    category: 'booking',
    createdAt: payment.createdAt,
    date: payment.date,
    id,
    idempotencyKey: payment.idempotencyKey,
    immutable: true,
    note: payment.note,
    paymentMethod: payment.method,
    reversalOf: '',
    source: 'booking-payment',
    sourceAction: 'payment',
    sourceBookingId: booking.id,
    sourceEventId: payment.id,
    title: `Pembayaran ${booking.invoiceNumber}`,
    type: 'income',
    updatedAt: payment.createdAt,
  }, { exists: false });
}

export async function createManualBooking({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'manual-booking-create', key);
  if (existing.result) return { ...existing.result, duplicate: true };
  const booking = buildBooking(body, actor, key);
  const scheduleDay = await firestore.getDocument('bookingScheduleDays', booking.date);
  await assertSlotAvailable(firestore, booking);

  const writes = [
    firestore.setWrite('bookings', booking.id, booking, { exists: false }),
    firestore.setWrite('bookingScheduleDays', booking.date, {
      date: booking.date,
      lastBookingId: booking.id,
      revision: Number(scheduleDay?.data?.revision || 0) + 1,
      updatedAt: booking.updatedAt,
    }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false }),
  ];
  if (booking.durationHours > 0) {
    writes.push(firestore.setWrite('clientCalendarSlots', booking.id, {
      bookingId: booking.id,
      date: booking.date,
      durationHours: booking.durationHours,
      sessionLabel: 'Sesi Studio',
      startHour: booking.startHour,
      status: booking.paymentStatus,
      title: 'Terisi',
      updatedAt: booking.updatedAt,
    }, { exists: false }));
  }
  const ledger = await initialLedgerWrite({ actor, booking, firestore, payment: booking.paymentHistory[0] });
  if (ledger) writes.push(ledger);

  const result = { booking };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: 'bookings', documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: {},
    targetId: booking.id,
    type: 'manual-booking-create',
    writes,
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

function requestDecisionIssue(booking, status, reason) {
  if (!booking?.id) {
    throw new HttpError(400, 'invalid_booking', 'Data booking belum lengkap.');
  }

  const currentStatus = requestStatus(booking);
  if (!BOOKING_DECISION_TRANSITIONS[currentStatus]?.has(status)) {
    throw new HttpError(409, 'invalid_booking_transition', 'Request ini sudah berubah dan tidak dapat diproses dengan aksi tersebut.');
  }

  if (['rejected', 'cancelled'].includes(status) && cleanText(reason, 600).length < 4) {
    throw new HttpError(400, 'booking_reason_required', 'Masukkan alasan minimal 4 karakter.');
  }

  if (status === 'confirmed') {
    if (!cleanText(booking.customer, 120)) {
      throw new HttpError(400, 'incomplete_booking', 'Customer wajib tersedia sebelum booking dikonfirmasi.');
    }
    try {
      cleanDate(booking.date);
    } catch {
      throw new HttpError(400, 'invalid_date', 'Tanggal booking belum valid.');
    }
    if (!isValidStartHour(booking.startHour)) {
      throw new HttpError(400, 'invalid_start_hour', 'Jam mulai booking belum valid.');
    }
    const service = cleanText(
      booking.sessionLabel || booking.packageLabel || booking.recordingTypeLabel
        || booking.title || booking.serviceId || booking.packageId || booking.recordingTypeId,
      160,
    );
    if (!service) {
      throw new HttpError(400, 'incomplete_booking', 'Layanan booking wajib dipilih sebelum dikonfirmasi.');
    }
    const window = scheduleWindow(booking);
    if (!window && !isNoDurationPackage(booking)) {
      throw new HttpError(400, 'invalid_duration', 'Durasi booking belum valid.');
    }
  }
}

async function listBookingsForDate(firestore, date) {
  return firestore.runQuery({
    from: [{ collectionId: 'bookings' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'date' },
        op: 'EQUAL',
        value: { stringValue: date },
      },
    },
  });
}

async function assertDecisionSlotAvailable(firestore, booking) {
  if (isNoDurationPackage(booking)) return;
  const window = scheduleWindow(booking);
  if (!window) {
    throw new HttpError(400, 'invalid_booking_window', 'Rentang waktu booking belum valid.');
  }
  const rows = await listBookingsForDate(firestore, booking.date);
  const conflict = rows.find((row) => {
    if (row.id === booking.id || !isScheduleBlockingBooking(row.data)) return false;
    const other = scheduleWindow(row.data);
    if (!other) return false;
    return window.start < other.end && window.end > other.start;
  });

  if (conflict) {
    throw new HttpError(409, 'booking_conflict', 'Jadwal bentrok dengan booking lain pada rentang waktu yang sama.', {
      bookingId: conflict.id,
    });
  }
}

function decisionMessage({ actor, booking, decisionKey, note, timestamp }) {
  return {
    id: `request-${decisionKey}`,
    bookingId: booking.id,
    clientUid: cleanText(booking.clientUid, 128),
    senderUid: cleanText(actor.uid, 128),
    senderRole: 'admin',
    senderName: cleanText(actor.displayName || 'Admin Studio', 120),
    text: cleanText(note, 600),
    type: 'status',
    createdAt: timestamp,
    readByAdmin: true,
    readByClient: false,
  };
}

function decisionBookingPatch({ actor, decisionKey, message, note, status, timestamp }) {
  const patch = {
    adminResponseAt: timestamp,
    adminResponseBy: cleanText(actor.uid, 128),
    adminResponseNote: cleanText(note, 600),
    bookingRequestStatus: status,
    requestStatus: status,
    lastRequestDecisionKey: decisionKey,
    lastMessageId: message.id,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.text.slice(0, 180),
    lastMessageSenderRole: message.senderRole,
    lastMessageReadByAdmin: message.readByAdmin,
    lastMessageReadByClient: message.readByClient,
    updatedAt: timestamp,
  };

  if (status === 'cancelled') patch.sessionStatus = 'cancelled';
  return patch;
}

function clientCalendarSlot(booking, timestamp) {
  const window = scheduleWindow(booking);
  if (!window || !isScheduleBlockingBooking(booking)) return null;
  return {
    bookingId: booking.id,
    date: booking.date,
    durationHours: Number(booking.durationHours ?? booking.duration),
    sessionLabel: cleanText(booking.sessionLabel || 'Sesi Studio', 160),
    startHour: Number(booking.startHour),
    status: cleanText(booking.paymentStatus || booking.status || 'pending', 40),
    title: cleanText(booking.sessionLabel || 'Terisi', 160),
    updatedAt: timestamp,
  };
}

export async function decideBookingRequest({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'booking-request-decision', key);
  if (existing.result) return { ...existing.result, duplicate: true, alreadyApplied: true };

  const bookingId = cleanText(body.bookingId || body.id, 160);
  const status = cleanText(body.status, 40).toLowerCase();
  const note = cleanText(body.note, 600);
  const decisionKey = cleanText(body.decisionKey || key, 180);
  if (!bookingId) throw new HttpError(400, 'booking_id_required', 'Booking ID wajib tersedia.');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await firestore.getDocument('bookings', bookingId);
    if (!current) throw new HttpError(404, 'booking_not_found', 'Booking sudah tidak tersedia.');
    const booking = { id: current.id, ...current.data };
    requestDecisionIssue(booking, status, note);

    const dateIsValid = /^\\d{4}-\\d{2}-\\d{2}$/.test(cleanText(booking.date, 10))
      && !Number.isNaN(new Date(`${cleanText(booking.date, 10)}T00:00:00.000Z`).getTime())
      && new Date(`${cleanText(booking.date, 10)}T00:00:00.000Z`).toISOString().slice(0, 10) === cleanText(booking.date, 10);
    const date = dateIsValid ? cleanText(booking.date, 10) : '';
    const scheduleDay = date ? await firestore.getDocument('bookingScheduleDays', date) : null;

    if (status === 'confirmed') await assertDecisionSlotAvailable(firestore, booking);

    const timestamp = new Date().toISOString();
    const message = decisionMessage({ actor, booking, decisionKey, note, timestamp });
    const updatedBooking = {
      ...booking,
      ...decisionBookingPatch({ actor, decisionKey, message, note, status, timestamp }),
    };
    const publicSlot = status === 'confirmed' ? clientCalendarSlot(updatedBooking, timestamp) : null;
    const writes = [
      firestore.setWrite('bookings', bookingId, updatedBooking, { updateTime: current.updateTime }),
      firestore.setWrite('bookingMessages', message.id, message, { exists: false }),
    ];

    if (date) {
      writes.push(firestore.setWrite('bookingScheduleDays', date, {
        date,
        lastBookingId: bookingId,
        revision: Number(scheduleDay?.data?.revision || 0) + 1,
        updatedAt: timestamp,
      }, scheduleDay ? { updateTime: scheduleDay.updateTime } : { exists: false }));
    }

    if (publicSlot) {
      const oldSlot = await firestore.getDocument('clientCalendarSlots', bookingId);
      writes.push(firestore.setWrite('clientCalendarSlots', bookingId, publicSlot,
        oldSlot ? { updateTime: oldSlot.updateTime } : { exists: false }));
    } else {
      const oldSlot = await firestore.getDocument('clientCalendarSlots', bookingId);
      if (oldSlot) writes.push(firestore.deleteWrite('clientCalendarSlots', bookingId, { updateTime: oldSlot.updateTime }));
    }

    try {
      const committed = await commitIdempotentOperation({
        actor,
        documentRefs: {
          booking: { collectionId: 'bookings', documentId: bookingId },
          message: { collectionId: 'bookingMessages', documentId: message.id },
        },
        firestore,
        key,
        receipt: { decisionKey, status },
        result: { booking: updatedBooking, decisionKey, message, status },
        targetId: bookingId,
        type: 'booking-request-decision',
        writes,
      });
      return { ...committed.result, alreadyApplied: committed.duplicate, duplicate: committed.duplicate };
    } catch (error) {
      if (error?.status === 409 && error?.code === 'operation_conflict' && attempt < 3) continue;
      throw error;
    }
  }

  throw new HttpError(409, 'booking_conflict', 'Jadwal berubah saat request diproses. Muat ulang data dan coba kembali.');
}

