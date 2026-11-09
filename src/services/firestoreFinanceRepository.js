import {
  collection,
  doc,
  documentId,
  getDocFromServer,
  getDocsFromServer,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryRequestId,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';

const BOOKINGS = 'bookings';
const LEDGER = 'bookkeepingEntries';
const PROOFS = 'paymentProofs';
const CLOSINGS = 'cashClosingSessions';
const CLOSING_EVENTS = 'cashClosingEvents';
const METHODS = Object.freeze(['cash', 'transfer', 'qris', 'other']);
const DENOMINATIONS = Object.freeze([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]);
const MAX_LEDGER_ROWS = 10000;
const MAX_BOOKING_PAGES = 50;
const MAX_CLOSING_REFERENCES = 1000;
const BUSINESS_TIME_ZONE = 'Asia/Jakarta';

function cleanText(value, max = 600) {
  return String(value ?? '').trim().slice(0, max);
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function signedMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Nominal harus berupa angka yang valid.');
  return Math.round(parsed);
}

function isoNow() {
  return new Date().toISOString();
}

function businessDateOf(value) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validBusinessDate(raw);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function validBusinessDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(date + 'T00:00:00.000Z');
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

function normalizeRegisterId(value) {
  const registerId = cleanText(value || 'main', 40).toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(registerId) || registerId !== 'main') {
    throw new Error('Phase 3 hanya mendukung register main.');
  }
  return registerId;
}

function assertFirebase() {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
}

async function requirePrincipal(permission) {
  assertFirebase();
  const user = firebaseAuth?.currentUser;
  if (!user?.uid) throw new Error('Sesi login diperlukan.');
  const userRef = doc(firestoreDb, 'users', user.uid);
  const ownerRef = doc(firestoreDb, 'adminControl', 'ownership');
  const [userSnap, ownerSnap] = await Promise.all([
    getDocFromServer(userRef),
    getDocFromServer(ownerRef),
  ]);
  const profile = userSnap.exists() ? { uid: userSnap.id, ...userSnap.data() } : null;
  const principal = buildRepositoryPrincipal({
    authUid: user.uid,
    userProfile: profile,
    ownershipControl: ownerSnap.exists() ? ownerSnap.data() : null,
  });
  if (!principal.active || !principal.hasPermission(permission)) {
    throw new Error('Akun tidak memiliki izin ' + permission + '.');
  }
  return {
    displayName: cleanText(profile?.displayName || user.displayName || user.email || 'Admin', 120),
    email: cleanText(user.email, 254),
    principal,
    uid: user.uid,
  };
}

function normalizeMethod(value) {
  const method = cleanText(value, 20).toLowerCase();
  if (!METHODS.includes(method)) throw new Error('Metode pembayaran tidak valid.');
  return method;
}

function cleanOperationDate(value, now) {
  const date = value ? validBusinessDate(value) : businessDateOf(now);
  if (!date || Number(date.slice(0, 4)) < 2000 || Number(date.slice(0, 4)) > 2100) {
    throw new Error('Tanggal operasi tidak valid.');
  }
  return date;
}

function normalizePaymentHistory(booking) {
  const history = Array.isArray(booking.paymentHistory)
    ? booking.paymentHistory.filter((row) => money(row?.amount) > 0)
    : [];
  if (history.length) return history;
  const total = money(booking.total ?? booking.subtotal ?? booking.invoiceAmount);
  const status = cleanText(booking.paymentStatusCanonical || booking.paymentStatus, 40).toLowerCase();
  const amount = Math.max(
    money(booking.paidAmount),
    money(booking.dpAmount),
    ['paid', 'lunas'].includes(status) ? total : 0,
  );
  if (!amount) return [];
  const at = cleanText(booking.lastPaymentAt || booking.createdAt || booking.date || isoNow(), 80);
  return [{
    amount,
    createdAt: at,
    date: /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : at.slice(0, 10),
    id: 'legacy_' + cleanText(booking.id || 'booking', 100) + '_payment',
    idempotencyKey: 'legacy:' + cleanText(booking.id || 'booking', 120),
    method: cleanText(booking.lastPaymentMethod || booking.paymentMethod || 'other', 20),
    source: 'legacy-projection',
  }];
}

function normalizeRefundHistory(booking) {
  return Array.isArray(booking.refundHistory)
    ? booking.refundHistory.filter((row) => money(row?.amount) > 0)
    : [];
}

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + money(row?.amount), 0);
}

function bookingTotal(booking, payments) {
  for (const value of [booking.total, booking.subtotal]) {
    if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) {
      return money(value);
    }
  }
  return money(booking.invoiceAmount) + sumAmounts(payments);
}

function financeSnapshot(booking) {
  const paymentHistory = normalizePaymentHistory(booking);
  const refundHistory = normalizeRefundHistory(booking);
  const total = bookingTotal(booking, paymentHistory);
  const grossPaid = sumAmounts(paymentHistory);
  const refunded = sumAmounts(refundHistory);
  const netPaid = Math.max(0, grossPaid - refunded);
  const isVoid = booking.paymentStatus === 'void' || booking.invoiceStatus === 'void';
  let status = 'unpaid';
  if (isVoid) status = 'void';
  else if (grossPaid > 0 && netPaid === 0 && refunded >= grossPaid) status = 'refunded';
  else if (total > 0 && netPaid >= total) status = 'paid';
  else if (netPaid > 0) status = 'partial';
  return {
    grossPaid,
    netPaid,
    outstanding: ['void', 'refunded'].includes(status) ? 0 : Math.max(0, total - netPaid),
    paymentHistory,
    refundHistory,
    refunded,
    status,
    total,
  };
}

function legacyPaymentStatus(status) {
  return { paid: 'lunas', partial: 'dp', refunded: 'refunded', unpaid: 'pending', void: 'void' }[status] || 'pending';
}

function financeProjection(booking, snapshot, timestamp) {
  return {
    ...booking,
    invoiceAmount: snapshot.outstanding,
    paidAmount: snapshot.netPaid,
    paymentStatus: legacyPaymentStatus(snapshot.status),
    paymentStatusCanonical: snapshot.status,
    refundedAmount: snapshot.refunded,
    updatedAt: timestamp,
  };
}

function assertInvoiceOpen(snapshot) {
  if (snapshot.status === 'void') throw new Error('Invoice sudah void dan tidak menerima pembayaran baru.');
  if (snapshot.status === 'refunded') throw new Error('Invoice sudah direfund penuh dan bersifat read-only.');
}

function operationEventId(prefix, requestId) {
  return prefix + '_' + cleanText(requestId, 80).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
}

function ledgerDocumentId(operationId) {
  return 'ledger_' + operationId.slice(3);
}

async function readBusinessFence(date) {
  const ref = doc(firestoreDb, CLOSINGS, date + '__main');
  const snapshot = await getDocFromServer(ref);
  return { data: snapshot.exists() ? snapshot.data() : null, ref };
}

async function touchBusinessFence(transaction, fenceRef, fenceSnapshot, actor, timestamp, operationId, operationAction, bookingId = '', ledgerEntryId = '', proofId = '') {
  const current = fenceSnapshot.exists() ? fenceSnapshot.data() : null;
  if (current?.status === 'closed') throw new Error('Tanggal bisnis sudah ditutup. Posting dan perubahan jurnal ditolak.');
  const next = {
    ...(current || {}),
    activityRevision: Math.max(0, Number(current?.activityRevision || 0)) + 1,
    businessDate: fenceRef.id.split('__')[0],
    createdAt: current?.createdAt || timestamp,
    id: fenceRef.id,
    lastActivityAt: timestamp,
    lastActivityByUid: actor.uid,
    lastOperationId: operationId,
    lastOperationAction: operationAction,
    lastBookingId: bookingId,
    lastLedgerEntryId: ledgerEntryId,
    lastProofId: proofId,
    registerId: 'main',
    status: current?.status || 'open',
    updatedAt: timestamp,
  };
  transaction.set(fenceRef, next);
  return next;
}

async function runBookingFinanceOperation({
  actor,
  action,
  amount,
  bookingId,
  date,
  method,
  note,
  proofId = '',
  source = '',
  requestId,
}) {
  const timestamp = isoNow();
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: 'finance',
    action,
    requestId,
  });
  const eventPrefix = action === 'refund' ? 'refund' : 'payment';
  const eventId = operationEventId(eventPrefix, requestId);
  const ledgerId = ledgerDocumentId(operationId);
  const bookingRef = doc(firestoreDb, BOOKINGS, bookingId);
  const ledgerRef = doc(firestoreDb, LEDGER, ledgerId);
  const fence = { ref: doc(firestoreDb, CLOSINGS, date + '__main') };
  const proofRef = proofId ? doc(firestoreDb, PROOFS, proofId) : null;
  let eventResult = null;
  let proofResult = null;

  const transactionResult = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: 'finance',
    action,
    requestId,
    payload: { amount, bookingId, date, method, note, proofId, source },
    execute: async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      const fenceSnapshot = await transaction.get(fence.ref);
      const proofSnapshot = proofRef ? await transaction.get(proofRef) : null;
      if (!bookingSnapshot.exists()) throw new Error('Booking tidak ditemukan.');
      if (proofSnapshot && !proofSnapshot.exists()) throw new Error('Bukti pembayaran tidak ditemukan.');
      const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
      const before = financeSnapshot(booking);
      assertInvoiceOpen(before);
      if (action === 'payment' || action === 'proof-approve') {
        if (before.paymentHistory.length >= 100) throw new Error('Riwayat pembayaran mencapai batas aman.');
        if (!amount || amount > before.outstanding) throw new Error('Nominal pembayaran melebihi sisa invoice.');
      } else {
        if (before.refundHistory.length >= 100) throw new Error('Riwayat refund mencapai batas aman.');
        if (!amount || amount > Math.max(0, before.grossPaid - before.refunded)) {
          throw new Error('Nominal melebihi saldo yang dapat direfund.');
        }
        if (cleanText(note, 600).length < 4) throw new Error('Alasan refund minimal 4 karakter.');
      }

      if (proofSnapshot) {
        const proof = proofSnapshot.data();
        if (proof.status !== 'pending' || proof.bookingId !== bookingId) {
          throw new Error('Bukti tidak lagi pending atau tidak terhubung dengan booking ini.');
        }
      }

      const event = {
        actorName: actor.displayName,
        actorUid: actor.uid,
        amount,
        createdAt: timestamp,
        date,
        id: eventId,
        idempotencyKey: requestId,
        ledgerEntryId: ledgerId,
        method,
        note: cleanText(note, 600),
        operationId,
        source: source || (action === 'refund' ? 'admin-refund' : 'admin-payment'),
        ...(proofSnapshot ? {
          proofId,
          proofReference: cleanText(proofSnapshot.data().transactionReference, 120),
          payerName: cleanText(proofSnapshot.data().payerName, 120),
        } : {}),
      };

      let nextBooking;
      let ledger;
      let nextSnapshot;
      if (action === 'refund') {
        const nextBase = {
          ...booking,
          paymentHistory: before.paymentHistory,
          refundHistory: [...before.refundHistory, { ...event, reason: cleanText(note, 600) }],
          total: before.total,
        };
        nextSnapshot = financeSnapshot(nextBase);
        nextBooking = {
          ...financeProjection(nextBase, nextSnapshot, timestamp),
          lastRefundAt: timestamp,
          lastRefundMethod: method,
          lastRefundReason: cleanText(note, 600),
          refundStatus: nextSnapshot.status === 'refunded' ? 'full' : 'partial',
          lastFinanceAction: 'refund',
          lastFinanceBusinessDate: date,
          lastFinanceEventId: eventId,
          lastFinanceLedgerEntryId: ledgerId,
          lastFinanceOperationId: operationId,
          lastFinanceProofId: '',
        };
        ledger = {
          actorName: actor.displayName,
          actorUid: actor.uid,
          amount,
          category: 'refund',
          createdAt: timestamp,
          date,
          id: ledgerId,
          idempotencyKey: requestId,
          immutable: true,
          note: cleanText(note, 600),
          operationId,
          sourceProofId: '',
          paymentMethod: method,
          reversalOf: '',
          source: 'booking-refund',
          sourceAction: 'refund',
          sourceBookingId: bookingId,
          sourceEventId: eventId,
          title: 'Refund ' + cleanText(booking.invoiceNumber || booking.bookingCode || booking.id, 120),
          type: 'expense',
          updatedAt: timestamp,
        };
      } else {
        const nextBase = { ...booking, paymentHistory: [...before.paymentHistory, event], total: before.total };
        nextSnapshot = financeSnapshot(nextBase);
        nextBooking = {
          ...financeProjection(nextBase, nextSnapshot, timestamp),
          dpAmount: nextSnapshot.status === 'partial' ? nextSnapshot.netPaid : 0,
          lastPaymentAt: timestamp,
          lastPaymentMethod: method,
          lastFinanceAction: action,
          lastFinanceBusinessDate: date,
          lastFinanceEventId: eventId,
          lastFinanceLedgerEntryId: ledgerId,
          lastFinanceOperationId: operationId,
          lastFinanceProofId: proofId || '',
        };
        ledger = {
          actorName: actor.displayName,
          actorUid: actor.uid,
          amount,
          category: 'booking',
          createdAt: timestamp,
          date,
          id: ledgerId,
          idempotencyKey: requestId,
          immutable: true,
          note: cleanText(note || (proofSnapshot ? 'Pembayaran dari review referensi transaksi' : ''), 600),
          operationId,
          sourceProofId: proofId || '',
          paymentMethod: method,
          reversalOf: '',
          source: 'booking-payment',
          sourceAction: 'payment',
          sourceBookingId: bookingId,
          sourceEventId: eventId,
          title: 'Pembayaran ' + cleanText(booking.invoiceNumber || booking.bookingCode || booking.id, 120),
          type: 'income',
          updatedAt: timestamp,
        };
      }

      transaction.update(bookingRef, nextBooking);
      transaction.set(ledgerRef, ledger);
      await touchBusinessFence(transaction, fence.ref, fenceSnapshot, actor, timestamp, operationId, action, bookingId, ledgerId, proofId);

      if (proofSnapshot) {
        const proof = proofSnapshot.data();
        const reviewedProof = {
          ...proof,
          adminNote: cleanText(note, 600),
          approvedAmount: amount,
          approvedMethod: method,
          reviewedAt: timestamp,
          reviewedByName: actor.displayName,
          reviewedByUid: actor.uid,
          reviewDecision: 'approved',
          reviewOperationId: operationId,
          status: 'approved',
          updatedAt: timestamp,
        };
        transaction.update(proofRef, reviewedProof);
        proofResult = reviewedProof;
      }
      eventResult = event;
      return { collection: BOOKINGS, id: bookingId };
    },
  });

  const bookingSnapshot = await getDocFromServer(bookingRef);
  if (!bookingSnapshot.exists()) throw new Error('Booking tidak ditemukan setelah transaksi.');
  const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
  const selectedHistory = action === 'refund' ? booking.refundHistory : booking.paymentHistory;
  const savedEvent = (Array.isArray(selectedHistory) ? selectedHistory : [])
    .find((row) => row.operationId === operationId) || eventResult;
  if (proofRef) {
    const savedProof = await getDocFromServer(proofRef);
    proofResult = savedProof.exists() ? { id: savedProof.id, ...savedProof.data() } : proofResult;
  }
  return {
    booking,
    duplicate: transactionResult.replayed,
    ledgerEntryId: ledgerId,
    payment: action === 'refund' ? undefined : savedEvent,
    proof: proofResult,
    refund: action === 'refund' ? savedEvent : undefined,
    snapshot: financeSnapshot(booking),
  };
}

export async function recordFinancePayment(input = {}, operationRequestId = '') {
  const actor = await requirePrincipal('billing');
  const bookingId = cleanText(input.bookingId, 160);
  const amount = money(input.amount);
  if (!bookingId || !amount) throw new Error('Booking dan nominal pembayaran wajib diisi.');
  const timestamp = isoNow();
  const date = cleanOperationDate(input.date, timestamp);
  const method = normalizeMethod(input.method);
  const requestId = cleanText(operationRequestId || input.requestId || createRepositoryRequestId(), 128);
  return runBookingFinanceOperation({
    actor, action: 'payment', amount, bookingId, date, method,
    note: cleanText(input.note, 600), source: cleanText(input.source || 'admin-payment', 80), requestId,
  });
}

export async function recordFinanceRefund(input = {}, operationRequestId = '') {
  const actor = await requirePrincipal('billing');
  const bookingId = cleanText(input.bookingId, 160);
  const amount = money(input.amount);
  if (!bookingId || !amount) throw new Error('Booking dan nominal refund wajib diisi.');
  const timestamp = isoNow();
  const date = cleanOperationDate(input.date, timestamp);
  const method = normalizeMethod(input.method);
  const reason = cleanText(input.reason, 600);
  if (reason.length < 4) throw new Error('Alasan refund minimal 4 karakter.');
  const requestId = cleanText(operationRequestId || input.requestId || createRepositoryRequestId(), 128);
  return runBookingFinanceOperation({
    actor, action: 'refund', amount, bookingId, date, method,
    note: reason, source: cleanText(input.source || 'admin-refund', 80), requestId,
  });
}

export async function voidFinanceInvoice(input = {}, operationRequestId = '') {
  const actor = await requirePrincipal('billing');
  const bookingId = cleanText(input.bookingId, 160);
  const reason = cleanText(input.reason, 600);
  if (!bookingId || reason.length < 4) throw new Error('Booking dan alasan void minimal 4 karakter wajib diisi.');
  const requestId = cleanText(operationRequestId || input.requestId || createRepositoryRequestId(), 128);
  const timestamp = isoNow();
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'finance', action: 'void', requestId,
  });
  const bookingRef = doc(firestoreDb, BOOKINGS, bookingId);
  const operationResult = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: 'finance',
    action: 'void',
    requestId,
    payload: { bookingId, reason },
    execute: async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      if (!bookingSnapshot.exists()) throw new Error('Booking tidak ditemukan.');
      const booking = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
      const before = financeSnapshot(booking);
      if (before.status === 'void') throw new Error('Invoice sudah void.');
      if (before.netPaid > 0) throw new Error('Invoice masih memiliki pembayaran bersih. Catat refund sebelum void.');
      const date = validBusinessDate(booking.date);
      if (!date) throw new Error('Tanggal booking tidak valid untuk perubahan jadwal.');
      const dayRef = doc(firestoreDb, 'bookingScheduleDays', date);
      const slotRef = doc(firestoreDb, 'clientCalendarSlots', bookingId);
      const currentDate = businessDateOf(timestamp);
      const fenceRef = doc(firestoreDb, CLOSINGS, currentDate + '__main');
      const [daySnapshot, slotSnapshot, fenceSnapshot] = await Promise.all([
        transaction.get(dayRef),
        transaction.get(slotRef),
        transaction.get(fenceRef),
      ]);
      if (fenceSnapshot.exists() && fenceSnapshot.data().status === 'closed') {
        throw new Error('Tanggal bisnis sudah ditutup. Perubahan ditolak.');
      }
      const nextBooking = {
        ...booking,
        invoiceAmount: 0,
        invoiceStatus: 'void',
        paymentStatus: 'void',
        paymentStatusCanonical: 'void',
        updatedAt: timestamp,
        voidReason: reason,
        voidedAt: timestamp,
        voidedByName: actor.displayName,
        voidedByUid: actor.uid,
        lastFinanceAction: 'void',
        lastFinanceBusinessDate: businessDateOf(timestamp),
        lastFinanceLedgerEntryId: '',
        lastFinanceOperationId: operationId,
        lastFinanceEventId: '',
        lastFinanceProofId: '',
      };
      const nextDay = {
        ...(daySnapshot.exists() ? daySnapshot.data() : {}),
        date,
        lastBookingId: bookingId,
        revision: Number(daySnapshot.data()?.revision || 0) + 1,
        updatedAt: timestamp,
      };
      transaction.update(bookingRef, nextBooking);
      transaction.set(dayRef, nextDay);
      if (slotSnapshot.exists()) transaction.delete(slotRef);
      await touchBusinessFence(transaction, fenceRef, fenceSnapshot, actor, timestamp, operationId, 'void', bookingId, '', '');
      return { collection: BOOKINGS, id: bookingId };
    },
  });
  const saved = await getDocFromServer(bookingRef);
  if (!saved.exists()) throw new Error('Booking tidak ditemukan setelah void.');
  return { booking: { id: saved.id, ...saved.data() }, duplicate: operationResult.replayed };
}

export async function rejectPaymentProofDirect(proofId, reviewer, adminNote = '', operationRequestId = '') {
  const actor = await requirePrincipal('billing');
  const cleanId = cleanText(proofId, 160);
  const reason = cleanText(adminNote, 600);
  if (!cleanId || reason.length < 4) throw new Error('Bukti dan alasan penolakan minimal 4 karakter wajib diisi.');
  const requestId = cleanText(operationRequestId || createRepositoryRequestId(), 128);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'finance', action: 'proof-reject', requestId,
  });
  const proofRef = doc(firestoreDb, PROOFS, cleanId);
  await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'finance', action: 'proof-reject', requestId,
    payload: { proofId: cleanId, reason },
    execute: async (transaction) => {
      const snapshot = await transaction.get(proofRef);
      if (!snapshot.exists()) throw new Error('Bukti pembayaran tidak ditemukan.');
      const proof = snapshot.data();
      if (proof.status !== 'pending') throw new Error('Bukti sudah direview dan bersifat read-only.');
      transaction.update(proofRef, {
        adminNote: reason,
        reviewedAt: isoNow(),
        reviewedByName: actor.displayName,
        reviewedByUid: actor.uid,
        reviewDecision: 'rejected',
        reviewOperationId: operationId,
        status: 'rejected',
        updatedAt: isoNow(),
      });
      return { collection: PROOFS, id: cleanId };
    },
  });
  const result = await getDocFromServer(proofRef);
  if (!result.exists()) throw new Error('Bukti pembayaran tidak ditemukan setelah review.');
  return { id: result.id, ...result.data() };
}

export async function approvePaymentProofDirect({
  adminNote = '', amount, booking, method, proof,
}, operationRequestId = '') {
  if (!booking?.id || !proof?.id || proof.status !== 'pending') throw new Error('Booking atau bukti pembayaran tidak valid.');
  const value = money(amount);
  if (!value) throw new Error('Konfirmasi nominal pembayaran wajib diisi.');
  const paymentMethod = normalizeMethod(method);
  return runBookingFinanceOperation({
    actor: await requirePrincipal('billing'),
    action: 'proof-approve',
    amount: value,
    bookingId: cleanText(booking.id, 160),
    date: businessDateOf(isoNow()),
    method: paymentMethod,
    note: cleanText(adminNote || proof.clientNote || 'Bukti pembayaran disetujui', 600),
    proofId: cleanText(proof.id, 160),
    source: 'payment-proof',
    requestId: cleanText(operationRequestId || createRepositoryRequestId(), 128),
  });
}

function emptyMethodTotals() {
  return Object.fromEntries(METHODS.map((method) => [method, { income: 0, expense: 0, net: 0 }]));
}

function registerTransaction(totals, transaction, references) {
  const method = METHODS.includes(cleanText(transaction.method, 20).toLowerCase())
    ? cleanText(transaction.method, 20).toLowerCase()
    : 'other';
  const amount = money(transaction.amount);
  if (!amount) return;
  const direction = transaction.type === 'expense' ? 'expense' : 'income';
  totals[method][direction] += amount;
  totals[method].net = totals[method].income - totals[method].expense;
  references.push({
    amount,
    bookingId: cleanText(transaction.bookingId, 160),
    createdAt: cleanText(transaction.createdAt, 50),
    eventId: cleanText(transaction.eventId, 180),
    id: cleanText(transaction.id, 220),
    method,
    source: cleanText(transaction.source, 80),
    type: direction,
  });
}

function legacyRefundRows(booking) {
  const history = Array.isArray(booking.refundHistory) ? booking.refundHistory : [];
  if (history.length) return history.filter((row) => money(row?.amount) > 0);
  const amount = money(booking.refundedAmount);
  if (!amount) return [];
  const createdAt = booking.lastRefundAt || booking.refundCompletedAt || booking.updatedAt || booking.createdAt || booking.date || '';
  return [{
    amount,
    createdAt,
    date: createdAt,
    id: 'legacy_' + cleanText(booking.id || 'booking', 100) + '_refund',
    method: booking.lastRefundMethod || 'other',
    source: 'legacy-refund-projection',
  }];
}

async function loadLedgerEntries(date) {
  const rows = [];
  let cursor = null;
  while (rows.length < MAX_LEDGER_ROWS) {
    const constraints = [where('date', '==', date), orderBy('date'), limit(500)];
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocsFromServer(query(collection(firestoreDb, LEDGER), ...constraints));
    rows.push(...snapshot.docs);
    if (snapshot.size < 500) return rows;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
  throw new Error('Volume ledger tanggal ini melampaui batas aman closing.');
}

async function loadAllBookings() {
  const rows = [];
  let cursor = null;
  let pages = 0;
  do {
    const constraints = [orderBy(documentId()), limit(500)];
    if (cursor) constraints.push(startAfter(cursor));
    const snapshot = await getDocsFromServer(query(collection(firestoreDb, BOOKINGS), ...constraints));
    rows.push(...snapshot.docs);
    pages += 1;
    cursor = snapshot.docs.length === 500 ? snapshot.docs[snapshot.docs.length - 1] : null;
    if (pages >= MAX_BOOKING_PAGES && cursor) throw new Error('Jumlah booking terlalu besar untuk dipindai dalam satu closing.');
    if (snapshot.size < 500) break;
  } while (cursor);
  return rows;
}

async function sha256Hex(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function collectDailyTransactions(businessDate, ledgerDocuments, bookingDocuments) {
  const totals = emptyMethodTotals();
  const references = [];
  const canonicalEvents = new Set();
  ledgerDocuments.forEach((document) => {
    const row = document.data();
    if (!['income', 'expense'].includes(row.type)) return;
    const bookingId = cleanText(row.sourceBookingId, 160);
    const eventId = cleanText(row.sourceEventId, 180);
    if (bookingId && eventId) canonicalEvents.add(bookingId + ':' + eventId);
    registerTransaction(totals, {
      amount: row.amount,
      bookingId,
      createdAt: row.createdAt || row.updatedAt,
      eventId,
      id: document.id,
      method: row.paymentMethod,
      source: row.source || 'manual',
      type: row.type,
    }, references);
  });
  bookingDocuments.forEach((document) => {
    const booking = { id: document.id, ...document.data() };
    const bookingId = cleanText(booking.id, 160);
    normalizePaymentHistory(booking).forEach((payment, index) => {
      if (businessDateOf(payment.date || payment.createdAt || payment.timestamp) !== businessDate) return;
      const eventId = cleanText(payment.id, 180) || 'legacy_payment_' + index;
      if (canonicalEvents.has(bookingId + ':' + eventId)) return;
      registerTransaction(totals, {
        amount: payment.amount,
        bookingId,
        createdAt: payment.createdAt || payment.date,
        eventId,
        id: 'legacy-payment:' + bookingId + ':' + eventId,
        method: payment.method || payment.paymentMethod || booking.lastPaymentMethod || booking.paymentMethod,
        source: 'legacy-booking-payment',
        type: 'income',
      }, references);
    });
    legacyRefundRows(booking).forEach((refund, index) => {
      if (businessDateOf(refund.date || refund.createdAt || refund.timestamp) !== businessDate) return;
      const eventId = cleanText(refund.id, 180) || 'legacy_refund_' + index;
      if (canonicalEvents.has(bookingId + ':' + eventId)) return;
      registerTransaction(totals, {
        amount: refund.amount,
        bookingId,
        createdAt: refund.createdAt || refund.date,
        eventId,
        id: 'legacy-refund:' + bookingId + ':' + eventId,
        method: refund.method || refund.paymentMethod || booking.lastRefundMethod || 'other',
        source: 'legacy-booking-refund',
        type: 'expense',
      }, references);
    });
  });
  references.sort((a, b) => a.id.localeCompare(b.id));
  if (references.length > MAX_CLOSING_REFERENCES) throw new Error('Jumlah transaksi melebihi kapasitas snapshot closing.');
  const sourceFingerprint = await sha256Hex(JSON.stringify(references));
  const sourceWatermark = references.map((row) => row.createdAt).filter(Boolean).sort().at(-1) || '';
  return { references, sourceFingerprint, sourceWatermark, totals };
}

function normalizeCounts(body, required = false) {
  const denominationSource = body.cashDenominations && typeof body.cashDenominations === 'object'
    ? body.cashDenominations : null;
  if (required && !denominationSource) throw new Error('Rincian pecahan uang fisik wajib diisi untuk menyimpan closing.');
  const cashDenominations = {};
  let countedByDenominations = 0;
  DENOMINATIONS.forEach((denomination) => {
    const raw = denominationSource?.[String(denomination)] ?? 0;
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 0 || count > 100000) throw new Error('Jumlah pecahan uang tidak valid.');
    cashDenominations[String(denomination)] = count;
    countedByDenominations += denomination * count;
  });
  const openingCash = body.openingCash === '' || body.openingCash === undefined || body.openingCash === null
    ? null : money(body.openingCash);
  const suppliedCash = body.countedCash === '' || body.countedCash === undefined || body.countedCash === null
    ? null : money(body.countedCash);
  if (denominationSource && suppliedCash !== null && suppliedCash !== countedByDenominations) {
    throw new Error('Total kas harus sama dengan penjumlahan rincian pecahan uang.');
  }
  const countedCash = denominationSource ? countedByDenominations : suppliedCash;
  if (required && openingCash === null) throw new Error('Opening cash wajib diisi.');
  if (required && countedCash === null) throw new Error('Cash fisik terhitung wajib diisi.');
  const digitalSource = body.digitalCounts && typeof body.digitalCounts === 'object' ? body.digitalCounts : {};
  const digitalCounts = {};
  METHODS.filter((method) => method !== 'cash').forEach((method) => {
    const raw = digitalSource[method];
    digitalCounts[method] = raw === '' || raw === undefined || raw === null ? null : signedMoney(raw);
    if (required && digitalCounts[method] === null) throw new Error('Net ' + method.toUpperCase() + ' wajib diisi.');
  });
  return { cashDenominations, countedCash, digitalCounts, openingCash };
}

function reconcile(totals, counts) {
  const expectedCash = counts.openingCash === null ? null : counts.openingCash + totals.cash.net;
  const cashVariance = counts.countedCash === null || expectedCash === null ? null : counts.countedCash - expectedCash;
  const digital = {};
  METHODS.filter((method) => method !== 'cash').forEach((method) => {
    const counted = counts.digitalCounts[method];
    const expected = totals[method].net;
    digital[method] = { counted, expected, variance: counted === null ? null : counted - expected };
  });
  const variances = [cashVariance, ...Object.values(digital).map((row) => row.variance)];
  return { cashVariance, digital, expectedCash, hasVariance: variances.some((value) => value !== null && value !== 0) };
}

async function loadClosingEvents(sessionId) {
  const snapshot = await getDocsFromServer(query(
    collection(firestoreDb, CLOSING_EVENTS),
    where('closingId', '==', sessionId),
    limit(100),
  ));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function summarizeLatePostings(session, currentReferences) {
  const previous = new Set((Array.isArray(session?.transactionReferences) ? session.transactionReferences : []).map((row) => row.id));
  return currentReferences.filter((row) => !previous.has(row.id));
}

function buildPreview({ actor, businessDate, collected, counts, events, existing, registerId }) {
  const isClosed = existing?.status === 'closed';
  const snapshotCounts = isClosed ? {
    openingCash: existing.openingCash,
    cashDenominations: existing.cashDenominations || {},
    countedCash: existing.countedCash,
    digitalCounts: existing.digitalCounts || {},
  } : counts;
  const snapshotTotals = isClosed ? existing.totalsByMethod : collected.totals;
  const computed = reconcile(snapshotTotals, snapshotCounts);
  const latePostingExceptions = existing?.cutoffAt ? summarizeLatePostings(existing, collected.references) : [];
  const reconciliation = isClosed ? {
    ...computed,
    cashVariance: existing.cashVariance,
    digital: existing.digitalReconciliation || computed.digital,
    expectedCash: existing.expectedCash,
    hasVariance: Number(existing.cashVariance || 0) !== 0 ||
      Object.values(existing.digitalReconciliation || {}).some((row) => Number(row.variance || 0) !== 0),
  } : computed;
  return {
    businessDate,
    canReopen: actor.principal.isOwner,
    counts: snapshotCounts,
    cutoffAt: existing?.cutoffAt || '',
    digitalReconciliation: reconciliation.digital,
    expectedCash: isClosed ? existing.expectedCash : reconciliation.expectedCash,
    events: events || [],
    existingSession: existing ? { ...existing } : null,
    isClosed,
    latePostingExceptions,
    latePostingCount: latePostingExceptions.length,
    reconciliation,
    registerId,
    sourceFingerprint: isClosed ? existing.sourceFingerprint : collected.sourceFingerprint,
    sourceWatermark: isClosed ? existing.sourceWatermark : collected.sourceWatermark,
    status: existing?.status || 'not_opened',
    totalsByMethod: snapshotTotals,
    transactionCount: isClosed ? existing.transactionCount : collected.references.length,
    transactionReferences: isClosed ? (existing.transactionReferences || []) : collected.references,
  };
}

async function loadDailySnapshot(businessDate, actor, body = {}) {
  // Capture the activity fence before querying source collections. The close
  // transaction compares this revision again immediately before commit.
  const fence = await readBusinessFence(businessDate);
  const [ledgerDocuments, bookingDocuments] = await Promise.all([
    loadLedgerEntries(businessDate),
    loadAllBookings(),
  ]);
  const collected = await collectDailyTransactions(businessDate, ledgerDocuments, bookingDocuments);
  const existing = fence.data;
  const events = existing ? await loadClosingEvents(existing.id || businessDate + '__main') : [];
  return {
    collected,
    events,
    fence,
    preview: buildPreview({
      actor,
      businessDate,
      collected,
      counts: normalizeCounts(body, false),
      events,
      existing,
      registerId: 'main',
    }),
  };
}

export async function previewDailyClosingDirect(body = {}) {
  const actor = await requirePrincipal('bookkeeping');
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new Error('Tanggal bisnis wajib valid (YYYY-MM-DD).');
  const { preview } = await loadDailySnapshot(businessDate, actor, body);
  return { ...preview, generatedAt: isoNow(), ok: true };
}

export async function closeDailyClosingDirect(body = {}, operationRequestId = '') {
  const actor = await requirePrincipal('bookkeeping');
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new Error('Tanggal bisnis wajib valid (YYYY-MM-DD).');
  if (businessDate > businessDateOf(isoNow())) throw new Error('Tanggal bisnis di masa depan belum dapat ditutup.');
  const counts = normalizeCounts(body, true);
  const requestId = cleanText(operationRequestId || body.requestId || createRepositoryRequestId(), 128);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'finance', action: 'daily-close', requestId,
  });
  const snapshot = await loadDailySnapshot(businessDate, actor, body);
  const sessionId = businessDate + '__main';
  const timestamp = isoNow();
  const revision = Math.max(0, Number(snapshot.fence.data?.revision || 0)) + 1;
  const reconciliation = reconcile(snapshot.collected.totals, counts);
  const varianceReason = cleanText(body.varianceReason || body.reason, 600);
  if (reconciliation.hasVariance && varianceReason.length < 4) throw new Error('Alasan selisih wajib diisi minimal 4 karakter.');
  const sessionRef = doc(firestoreDb, CLOSINGS, sessionId);
  const eventId = 'closing_' + operationId.slice(3);
  const eventRef = doc(firestoreDb, CLOSING_EVENTS, eventId);
  const session = {
    businessDate,
    cashVariance: reconciliation.cashVariance,
    closedAt: timestamp,
    closedByName: actor.displayName,
    closedByUid: actor.uid,
    cashDenominations: counts.cashDenominations,
    countedCash: counts.countedCash,
    createdAt: snapshot.fence.data?.createdAt || timestamp,
    cutoffAt: timestamp,
    digitalCounts: counts.digitalCounts,
    digitalReconciliation: reconciliation.digital,
    expectedCash: reconciliation.expectedCash,
    id: sessionId,
    lastEventAt: timestamp,
    lastEventId: eventId,
    lastEventType: 'closed',
    openingCash: counts.openingCash,
    reviewNote: cleanText(body.reviewNote, 1000),
    registerId: 'main',
    revision,
    sourceFingerprint: snapshot.collected.sourceFingerprint,
    sourceWatermark: snapshot.collected.sourceWatermark,
    status: 'closed',
    totalsByMethod: snapshot.collected.totals,
    transactionCount: snapshot.collected.references.length,
    transactionReferences: snapshot.collected.references,
    updatedAt: timestamp,
    varianceReason,
    activityRevision: Number(snapshot.fence.data?.activityRevision || 0),
    lastFinanceOperationId: operationId,
    lastOperationId: operationId,
    lastOperationAction: 'daily-close',
  };
  const event = {
    action: 'closed',
    actorName: actor.displayName,
    actorUid: actor.uid,
    businessDate,
    closingId: sessionId,
    createdAt: timestamp,
    id: eventId,
    reason: varianceReason,
    registerId: 'main',
    revision,
    sourceFingerprint: snapshot.collected.sourceFingerprint,
    snapshot: {
      businessDate,
      cashVariance: reconciliation.cashVariance,
      cashDenominations: counts.cashDenominations,
      countedCash: counts.countedCash,
      cutoffAt: timestamp,
      digitalCounts: counts.digitalCounts,
      digitalReconciliation: reconciliation.digital,
      expectedCash: reconciliation.expectedCash,
      openingCash: counts.openingCash,
      registerId: 'main',
      reviewNote: cleanText(body.reviewNote, 1000),
      revision,
      sourceFingerprint: snapshot.collected.sourceFingerprint,
      sourceWatermark: snapshot.collected.sourceWatermark,
      totalsByMethod: snapshot.collected.totals,
      transactionCount: snapshot.collected.references.length,
      transactionReferences: snapshot.collected.references,
      varianceReason,
    },
    summary: {
      cashVariance: reconciliation.cashVariance,
      expectedCash: reconciliation.expectedCash,
      transactionCount: snapshot.collected.references.length,
    },
    type: 'cash-closing-event',
    operationId,
  };

  const result = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'finance', action: 'daily-close', requestId,
    payload: { businessDate, counts, varianceReason, reviewNote: cleanText(body.reviewNote, 1000), sourceFingerprint: snapshot.collected.sourceFingerprint },
    execute: async (transaction) => {
      const currentSession = await transaction.get(sessionRef);
      const current = currentSession.exists() ? currentSession.data() : null;
      if (current?.status === 'closed') throw new Error('Tanggal dan register ini sudah ditutup.');
      if (Number(current?.activityRevision || 0) !== Number(snapshot.fence.data?.activityRevision || 0)) {
        throw new Error('Transaksi berubah saat closing disiapkan. Muat ulang preview sebelum menutup hari.');
      }
      transaction.set(sessionRef, session);
      transaction.set(eventRef, event);
      return { collection: CLOSINGS, id: sessionId };
    },
  });
  const [savedSession, savedEvents] = await Promise.all([
    getDocFromServer(sessionRef),
    loadClosingEvents(sessionId),
  ]);
  return { duplicate: result.replayed, event: savedEvents.find((row) => row.id === eventId) || event,
    session: savedSession.exists() ? { id: savedSession.id, ...savedSession.data() } : session };
}

export async function reopenDailyClosingDirect(body = {}, operationRequestId = '') {
  const actor = await requirePrincipal('bookkeeping');
  if (!actor.principal.isOwner) throw new Error('Reopen closing hanya dapat dilakukan Owner.');
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new Error('Tanggal bisnis wajib valid (YYYY-MM-DD).');
  const reason = cleanText(body.reason, 600);
  if (reason.length < 4) throw new Error('Alasan reopen wajib diisi minimal 4 karakter.');
  const requestId = cleanText(operationRequestId || body.requestId || createRepositoryRequestId(), 128);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'finance', action: 'daily-reopen', requestId,
  });
  const sessionId = businessDate + '__main';
  const sessionRef = doc(firestoreDb, CLOSINGS, sessionId);
  const eventId = 'closing_' + operationId.slice(3);
  const eventRef = doc(firestoreDb, CLOSING_EVENTS, eventId);
  const timestamp = isoNow();
  const transactionResult = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'finance', action: 'daily-reopen', requestId,
    payload: { businessDate, reason },
    execute: async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      if (!sessionSnapshot.exists() || sessionSnapshot.data().status !== 'closed') {
        throw new Error('Hanya closing berstatus Closed yang dapat dibuka kembali.');
      }
      const current = sessionSnapshot.data();
      const session = {
        ...current,
        id: sessionId,
        lastEventAt: timestamp,
        lastEventId: eventId,
        lastEventType: 'reopened',
        reopenReason: reason,
        reopenedAt: timestamp,
        reopenedByName: actor.displayName,
        reopenedByUid: actor.uid,
        status: 'reopened',
        activityRevision: Number(current.activityRevision || 0) + 1,
        updatedAt: timestamp,
        lastFinanceOperationId: operationId,
        lastOperationId: operationId,
        lastOperationAction: 'daily-reopen',
        lastBookingId: '',
        lastLedgerEntryId: '',
        lastProofId: '',
      };
      const event = {
        action: 'reopened',
        actorName: actor.displayName,
        actorUid: actor.uid,
        businessDate,
        closingId: sessionId,
        createdAt: timestamp,
        id: eventId,
        reason,
        registerId: 'main',
        revision: Number(current.revision || 1),
        sourceFingerprint: current.sourceFingerprint || '',
        type: 'cash-closing-event',
        operationId,
      };
      transaction.set(sessionRef, session);
      transaction.set(eventRef, event);
      return { collection: CLOSINGS, id: sessionId };
    },
  });
  const saved = await getDocFromServer(sessionRef);
  if (!saved.exists()) throw new Error('Closing tidak ditemukan setelah reopen.');
  const events = await loadClosingEvents(sessionId);
  return { duplicate: transactionResult.replayed, event: events.find((row) => row.id === eventId) || null,
    session: { id: saved.id, ...saved.data() } };
}

export async function createManualBookkeepingEntry(input = {}, operationRequestId = '') {
  const actor = await requirePrincipal('bookkeeping');
  const entryId = cleanText(input.id, 160) || doc(collection(firestoreDb, LEDGER)).id;
  const requestId = cleanText(operationRequestId || input.requestId || createRepositoryRequestId(), 128);
  const timestamp = isoNow();
  const date = cleanOperationDate(input.date, timestamp);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-create', requestId,
  });
  const entry = {
    actorName: actor.displayName,
    actorUid: actor.uid,
    amount: money(input.amount),
    category: cleanText(input.category || 'other', 80),
    createdAt: timestamp,
    date,
    id: entryId,
    idempotencyKey: requestId,
    operationId,
    immutable: false,
    note: cleanText(input.note, 2000),
    paymentMethod: normalizeMethod(input.paymentMethod || input.method || 'cash'),
    reversalOf: '',
    source: 'manual',
    sourceAction: '',
    sourceAttendanceDate: '',
    sourceAttendanceId: '',
    sourceBookingId: '',
    sourceEventId: '',
    sourceFeeEntryId: '',
    sourceGuardPersonId: '',
    sourceWorkOrderId: '',
    title: cleanText(input.title, 160),
    type: ['income', 'expense'].includes(input.type) ? input.type : 'expense',
    updatedAt: timestamp,
  };
  if (!entry.amount || !entry.title) throw new Error('Judul dan nominal jurnal wajib diisi.');
  const entryRef = doc(firestoreDb, LEDGER, entryId);
  const fenceRef = doc(firestoreDb, CLOSINGS, date + '__main');
  const result = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-create', requestId,
    // Exclude generated document IDs, timestamps, and actor metadata from the
    // idempotency hash. A retry with the same request ID must replay the
    // original document even when the first response was lost after commit.
    payload: {
      amount: entry.amount,
      category: entry.category,
      date: entry.date,
      note: entry.note,
      paymentMethod: entry.paymentMethod,
      title: entry.title,
      type: entry.type,
    },
    execute: async (transaction) => {
      const [existing, fenceSnapshot] = await Promise.all([
        transaction.get(entryRef),
        transaction.get(fenceRef),
      ]);
      if (existing.exists()) throw new Error('ID transaksi pembukuan sudah digunakan.');
      await touchBusinessFence(transaction, fenceRef, fenceSnapshot, actor, timestamp,
        operationId, 'manual-create', '', entryId, '');
      transaction.set(entryRef, entry);
      return { collection: LEDGER, id: entryId };
    },
  });
  const savedId = result.replayed ? result.result.id : entryId;
  const savedRef = doc(firestoreDb, LEDGER, savedId);
  const saved = await getDocFromServer(savedRef);
  if (!saved.exists()) throw new Error('Jurnal tidak ditemukan setelah penyimpanan.');
  return { id: saved.id, ...saved.data(), duplicate: result.replayed };
}

export async function updateManualBookkeepingEntry(input = {}, operationRequestId = '') {
  const actor = await requirePrincipal('bookkeeping');
  const entryId = cleanText(input.id, 160);
  if (!entryId) throw new Error('Bookkeeping entry ID wajib diisi.');
  const requestId = cleanText(operationRequestId || input.requestId || createRepositoryRequestId(), 128);
  const timestamp = isoNow();
  const entryRef = doc(firestoreDb, LEDGER, entryId);
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-update', requestId,
  });
  const operationResult = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-update', requestId,
    payload: input,
    execute: async (transaction) => {
      const currentSnapshot = await transaction.get(entryRef);
      if (!currentSnapshot.exists()) throw new Error('Jurnal tidak ditemukan.');
      const current = currentSnapshot.data();
      if (current.immutable === true || (current.source && current.source !== 'manual')) {
        throw new Error('Transaksi hasil rekonsiliasi bersifat read-only.');
      }
      const next = {
        ...current,
        source: 'manual',
        actorName: cleanText(current.actorName || actor.displayName, 120),
        actorUid: cleanText(current.actorUid || actor.uid, 128),
        idempotencyKey: cleanText(current.idempotencyKey || requestId, 240),
        immutable: false,
        sourceProofId: cleanText(current.sourceProofId),
        reversalOf: cleanText(current.reversalOf),
        amount: money(input.amount),
        category: cleanText(input.category || current.category, 80),
        date: cleanOperationDate(input.date || current.date, timestamp),
        note: cleanText(input.note, 2000),
        paymentMethod: normalizeMethod(input.paymentMethod || current.paymentMethod),
        title: cleanText(input.title || current.title, 160),
        type: ['income', 'expense'].includes(input.type) ? input.type : current.type,
        updatedAt: timestamp,
        operationId,
      };
      if (!next.amount || !next.title) throw new Error('Judul dan nominal jurnal wajib diisi.');
      const oldDate = cleanOperationDate(current.date, timestamp);
      const oldFenceRef = doc(firestoreDb, CLOSINGS, oldDate + '__main');
      const newFenceRef = doc(firestoreDb, CLOSINGS, next.date + '__main');
      const oldFenceSnapshot = await transaction.get(oldFenceRef);
      const newFenceSnapshot = oldDate === next.date ? oldFenceSnapshot : await transaction.get(newFenceRef);
      await touchBusinessFence(transaction, oldFenceRef, oldFenceSnapshot, actor, timestamp,
        operationId, 'manual-update', '', entryId, '');
      if (oldDate !== next.date) {
        await touchBusinessFence(transaction, newFenceRef, newFenceSnapshot, actor, timestamp,
          operationId, 'manual-update', '', entryId, '');
      }
      transaction.set(entryRef, next);
      return { collection: LEDGER, id: entryId };
    },
  });
  const saved = await getDocFromServer(entryRef);
  if (!saved.exists()) throw new Error('Jurnal tidak ditemukan setelah perubahan.');
  return { id: saved.id, ...saved.data(), date: saved.data().date, duplicate: operationResult.replayed };
}

export async function deleteManualBookkeepingEntry(entryId, operationRequestId = '') {
  const actor = await requirePrincipal('bookkeeping');
  const cleanId = cleanText(entryId, 160);
  if (!cleanId) throw new Error('Bookkeeping entry ID wajib diisi.');
  const requestId = cleanText(operationRequestId || createRepositoryRequestId(), 128);
  const timestamp = isoNow();
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-delete', requestId,
  });
  const entryRef = doc(firestoreDb, LEDGER, cleanId);
  const result = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: 'bookkeeping', action: 'manual-delete', requestId,
    payload: { entryId: cleanId },
    execute: async (transaction) => {
      const entrySnapshot = await transaction.get(entryRef);
      if (!entrySnapshot.exists()) throw new Error('Jurnal tidak ditemukan.');
      const entry = entrySnapshot.data();
      if (entry.immutable === true || (entry.source && entry.source !== 'manual')) {
        throw new Error('Transaksi hasil rekonsiliasi tidak dapat dihapus.');
      }
      const date = cleanOperationDate(entry.date, isoNow());
      const fenceRef = doc(firestoreDb, CLOSINGS, date + '__main');
      const fenceSnapshot = await transaction.get(fenceRef);
      await touchBusinessFence(transaction, fenceRef, fenceSnapshot, actor, timestamp,
        operationId, 'manual-delete', '', cleanId, '');
      transaction.delete(entryRef);
      return { collection: '', id: '' };
    },
  });
  return { id: cleanId, duplicate: result.replayed };
}

export const financeRepository = Object.freeze({
  recordPayment: recordFinancePayment,
  recordRefund: recordFinanceRefund,
  voidInvoice: voidFinanceInvoice,
  approvePaymentProof: approvePaymentProofDirect,
  rejectPaymentProof: rejectPaymentProofDirect,
  createManualBookkeepingEntry,
  updateManualBookkeepingEntry,
  deleteManualBookkeepingEntry,
});

export const dailyClosingRepository = Object.freeze({
  preview: previewDailyClosingDirect,
  close: closeDailyClosingDirect,
  reopen: reopenDailyClosingDirect,
});
