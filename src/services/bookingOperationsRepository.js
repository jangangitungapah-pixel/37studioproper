import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { z } from 'zod';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryPayloadHash,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildBookingDecisionKey,
  findBookingDecisionConflict,
  isNoDurationPackageBooking,
  validateBookingDecision,
} from '../domain/booking/bookingDecision.js';
import { getBookingRequestStatus } from '../domain/booking/bookingSelectors.js';

const MAX_BOOKINGS_PER_DATE = 250;
const PAYMENT_METHODS = new Set(['cash', 'transfer', 'qris', 'other']);
const EDITABLE_BOOKING_FIELDS = new Set([
  'bandName',
  'clientUid',
  'customer',
  'customerId',
  'customerIdentityMode',
  'customerPhoneKey',
  'date',
  'duration',
  'durationHours',
  'email',
  'internalNotes',
  'notes',
  'packageId',
  'packageLabel',
  'pricingMode',
  'recordingTypeId',
  'recordingTypeLabel',
  'sessionLabel',
  'sessionType',
  'startHour',
  'startTimeLabel',
  'title',
]);

const paymentRecordSchema = z.record(z.string(), z.unknown());
const moneyInputSchema = z.union([z.number(), z.string()]);

const manualBookingInputSchema = z.object({
  id: z.string().trim().min(1).max(80),
  customer: z.string().trim().min(1).max(120),
  date: z.string().trim().min(10).max(10),
  startHour: z.union([z.number(), z.string()]),
  durationHours: moneyInputSchema,
  bandName: z.string().max(120).optional(),
  phone: z.string().max(32).optional(),
  packageId: z.string().max(80).optional(),
  packageLabel: z.string().max(160).optional(),
  pricingMode: z.string().max(40).optional(),
  sessionType: z.string().max(80).optional(),
  sessionLabel: z.string().max(160).optional(),
  recordingTypeId: z.string().max(80).optional(),
  recordingTypeLabel: z.string().max(160).optional(),
  title: z.string().max(160).optional(),
  startTimeLabel: z.string().max(40).optional(),
  paymentMethod: z.string().max(20).optional(),
  paymentHistory: z.array(paymentRecordSchema).max(100).optional(),
  paidAmount: moneyInputSchema.optional(),
  lastPaymentAt: z.string().max(40).optional(),
  lastPaymentMethod: z.string().max(40).optional(),
  paymentStatus: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
  subtotal: moneyInputSchema.optional(),
  discountAmount: moneyInputSchema.optional(),
  appliedDiscounts: z.array(z.unknown()).max(50).optional(),
  total: moneyInputSchema,
  dpAmount: moneyInputSchema.optional(),
  invoiceAmount: moneyInputSchema.optional(),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
  expectedUpdatedAt: z.string().max(40).optional(),
  customerId: z.string().max(160).optional(),
  customerPhoneKey: z.string().max(32).optional(),
  email: z.string().max(254).optional(),
  clientUid: z.string().max(128).optional(),
  customerIdentityMode: z.string().max(60).optional(),
  bookingCode: z.string().max(120).optional(),
  bookingId: z.string().max(120).optional(),
  invoiceNumber: z.string().max(120).optional(),
  duration: moneyInputSchema.optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
}).strict();

const decisionInputSchema = z.object({
  bookingId: z.string().trim().min(1).max(160),
  status: z.enum(['confirmed', 'rejected', 'cancelled']),
  note: z.string().max(600).default(''),
  decisionKey: z.string().min(8).max(128).optional(),
}).strict();

const sessionActionInputSchema = z.object({
  bookingId: z.string().trim().min(1).max(160),
  action: z.enum(['check_in', 'start', 'complete', 'no_show']),
  reason: z.string().max(600).default(''),
}).strict();

function requireFirestore() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

async function readCompletedOperation({ actorUid, scope, action, requestId, payload }) {
  const operationId = await createRepositoryOperationId({ actorUid, scope, action, requestId });
  const markerRef = doc(firestoreDb, 'users', actorUid, 'repositoryOperations', operationId);
  const markerSnapshot = await getDoc(markerRef);
  if (!markerSnapshot.exists()) return null;

  const marker = markerSnapshot.data();
  const payloadHash = await createRepositoryPayloadHash(payload);
  if (
    marker.operationId !== operationId ||
    marker.actorUid !== actorUid ||
    marker.scope !== scope ||
    marker.action !== action ||
    marker.requestId !== requestId ||
    marker.payloadHash !== payloadHash ||
    marker.resultCollection !== 'bookings' ||
    !marker.resultId
  ) {
    throw operationError('idempotency_conflict', 'Request ID sudah digunakan dengan payload atau target yang berbeda.');
  }

  const resultSnapshot = await getDoc(doc(firestoreDb, marker.resultCollection, marker.resultId));
  if (!resultSnapshot.exists()) {
    throw operationError('idempotency_result_missing', 'Marker operasi ditemukan tetapi hasil booking tidak tersedia. Hubungi Owner sebelum mencoba ulang.');
  }

  return {
    operationId,
    booking: { id: resultSnapshot.id, ...resultSnapshot.data() },
  };
}

function operationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cleanText(value, maxLength = 600) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw operationError('invalid_amount', 'Nominal booking tidak valid.');
  }
  return Math.round(number);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date) {
    throw operationError('invalid_date', 'Tanggal booking tidak valid.');
  }
  return date;
}

function cleanStartHour(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !/^\d+$/.test(value.trim()))) {
    throw operationError('invalid_start_hour', 'Jam mulai booking harus berupa jam bulat antara 00 dan 23.');
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 23) {
    throw operationError('invalid_start_hour', 'Jam mulai booking harus berupa jam bulat antara 00 dan 23.');
  }
  return number;
}

function cleanDuration(value, pricingMode, startHour) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0 || duration > 24) {
    throw operationError('invalid_duration', 'Durasi booking tidak valid.');
  }
  if (duration === 0 && pricingMode !== 'package') {
    throw operationError('duration_required', 'Durasi booking harus lebih dari 0 jam.');
  }
  if (startHour + duration > 24) {
    throw operationError('booking_outside_day', 'Waktu selesai booking melewati batas hari.');
  }
  return duration;
}

async function resolveActor({ permission = '', clientOnly = false } = {}) {
  requireFirestore();
  const authUser = firebaseAuth?.currentUser;
  if (!authUser?.uid) throw operationError('authentication_required', 'Sesi Firebase Authentication diperlukan.');

  const [profileSnapshot, ownershipSnapshot] = await Promise.all([
    getDoc(doc(firestoreDb, 'users', authUser.uid)),
    getDoc(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : null;
  const ownershipControl = ownershipSnapshot.exists() ? ownershipSnapshot.data() : null;
  const principal = buildRepositoryPrincipal({
    authUid: authUser.uid,
    userProfile: profileData ? { ...profileData, uid: profileData.uid || authUser.uid } : null,
    ownershipControl,
  });

  if (!principal.active) throw operationError('account_not_active', 'Akun Firebase belum aktif atau belum disetujui.');
  if (clientOnly && !principal.isClient) {
    throw operationError('client_role_required', 'Operasi ini hanya tersedia untuk akun Client.');
  }
  if (permission && !principal.hasPermission(permission)) {
    throw operationError('permission_denied', 'Akun tidak memiliki izin Schedule untuk operasi ini.');
  }

  return {
    uid: authUser.uid,
    displayName: cleanText(authUser.displayName || profileData?.displayName || 'Admin Studio', 120),
    email: cleanText(authUser.email || profileData?.email || '', 254),
    role: principal.role,
    principal,
  };
}

function isScheduleBlockingBooking(booking) {
  if (!booking) return false;
  const normalized = [
    booking.requestStatus,
    booking.bookingRequestStatus,
    booking.sessionStatus,
    booking.status,
    booking.paymentStatusCanonical,
    booking.paymentStatus,
  ].map((value) => cleanText(value, 40).toLowerCase().replace(/[-\s]+/g, '_'));

  if (normalized.some((value) => (
    ['cancelled', 'canceled', 'rejected', 'deleted', 'void'].includes(value)
  ))) return false;

  const requestStatus = getBookingRequestStatus(booking);
  return !['draft', 'submitted', 'rejected', 'cancelled', 'canceled', 'deleted'].includes(requestStatus);
}

function buildCalendarSlot(booking, timestamp, { manualCreate = false } = {}) {
  const duration = Number(booking.durationHours ?? booking.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0 ||
      isNoDurationPackageBooking(booking) ||
      !isScheduleBlockingBooking(booking)) {
    return null;
  }

  return {
    bookingId: booking.id,
    date: booking.date,
    durationHours: duration,
    sessionLabel: cleanText(booking.sessionLabel || 'Sesi Studio', 160),
    startHour: Number(booking.startHour),
    status: cleanText(booking.paymentStatus || booking.status || 'pending', 40),
    title: manualCreate ? 'Terisi' : cleanText(booking.sessionLabel || 'Terisi', 160),
    updatedAt: timestamp,
  };
}

async function readSchedulePreflight(dates, queryDate = '') {
  const uniqueDates = [...new Set(dates.filter(Boolean))].sort();
  const daySnapshots = new Map();
  await Promise.all(uniqueDates.map(async (date) => {
    const snapshot = await getDoc(doc(firestoreDb, 'bookingScheduleDays', date));
    const revision = snapshot.exists() ? Number(snapshot.data().revision || 0) : 0;
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw operationError('invalid_schedule_revision', 'Revision kalender tidak valid. Periksa data jadwal sebelum melanjutkan.');
    }
    daySnapshots.set(date, { revision, exists: snapshot.exists() });
  }));

  let bookings = [];
  if (queryDate) {
    const snapshot = await getDocs(query(
      collection(firestoreDb, 'bookings'),
      where('date', '==', queryDate),
      limit(MAX_BOOKINGS_PER_DATE + 1),
    ));
    if (snapshot.size > MAX_BOOKINGS_PER_DATE) {
      throw operationError(
        'schedule_query_limit_reached',
        'Jumlah booking pada tanggal ini melewati batas aman pemeriksaan. Hubungi Owner sebelum mengubah jadwal.',
      );
    }
    bookings = snapshot.docs.map((bookingDoc) => ({
      id: bookingDoc.id,
      ...bookingDoc.data(),
    }));
  }

  return { daySnapshots, bookings };
}

async function readTransactionDays(transaction, dates, preflight) {
  const uniqueDates = [...new Set(dates.filter(Boolean))].sort();
  const snapshots = new Map();
  const references = uniqueDates.map((date) => ({
    date,
    ref: doc(firestoreDb, 'bookingScheduleDays', date),
  }));
  const values = await Promise.all(references.map(({ ref }) => transaction.get(ref)));

  values.forEach((snapshot, index) => {
    const date = references[index].date;
    const expected = preflight.get(date);
    const revision = snapshot.exists() ? Number(snapshot.data().revision || 0) : 0;
    if (!expected || revision !== expected.revision || snapshot.exists() !== expected.exists) {
      throw operationError('schedule_revision_changed', 'Jadwal berubah saat operasi diproses. Sistem sedang meminta pemeriksaan ulang.');
    }
    snapshots.set(date, snapshot);
  });

  return snapshots;
}

function writeScheduleDay(transaction, date, bookingId, timestamp, snapshot) {
  const reference = doc(firestoreDb, 'bookingScheduleDays', date);
  const revision = snapshot.exists() ? Number(snapshot.data().revision || 0) : 0;
  transaction.set(reference, {
    date,
    lastBookingId: bookingId,
    revision: revision + 1,
    updatedAt: timestamp,
  });
}

function assertNoScheduleConflict(candidate, bookings) {
  if (isNoDurationPackageBooking(candidate)) return;
  if (findBookingDecisionConflict(candidate, bookings)) {
    throw operationError('booking_conflict', 'Jadwal bentrok dengan booking lain pada rentang waktu yang sama.');
  }
}

function currentSessionStatus(booking) {
  const requestStatus = getBookingRequestStatus(booking);
  if (requestStatus === 'submitted') return 'pending';
  if (['rejected', 'cancelled'].includes(requestStatus)) return 'cancelled';

  const value = cleanText(booking.sessionStatus || booking.sessionState, 40)
    .toLowerCase().replace(/[-\s]+/g, '_');
  if (['upcoming', 'scheduled'].includes(value)) return 'upcoming';
  if (['in_progress', 'active', 'ongoing'].includes(value)) return 'in_progress';
  if (['completed', 'complete', 'finished', 'done'].includes(value)) return 'completed';
  if (['no_show', 'noshow', 'absent'].includes(value)) return 'no_show';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  return 'upcoming';
}

function getScheduledStartTimestamp(booking) {
  const date = cleanDate(booking.date);
  const parsedDate = new Date(date + 'T00:00:00+07:00');
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
    throw operationError('invalid_booking_schedule', 'Tanggal dan jam mulai booking harus valid sebelum no-show dicatat.');
  }
  const eligibleAt = scheduledStart + (15 * 60_000);
  if (now.getTime() < eligibleAt) {
    throw operationError('no_show_grace_not_elapsed', 'No-show baru dapat dicatat 15 menit setelah jam mulai booking.');
  }
}

function buildManualBooking(input, actor, requestId, operationId, timestamp) {
  const id = input.id;
  const customer = cleanText(input.customer, 120);
  if (!customer) throw operationError('customer_required', 'Nama customer wajib diisi.');

  const date = cleanDate(input.date);
  const startHour = cleanStartHour(input.startHour);
  const pricingMode = cleanText(input.pricingMode || 'session', 40);
  const durationHours = cleanDuration(input.durationHours ?? input.duration, pricingMode, startHour);
  const total = cleanMoney(input.total);
  const requestedPayment = Array.isArray(input.paymentHistory) ? input.paymentHistory[0] : null;
  const initialAmount = cleanMoney(requestedPayment?.amount ?? input.paidAmount ?? input.dpAmount ?? 0);
  if (initialAmount > total) {
    throw operationError('amount_exceeds_total', 'Pembayaran awal melebihi total booking.');
  }

  const method = initialAmount > 0
    ? cleanText(requestedPayment?.method || input.paymentMethod || input.lastPaymentMethod || '', 20).toLowerCase()
    : '';
  if (initialAmount > 0 && !PAYMENT_METHODS.has(method)) {
    throw operationError('invalid_payment_method', 'Metode wajib cash, transfer, qris, atau other.');
  }

  const paymentId = initialAmount > 0 ? 'payment_' + operationId.slice(3, 23) : '';
  const payment = initialAmount > 0 ? {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: initialAmount,
    createdAt: timestamp,
    date: timestamp.slice(0, 10),
    id: paymentId,
    idempotencyKey: requestId,
    method,
    note: cleanText(requestedPayment?.note || 'Pembayaran awal booking', 600),
    source: 'manual-booking-create',
  } : null;

  const paymentStatus = total > 0 && initialAmount >= total
    ? 'lunas'
    : initialAmount > 0 ? 'dp' : 'pending';
  const bookingCode = cleanText(input.bookingCode || input.bookingId, 120) || 'BKG-' + id;
  const invoiceNumber = cleanText(input.invoiceNumber, 120) || 'INV-' + bookingCode.replace(/^BKG-/, '');

  const booking = {
    appliedDiscounts: Array.isArray(input.appliedDiscounts) ? input.appliedDiscounts.slice(0, 50) : [],
    bandName: cleanText(input.bandName, 120),
    bookingCode,
    bookingId: bookingCode,
    bookingRequestStatus: 'confirmed',
    clientUid: cleanText(input.clientUid, 128),
    createdAt: timestamp,
    customer,
    customerId: cleanText(input.customerId, 160),
    customerIdentityMode: cleanText(input.customerIdentityMode, 60),
    customerPhoneKey: cleanText(input.customerPhoneKey, 32),
    date,
    discountAmount: cleanMoney(input.discountAmount || 0),
    dpAmount: paymentStatus === 'dp' ? initialAmount : 0,
    durationHours,
    email: cleanText(input.email, 254),
    id,
    initialPaymentLedgerStatus: payment ? 'pending' : 'not_required',
    invoiceAmount: Math.max(0, total - initialAmount),
    invoiceNumber,
    lastPaymentAt: payment?.createdAt || '',
    lastPaymentMethod: method,
    packageId: cleanText(input.packageId, 80),
    packageLabel: cleanText(input.packageLabel, 160),
    paidAmount: initialAmount,
    paymentHistory: payment ? [payment] : [],
    paymentMethod: method,
    paymentStatus,
    paymentStatusCanonical: paymentStatus === 'lunas' ? 'paid' : paymentStatus === 'dp' ? 'partial' : 'unpaid',
    phone: cleanText(input.phone, 32),
    pricingMode,
    recordingTypeId: cleanText(input.recordingTypeId, 80),
    recordingTypeLabel: cleanText(input.recordingTypeLabel, 160),
    refundHistory: [],
    refundedAmount: 0,
    sessionLabel: cleanText(input.sessionLabel || 'Sesi Studio', 160),
    sessionStatus: 'scheduled',
    sessionType: cleanText(input.sessionType || 'session', 80),
    source: 'admin',
    startHour,
    startTimeLabel: cleanText(input.startTimeLabel, 40),
    status: paymentStatus,
    subtotal: cleanMoney(input.subtotal ?? total),
    title: cleanText(input.title || input.bandName || input.sessionLabel || 'Sesi Studio', 160),
    total,
    updatedAt: timestamp,
  };

  return { booking, payment };
}

function buildInitialBookingPaymentLedger({ actor, booking, payment }) {
  if (!payment) return null;
  const id = 'booking-payment-' + booking.id + '-' + payment.id;
  return {
    id,
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: payment.amount,
    category: 'booking',
    createdAt: payment.createdAt,
    date: payment.date,
    idempotencyKey: payment.idempotencyKey,
    immutable: true,
    note: payment.note,
    paymentMethod: payment.method,
    reversalOf: '',
    source: 'booking-payment',
    sourceAction: 'payment',
    sourceBookingId: booking.id,
    sourceEventId: payment.id,
    title: 'Pembayaran ' + booking.invoiceNumber,
    type: 'income',
    updatedAt: payment.createdAt,
  };
}

function matchesInitialPaymentLedger(actual, expected) {
  if (!actual || typeof actual !== 'object' || !expected) return false;
  const expectedEntries = Object.entries(expected);
  return Object.keys(actual).length === expectedEntries.length &&
    expectedEntries.every(([key, value]) => actual[key] === value);
}

function matchesInitialPaymentToLedger(booking, ledger) {
  const payment = Array.isArray(booking?.paymentHistory) ? booking.paymentHistory[0] : null;
  return Boolean(payment) &&
    booking.initialPaymentLedgerStatus === 'pending' &&
    booking.source === 'admin' &&
    payment.id === ledger.sourceEventId &&
    payment.actorUid === ledger.actorUid &&
    payment.actorName === ledger.actorName &&
    payment.amount === ledger.amount &&
    payment.method === ledger.paymentMethod &&
    payment.date === ledger.date &&
    payment.createdAt === ledger.createdAt &&
    payment.idempotencyKey === ledger.idempotencyKey &&
    payment.note === ledger.note &&
    payment.source === 'manual-booking-create' &&
    ledger.sourceBookingId === booking.id &&
    ledger.title === 'Pembayaran ' + booking.invoiceNumber;
}

async function ensureInitialBookingPaymentLedger({ actor, bookingId, ledger }) {
  if (!ledger) return { duplicate: false, status: 'not_required' };

  const bookingRef = doc(firestoreDb, 'bookings', bookingId);
  const ledgerRef = doc(firestoreDb, 'bookkeepingEntries', ledger.id);
  const scope = 'bookings';
  const action = 'initial-payment-ledger';
  const requestId = 'initial-payment-ledger-' + bookingId;

  const committed = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: { bookingId, ledger },
    execute: async (transaction) => {
      const [bookingSnapshot, ledgerSnapshot] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(ledgerRef),
      ]);
      if (!bookingSnapshot.exists()) {
        throw operationError('booking_not_found_for_initial_ledger', 'Booking tidak ditemukan saat menyelesaikan pencatatan pembayaran awal.');
      }

      const current = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
      if (current.initialPaymentLedgerStatus === 'recorded') {
        if (!ledgerSnapshot.exists() || !matchesInitialPaymentLedger(ledgerSnapshot.data(), ledger)) {
          throw operationError('booking_payment_ledger_integrity_error', 'Status ledger tercatat tetapi dokumen ledger tidak cocok. Hubungi Owner sebelum melakukan perubahan manual.');
        }
        return { collection: 'bookings', id: bookingId };
      }

      if (!matchesInitialPaymentToLedger(current, ledger)) {
        throw operationError('booking_payment_ledger_payload_mismatch', 'Data pembayaran awal tidak cocok dengan booking. Ledger tidak dibuat.');
      }

      if (ledgerSnapshot.exists() && !matchesInitialPaymentLedger(ledgerSnapshot.data(), ledger)) {
        throw operationError('booking_payment_ledger_conflict', 'ID ledger sudah digunakan oleh data lain. Hubungi Owner sebelum melanjutkan.');
      }

      if (!ledgerSnapshot.exists()) transaction.set(ledgerRef, ledger);
      transaction.update(bookingRef, { initialPaymentLedgerStatus: 'recorded' });
      return { collection: 'bookings', id: bookingId };
    },
  });

  return { duplicate: committed.replayed, status: 'recorded' };
}

export async function createManualBooking(inputValue) {
  requireFirestore();
  const input = manualBookingInputSchema.parse(inputValue);
  const actor = await resolveActor({ permission: 'schedule' });
  const requestId = 'manual-create-' + input.id;
  const scope = 'bookings';
  const action = 'manual-create';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
  });
  const timestamp = cleanText(input.createdAt, 40) || new Date().toISOString();
  const { booking, payment } = buildManualBooking(input, actor, requestId, operationId, timestamp);
  const slot = buildCalendarSlot(booking, timestamp, { manualCreate: true });
  const ledger = buildInitialBookingPaymentLedger({ actor, booking, payment });
  const dates = [booking.date];
  const replay = await readCompletedOperation({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: { booking, ledger },
  });

  const bookingRef = doc(firestoreDb, 'bookings', booking.id);
  let duplicate = Boolean(replay);

  if (!replay) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const preflight = await readSchedulePreflight(dates, slot ? booking.date : '');
      if (slot) assertNoScheduleConflict(booking, preflight.bookings);

      try {
        const slotRef = doc(firestoreDb, 'clientCalendarSlots', booking.id);
        const dayRef = doc(firestoreDb, 'bookingScheduleDays', booking.date);

        const committed = await runIdempotentFirestoreTransaction({
          db: firestoreDb,
          actorUid: actor.uid,
          scope,
          action,
          requestId,
          payload: { booking, ledger },
          execute: async (transaction) => {
            const [bookingSnapshot, daySnapshot, slotSnapshot] = await Promise.all([
              transaction.get(bookingRef),
              transaction.get(dayRef),
              transaction.get(slotRef),
            ]);

            const expectedDay = preflight.daySnapshots.get(booking.date);
            const dayRevision = daySnapshot.exists() ? Number(daySnapshot.data().revision || 0) : 0;
            if (!expectedDay || dayRevision !== expectedDay.revision || daySnapshot.exists() !== expectedDay.exists) {
              throw operationError('schedule_revision_changed', 'Jadwal berubah saat operasi diproses. Muat ulang kalender dan coba kembali.');
            }
            if (bookingSnapshot.exists()) {
              throw operationError('booking_id_conflict', 'ID booking sudah digunakan. Muat ulang formulir sebelum menyimpan kembali.');
            }
            if (slot && slotSnapshot.exists()) {
              throw operationError('calendar_slot_conflict', 'Slot kalender sudah memiliki mirror. Periksa data jadwal sebelum melanjutkan.');
            }

            transaction.set(bookingRef, booking);
            writeScheduleDay(transaction, booking.date, booking.id, timestamp, daySnapshot);
            if (slot) transaction.set(slotRef, slot);

            return { collection: 'bookings', id: booking.id };
          },
        });

        duplicate = committed.replayed;
        break;
      } catch (error) {
        if (error?.code === 'schedule_revision_changed' && attempt < 3) continue;
        throw error;
      }
    }
  }

  let saved = await getDoc(bookingRef);
  if (!saved.exists()) {
    throw operationError('booking_commit_missing', 'Booking berhasil diproses tetapi dokumennya belum dapat dibaca.');
  }

  if (ledger) {
    try {
      await ensureInitialBookingPaymentLedger({ actor, bookingId: booking.id, ledger });
    } catch (error) {
      const pending = operationError(
        'booking_payment_ledger_pending',
        'Booking sudah tersimpan, tetapi pencatatan pembayaran awal belum selesai. Coba ulangi penyimpanan booking yang sama untuk melanjutkan ledger tanpa membuat booking duplikat.',
      );
      pending.cause = error;
      throw pending;
    }
    saved = await getDoc(bookingRef);
    if (!saved.exists() || saved.data().initialPaymentLedgerStatus !== 'recorded') {
      throw operationError('booking_payment_ledger_pending', 'Booking tersimpan, tetapi ledger pembayaran awal masih menunggu penyelesaian. Coba ulangi operasi yang sama.');
    }
  }

  return {
    booking: { id: saved.id, ...saved.data() },
    duplicate,
  };
}

export async function updateManualBooking(inputValue) {
  requireFirestore();
  const input = manualBookingInputSchema.parse(inputValue);
  const actor = await resolveActor({ permission: 'schedule' });
  const bookingId = input.id;
  const bookingRef = doc(firestoreDb, 'bookings', bookingId);
  const currentSnapshot = await getDoc(bookingRef);
  if (!currentSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');

  const current = { id: currentSnapshot.id, ...currentSnapshot.data() };
  const expectedUpdatedAt = cleanText(input.expectedUpdatedAt || input.updatedAt || current.updatedAt || '', 40);
  const patch = Object.fromEntries(
    Object.entries(input).filter(([key]) => EDITABLE_BOOKING_FIELDS.has(key)),
  );
  const timestamp = new Date().toISOString();
  const nextBooking = {
    ...current,
    ...patch,
    id: bookingId,
    updatedAt: timestamp,
  };
  nextBooking.date = cleanDate(nextBooking.date);
  nextBooking.startHour = cleanStartHour(nextBooking.startHour);
  nextBooking.durationHours = cleanDuration(
    nextBooking.durationHours ?? nextBooking.duration,
    cleanText(nextBooking.pricingMode || 'session', 40),
    nextBooking.startHour,
  );

  const scheduleChanged = (
    cleanDate(current.date) !== nextBooking.date ||
    Number(current.startHour) !== nextBooking.startHour ||
    Number(current.durationHours ?? current.duration ?? 0) !== nextBooking.durationHours ||
    String(current.sessionLabel || '') !== String(nextBooking.sessionLabel || '')
  );
  const dateSet = scheduleChanged
    ? [...new Set([cleanDate(current.date), nextBooking.date])].sort()
    : [];
  const requestId = 'manual-update-' + bookingId + '-' + hashText(expectedUpdatedAt || current.updatedAt || 'legacy');
  const scope = 'bookings';
  const action = 'manual-update';
  const operationPayload = { expectedUpdatedAt, id: bookingId, patch };
  const replay = await readCompletedOperation({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: operationPayload,
  });
  if (replay) return { ...replay.booking, duplicate: true };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const preflight = await readSchedulePreflight(dateSet, scheduleChanged ? nextBooking.date : '');
    if (scheduleChanged) assertNoScheduleConflict(nextBooking, preflight.bookings);

    try {
      const slotRef = doc(firestoreDb, 'clientCalendarSlots', bookingId);
      const dayRefs = dateSet.map((date) => doc(firestoreDb, 'bookingScheduleDays', date));
      const committed = await runIdempotentFirestoreTransaction({
        db: firestoreDb,
        actorUid: actor.uid,
        scope,
        action,
        requestId,
        payload: operationPayload,
        execute: async (transaction) => {
          const references = [bookingRef, slotRef, ...dayRefs];
          const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
          const bookingSnapshot = snapshots[0];
          const slotSnapshot = snapshots[1];
          const daySnapshots = snapshots.slice(2);
          const days = new Map(dateSet.map((date, index) => [date, daySnapshots[index]]));

          if (!bookingSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');
          const latest = bookingSnapshot.data();
          if ((latest.updatedAt || '') !== (current.updatedAt || '') ||
              (expectedUpdatedAt && latest.updatedAt !== expectedUpdatedAt)) {
            throw operationError('stale_booking', 'Booking sudah berubah. Muat ulang data sebelum menyimpan kembali.');
          }

          if (scheduleChanged) {
            for (const date of dateSet) {
              const expected = preflight.daySnapshots.get(date);
              const snapshot = days.get(date);
              const revision = snapshot?.exists() ? Number(snapshot.data().revision || 0) : 0;
              if (!expected || !snapshot || revision !== expected.revision || snapshot.exists() !== expected.exists) {
                throw operationError('schedule_revision_changed', 'Jadwal berubah saat operasi diproses. Muat ulang kalender dan coba kembali.');
              }
            }
          }

          transaction.set(bookingRef, nextBooking);

          if (scheduleChanged) {
            dateSet.forEach((date) => writeScheduleDay(transaction, date, bookingId, timestamp, days.get(date)));
            const slot = buildCalendarSlot(nextBooking, timestamp);
            if (slot) transaction.set(slotRef, slot);
            else if (slotSnapshot.exists()) transaction.delete(slotRef);
          }

          return { collection: 'bookings', id: bookingId };
        },
      });

      const saved = await getDoc(bookingRef);
      if (!saved.exists()) throw operationError('booking_commit_missing', 'Booking tersimpan tetapi tidak dapat dibaca kembali.');
      return { ...saved.data(), id: saved.id, duplicate: committed.replayed };
    } catch (error) {
      if (error?.code === 'schedule_revision_changed' && attempt < 3) continue;
      throw error;
    }
  }
  throw operationError('booking_conflict', 'Jadwal berubah berulang kali. Muat ulang kalender lalu coba kembali.');
}

function buildDecisionMessage({ actor, booking, decisionKey, note, timestamp }) {
  return {
    id: 'request-' + decisionKey,
    bookingId: booking.id,
    clientUid: cleanText(booking.clientUid, 128),
    senderUid: actor.uid,
    senderRole: 'admin',
    senderName: actor.displayName || 'Admin Studio',
    text: cleanText(note, 600),
    type: 'status',
    createdAt: timestamp,
    readByAdmin: true,
    readByClient: false,
  };
}

function decisionPatch({ actor, decisionKey, message, note, status, timestamp }) {
  const patch = {
    adminResponseAt: timestamp,
    adminResponseBy: actor.uid,
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

export async function decideBookingRequest(inputValue) {
  requireFirestore();
  const input = decisionInputSchema.parse(inputValue);
  const actor = await resolveActor({ permission: 'schedule' });
  const bookingRef = doc(firestoreDb, 'bookings', input.bookingId);
  const currentSnapshot = await getDoc(bookingRef);
  if (!currentSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');

  const currentBooking = { id: currentSnapshot.id, ...currentSnapshot.data() };
  const decisionKey = input.decisionKey || buildBookingDecisionKey({
    booking: currentBooking,
    status: input.status,
  });
  const requestId = decisionKey;
  const scope = 'bookings';
  const action = 'request-decision';
  const operationPayload = {
    bookingId: input.bookingId,
    decisionKey,
    note: input.note,
    status: input.status,
  };
  const replay = await readCompletedOperation({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: operationPayload,
  });
  if (replay) {
    const messageId = 'request-' + decisionKey;
    const messageSnapshot = await getDoc(doc(firestoreDb, 'bookingMessages', messageId));
    const eventId = input.status === 'cancelled' ? 'session-' + replay.operationId.slice(3) : '';
    const eventSnapshot = eventId
      ? await getDoc(doc(firestoreDb, 'bookingSessionEvents', eventId))
      : null;
    if (!messageSnapshot.exists() || (eventId && !eventSnapshot?.exists())) {
      throw operationError('booking_decision_commit_missing', 'Keputusan tersimpan tetapi dokumen pendamping belum tersedia.');
    }
    return {
      booking: replay.booking,
      message: messageSnapshot.data(),
      event: eventSnapshot?.exists() ? eventSnapshot.data() : null,
      status: input.status,
      decisionKey,
      alreadyApplied: true,
      duplicate: true,
    };
  }

  const timestamp = new Date().toISOString();
  const date = cleanDate(currentBooking.date);
  const fromSessionStatus = currentSessionStatus(currentBooking);
  if (input.status === 'cancelled' && fromSessionStatus !== 'upcoming') {
    throw operationError('session_not_cancellable', 'Booking tidak dapat dibatalkan setelah sesi dimulai atau mencapai status akhir.');
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const preflight = await readSchedulePreflight([date], input.status === 'confirmed' ? date : '');
    const issue = validateBookingDecision({
      booking: currentBooking,
      currentBookings: preflight.bookings,
      reason: input.note,
      status: input.status,
    });
    if (!issue.ok) {
      const error = operationError(
        issue.code === 'schedule-conflict' ? 'booking_conflict' : issue.code,
        issue.message,
      );
      error.details = issue.conflict ? { bookingId: issue.conflict.id } : null;
      throw error;
    }

    try {
      const dayRef = doc(firestoreDb, 'bookingScheduleDays', date);
      const slotRef = doc(firestoreDb, 'clientCalendarSlots', input.bookingId);
      const decisionMessage = buildDecisionMessage({
        actor,
        booking: currentBooking,
        decisionKey,
        note: input.note,
        timestamp,
      });
      const messageRef = doc(firestoreDb, 'bookingMessages', decisionMessage.id);
      const operationId = await createRepositoryOperationId({
        actorUid: actor.uid,
        scope,
        action,
        requestId,
      });
      const cancelEventId = input.status === 'cancelled' ? 'session-' + operationId.slice(3) : '';
      const eventRef = cancelEventId
        ? doc(firestoreDb, 'bookingSessionEvents', cancelEventId)
        : null;

      const committed = await runIdempotentFirestoreTransaction({
        db: firestoreDb,
        actorUid: actor.uid,
        scope,
        action,
        requestId,
        payload: operationPayload,
        execute: async (transaction) => {
          const references = [bookingRef, dayRef, slotRef, messageRef];
          if (eventRef) references.push(eventRef);
          const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
          const bookingSnapshot = snapshots[0];
          const daySnapshot = snapshots[1];
          const slotSnapshot = snapshots[2];
          const messageSnapshot = snapshots[3];
          const eventSnapshot = eventRef ? snapshots[4] : null;
          await readTransactionDays(transaction, [date], preflight.daySnapshots);

          if (!bookingSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');
          const latest = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
          if ((latest.updatedAt || '') !== (currentBooking.updatedAt || '') ||
              getBookingRequestStatus(latest) !== getBookingRequestStatus(currentBooking)) {
            throw operationError('booking_changed', 'Permintaan booking berubah. Muat ulang inbox sebelum memprosesnya.');
          }
          if (messageSnapshot.exists()) throw operationError('booking_decision_message_conflict', 'Pesan keputusan dengan ID ini sudah ada.');
          if (eventSnapshot?.exists()) throw operationError('booking_session_event_conflict', 'Event pembatalan dengan ID ini sudah ada.');

          const nextStatusIssue = validateBookingDecision({
            booking: latest,
            currentBookings: preflight.bookings,
            reason: input.note,
            status: input.status,
          });
          if (!nextStatusIssue.ok) throw operationError(nextStatusIssue.code, nextStatusIssue.message);
          if (input.status === 'cancelled' && currentSessionStatus(latest) !== 'upcoming') {
            throw operationError('session_not_cancellable', 'Booking tidak dapat dibatalkan setelah sesi dimulai atau mencapai status akhir.');
          }

          const message = buildDecisionMessage({
            actor,
            booking: latest,
            decisionKey,
            note: input.note,
            timestamp,
          });
          const nextBooking = {
            ...latest,
            ...decisionPatch({
              actor,
              decisionKey,
              message,
              note: input.note,
              status: input.status,
              timestamp,
            }),
          };

          transaction.set(bookingRef, nextBooking);
          transaction.set(messageRef, message);
          writeScheduleDay(transaction, date, input.bookingId, timestamp, daySnapshot);

          if (input.status === 'confirmed') {
            const slot = buildCalendarSlot(nextBooking, timestamp);
            if (slot) transaction.set(slotRef, slot);
            else if (slotSnapshot.exists()) transaction.delete(slotRef);
          } else if (slotSnapshot.exists()) {
            transaction.delete(slotRef);
          }

          if (eventRef) {
            const event = {
              action: 'cancelled',
              actorName: actor.displayName,
              actorUid: actor.uid,
              bookingId: input.bookingId,
              createdAt: timestamp,
              fromStatus: currentSessionStatus(latest),
              id: cancelEventId,
              reason: cleanText(input.note, 600),
              toStatus: 'cancelled',
              type: 'booking-session-event',
            };
            nextBooking.lastSessionEventAt = timestamp;
            nextBooking.lastSessionEventType = 'cancelled';
            nextBooking.lastSessionEventId = cancelEventId;
            transaction.set(bookingRef, nextBooking);
            transaction.set(eventRef, event);
          }

          return { collection: 'bookings', id: input.bookingId };
        },
      });

      const [saved, savedMessage, savedEvent] = await Promise.all([
        getDoc(bookingRef),
        getDoc(messageRef),
        eventRef ? getDoc(eventRef) : Promise.resolve(null),
      ]);
      if (!saved.exists() || !savedMessage.exists()) {
        throw operationError('booking_decision_commit_missing', 'Keputusan tersimpan tetapi data pendamping belum dapat dibaca kembali.');
      }
      return {
        booking: { id: saved.id, ...saved.data() },
        message: savedMessage.data(),
        event: savedEvent?.exists() ? savedEvent.data() : null,
        status: input.status,
        decisionKey,
        alreadyApplied: committed.replayed,
        duplicate: committed.replayed,
      };
    } catch (error) {
      if (error?.code === 'schedule_revision_changed' && attempt < 3) continue;
      throw error;
    }
  }

  throw operationError('booking_conflict', 'Jadwal berubah berulang kali. Muat ulang inbox lalu coba kembali.');
}

export async function recordBookingSessionAction(inputValue) {
  requireFirestore();
  const input = sessionActionInputSchema.parse(inputValue);
  const actor = await resolveActor({ permission: 'schedule' });
  if (input.action === 'no_show' && cleanText(input.reason, 600).length < 4) {
    throw operationError('session_reason_required', 'Alasan no-show wajib diisi minimal 4 karakter.');
  }

  const bookingRef = doc(firestoreDb, 'bookings', input.bookingId);
  const currentSnapshot = await getDoc(bookingRef);
  if (!currentSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');
  const currentBooking = { id: currentSnapshot.id, ...currentSnapshot.data() };
  const requestId = 'session-' + await createRepositoryPayloadHash({ bookingId: input.bookingId }) + '-' + input.action;
  const scope = 'bookings';
  const action = 'session-action';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
  });
  const eventId = 'session-' + operationId.slice(3);
  const timestamp = new Date().toISOString();
  const now = new Date(timestamp);
  const eventRef = doc(firestoreDb, 'bookingSessionEvents', eventId);
  const operationPayload = {
    action: input.action,
    bookingId: input.bookingId,
    reason: input.reason,
  };
  const replay = await readCompletedOperation({
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: operationPayload,
  });
  if (replay) {
    const eventSnapshot = await getDoc(eventRef);
    if (!eventSnapshot.exists()) {
      throw operationError('session_action_commit_missing', 'Marker aksi ditemukan tetapi event sesi tidak tersedia.');
    }
    return { booking: replay.booking, event: eventSnapshot.data(), duplicate: true };
  }

  const fromStatus = currentSessionStatus(currentBooking);
  if (['completed', 'no_show', 'cancelled'].includes(fromStatus)) {
    throw operationError('session_terminal', 'Sesi sudah berada pada status akhir dan tidak menerima aksi operasional baru.');
  }
  if (input.action === 'check_in' && currentBooking.checkedInAt) {
    throw operationError('already_checked_in', 'Customer sudah tercatat check-in.');
  }
  if (input.action === 'no_show' && currentBooking.checkedInAt) {
    throw operationError('checked_in_cannot_be_no_show', 'Customer sudah check-in sehingga tidak dapat ditandai no-show.');
  }

  const nextBooking = { ...currentBooking, updatedAt: timestamp };
  let toStatus = fromStatus;

  if (input.action === 'check_in') {
    if (fromStatus !== 'upcoming') throw operationError('invalid_session_transition', 'Check-in hanya dapat dicatat sebelum sesi dimulai.');
    nextBooking.checkedInAt = timestamp;
    nextBooking.checkedInByUid = actor.uid;
    nextBooking.checkedInByName = actor.displayName;
  } else if (input.action === 'start') {
    if (fromStatus !== 'upcoming') throw operationError('invalid_session_transition', 'Sesi hanya dapat dimulai dari status Akan Datang.');
    nextBooking.sessionStatus = 'in_progress';
    nextBooking.actualStartAt = timestamp;
    nextBooking.actualStartByUid = actor.uid;
    nextBooking.actualStartByName = actor.displayName;
    toStatus = 'in_progress';
  } else if (input.action === 'complete') {
    if (fromStatus !== 'in_progress') throw operationError('invalid_session_transition', 'Selesaikan sesi hanya dapat dilakukan setelah sesi dimulai.');
    const actualStart = new Date(currentBooking.actualStartAt || '');
    if (Number.isNaN(actualStart.getTime())) throw operationError('session_start_missing', 'Waktu mulai aktual tidak tersedia.');
    nextBooking.sessionStatus = 'completed';
    nextBooking.actualEndAt = timestamp;
    nextBooking.actualEndByUid = actor.uid;
    nextBooking.actualEndByName = actor.displayName;
    nextBooking.actualDurationMinutes = Math.max(1, Math.round((now.getTime() - actualStart.getTime()) / 60_000));
    toStatus = 'completed';
  } else if (input.action === 'no_show') {
    if (fromStatus !== 'upcoming') throw operationError('invalid_session_transition', 'No-show hanya dapat dicatat sebelum sesi dimulai.');
    validateNoShowEligibility(currentBooking, now);
    nextBooking.sessionStatus = 'no_show';
    nextBooking.noShowAt = timestamp;
    nextBooking.noShowByUid = actor.uid;
    nextBooking.noShowByName = actor.displayName;
    nextBooking.noShowReason = cleanText(input.reason, 600);
    toStatus = 'no_show';
  }

  const event = {
    action: input.action,
    actorName: actor.displayName,
    actorUid: actor.uid,
    bookingId: input.bookingId,
    createdAt: timestamp,
    fromStatus,
    id: eventId,
    reason: cleanText(input.reason, 600),
    toStatus,
    type: 'booking-session-event',
  };
  nextBooking.lastSessionEventAt = timestamp;
  nextBooking.lastSessionEventType = input.action;
  nextBooking.lastSessionEventId = eventId;

  const committed = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope,
    action,
    requestId,
    payload: operationPayload,
    execute: async (transaction) => {
      const [bookingSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(bookingRef),
        transaction.get(eventRef),
      ]);
      if (!bookingSnapshot.exists()) throw operationError('booking_not_found', 'Booking tidak ditemukan.');
      const latest = bookingSnapshot.data();
      if ((latest.updatedAt || '') !== (currentBooking.updatedAt || '') ||
          currentSessionStatus({ ...latest, id: input.bookingId }) !== fromStatus) {
        throw operationError('booking_changed', 'Status sesi berubah. Muat ulang detail booking sebelum mencoba lagi.');
      }
      if (eventSnapshot.exists()) throw operationError('booking_session_event_conflict', 'Event sesi dengan ID ini sudah ada.');

      transaction.set(bookingRef, nextBooking);
      transaction.set(eventRef, event);
      return { collection: 'bookings', id: input.bookingId };
    },
  });

  const [saved, savedEvent] = await Promise.all([getDoc(bookingRef), getDoc(eventRef)]);
  if (!saved.exists() || !savedEvent.exists()) {
    throw operationError('session_action_commit_missing', 'Aksi sesi tersimpan tetapi histori sesi belum dapat dibaca kembali.');
  }
  return {
    booking: { id: saved.id, ...saved.data() },
    event: savedEvent.data(),
    duplicate: committed.replayed,
  };
}

export async function createClientBookingRequestOperation({ user, booking }) {
  requireFirestore();
  const actor = await resolveActor({ clientOnly: true });
  if (!user?.uid || user.uid !== actor.uid || booking?.clientUid !== actor.uid) {
    throw operationError('authentication_required', 'Client harus login untuk mengirim permintaan booking.');
  }

  const id = cleanText(booking?.id, 160);
  if (!id || booking?.source !== 'clientPortal' || booking?.customerId !== 'auth_' + actor.uid ||
      booking?.bookingRequestStatus !== 'submitted' || booking?.paymentStatus !== 'pending' ||
      booking?.status !== 'pending' || !Array.isArray(booking?.paymentHistory) ||
      booking.paymentHistory.length !== 0 || Number(booking?.paidAmount) !== 0 ||
      Number(booking?.dpAmount) !== 0 || Number(booking?.invoiceAmount) !== Number(booking?.total)) {
    throw operationError('invalid_client_booking_request', 'Data permintaan booking Client tidak memenuhi kontrak.');
  }

  const requestId = 'client-request-' + await createRepositoryPayloadHash({ bookingId: id });
  const committed = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: 'bookings',
    action: 'client-request-create',
    requestId,
    payload: booking,
    execute: async (transaction) => {
      const bookingRef = doc(firestoreDb, 'bookings', id);
      const existing = await transaction.get(bookingRef);
      if (existing.exists()) throw operationError('booking_id_conflict', 'ID permintaan booking sudah digunakan.');
      transaction.set(bookingRef, booking);
      return { collection: 'bookings', id };
    },
  });

  const snapshot = await getDoc(doc(firestoreDb, 'bookings', id));
  if (!snapshot.exists()) throw operationError('booking_commit_missing', 'Permintaan booking belum dapat dibaca kembali.');
  return { booking: { id: snapshot.id, ...snapshot.data() }, duplicate: committed.replayed };
}

export const bookingOperationsRepository = Object.freeze({
  createManualBooking,
  updateManualBooking,
  decideBookingRequest,
  recordBookingSessionAction,
  createClientBookingRequestOperation,
});
