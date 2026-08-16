import { HttpError, cleanMoney, cleanText, getIdempotencyKey } from '../lib/http.js';
import { stableDocumentId } from '../lib/firestore.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';

const PAYMENT_METHODS = new Set(['cash', 'transfer', 'qris', 'other']);
const CANCELLED_STATES = new Set(['cancelled', 'canceled', 'rejected', 'deleted']);

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

function isCancelled(booking) {
  return [
    booking.bookingRequestStatus,
    booking.sessionStatus,
    booking.status,
  ].some((value) => CANCELLED_STATES.has(cleanText(value, 40).toLowerCase()));
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
    if (isCancelled(row.data)) return false;
    const otherStart = Number(row.data.startHour);
    const otherDuration = Number(row.data.durationHours || row.data.duration || 0);
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherDuration) || otherDuration <= 0) return false;
    return start < otherStart + otherDuration && end > otherStart;
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
