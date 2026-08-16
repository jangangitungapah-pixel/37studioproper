import { HttpError, cleanMoney, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

function bookingTotal(booking, paymentHistory) {
  if (Object.prototype.hasOwnProperty.call(booking, 'total') && Number.isFinite(Number(booking.total))) {
    return cleanMoney(booking.total);
  }
  if (Object.prototype.hasOwnProperty.call(booking, 'subtotal') && Number.isFinite(Number(booking.subtotal))) {
    return cleanMoney(booking.subtotal);
  }

  // Legacy documents stored only the remaining invoice amount. Reconstruct the
  // immutable total before projecting another payment so a partial payment does
  // not shrink the invoice base on the next request.
  return cleanMoney(booking.invoiceAmount) + sumAmounts(paymentHistory);
}

function payments(booking) {
  const history = Array.isArray(booking.paymentHistory)
    ? booking.paymentHistory.filter((entry) => cleanMoney(entry?.amount) > 0)
    : [];

  if (history.length) return history;

  const explicitTotal = bookingTotal(booking, []);
  const status = cleanText(booking.paymentStatusCanonical || booking.paymentStatus, 40).toLowerCase();
  const legacyAmount = Math.max(
    cleanMoney(booking.paidAmount),
    cleanMoney(booking.dpAmount),
    ['paid', 'lunas'].includes(status) ? explicitTotal : 0,
  );

  if (!legacyAmount) return [];

  const createdAt = cleanText(
    booking.lastPaymentAt || booking.createdAt || booking.date || new Date().toISOString(),
    80,
  );

  return [{
    amount: legacyAmount,
    createdAt,
    date: /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? createdAt : createdAt.slice(0, 10),
    id: `legacy_${cleanText(booking.id || 'booking', 80)}_payment`,
    idempotencyKey: `legacy:${cleanText(booking.id || 'booking', 120)}`,
    method: cleanText(booking.lastPaymentMethod || booking.paymentMethod || 'other', 80),
    note: 'Saldo pembayaran sebelum ledger canonical',
    source: 'legacy-projection',
  }];
}

function refunds(booking) {
  return Array.isArray(booking.refundHistory)
    ? booking.refundHistory.filter((entry) => cleanMoney(entry?.amount) > 0)
    : [];
}

function sumAmounts(rows) {
  return rows.reduce((total, row) => total + cleanMoney(row?.amount), 0);
}

function financeSnapshot(booking) {
  const paymentHistory = payments(booking);
  const total = bookingTotal(booking, paymentHistory);
  const refundHistory = refunds(booking);
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
    refunded,
    refundHistory,
    status,
    total,
  };
}

function legacyPaymentStatus(status) {
  return {
    paid: 'lunas',
    partial: 'dp',
    refunded: 'refunded',
    unpaid: 'pending',
    void: 'void',
  }[status] || 'pending';
}

function financeProjection(booking, snapshot, now) {
  return {
    ...booking,
    invoiceAmount: snapshot.outstanding,
    paidAmount: snapshot.netPaid,
    paymentStatus: legacyPaymentStatus(snapshot.status),
    paymentStatusCanonical: snapshot.status,
    refundedAmount: snapshot.refunded,
    updatedAt: now,
  };
}

function assertBookingOpen(snapshot) {
  if (snapshot.status === 'void') {
    throw new HttpError(409, 'invoice_void', 'Invoice sudah void dan tidak menerima pembayaran baru.');
  }
  if (snapshot.status === 'refunded') {
    throw new HttpError(409, 'invoice_refunded', 'Invoice sudah direfund penuh dan bersifat read-only.');
  }
}

function actorFields(actor) {
  return { actorName: actor.displayName, actorUid: actor.uid };
}

async function loadBooking(firestore, bookingId) {
  const cleanId = cleanText(bookingId, 160);
  if (!cleanId) throw new HttpError(400, 'booking_required', 'Booking wajib dipilih.');

  const document = await firestore.getDocument('bookings', cleanId);
  if (!document) throw new HttpError(404, 'booking_not_found', 'Booking tidak ditemukan.');

  return document;
}

async function ledgerWrite({ actor, booking, event, firestore, type }) {
  const id = await stableDocumentId('ledger', `${type}:${booking.id}:${event.idempotencyKey}`);
  const isRefund = type === 'booking-refund';
  const data = {
    amount: event.amount,
    ...actorFields(actor),
    category: isRefund ? 'refund' : 'booking',
    createdAt: event.createdAt,
    date: event.date,
    id,
    idempotencyKey: event.idempotencyKey,
    immutable: true,
    note: isRefund ? event.reason : event.note,
    paymentMethod: event.method,
    reversalOf: '',
    source: type,
    sourceAction: isRefund ? 'refund' : 'payment',
    sourceBookingId: booking.id,
    sourceEventId: event.id,
    title: `${isRefund ? 'Refund' : 'Pembayaran'} ${booking.invoiceNumber || booking.bookingCode || booking.id}`,
    type: isRefund ? 'expense' : 'income',
    updatedAt: event.createdAt,
  };

  return firestore.setWrite('bookkeepingEntries', id, data, { exists: false });
}

function paymentEvent({ actor, body, key, source }) {
  const amount = cleanMoney(body.amount);
  const method = cleanPaymentMethod(body.method);
  const now = new Date().toISOString();
  const date = cleanOperationDate(body.date, now);

  if (!amount) throw new HttpError(400, 'amount_required', 'Nominal pembayaran wajib lebih dari 0.');

  return {
    ...actorFields(actor),
    amount,
    createdAt: now,
    date,
    id: `payment_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method,
    note: cleanText(body.note, 600),
    source,
  };
}

const VALID_PAYMENT_METHODS = new Set(['cash', 'transfer', 'qris', 'other']);

function cleanPaymentMethod(value) {
  const method = cleanText(value, 20).toLowerCase();
  if (!VALID_PAYMENT_METHODS.has(method)) {
    throw new HttpError(400, 'invalid_payment_method', 'Metode wajib cash, transfer, qris, atau other.');
  }
  return method;
}

function cleanOperationDate(value, now = new Date().toISOString()) {
  if (value === undefined || value === null || value === '') return now.slice(0, 10);
  const date = String(value);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new HttpError(400, 'invalid_date', 'Tanggal operasi tidak valid.');
  const year = Number(match[1]);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    year < 2000 || year > 2100 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new HttpError(400, 'invalid_date', 'Tanggal operasi tidak valid.');
  }
  return date;
}

export async function recordPayment({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'payment', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  assertBookingOpen(before);
  const event = paymentEvent({ actor, body, key, source: cleanText(body.source || 'admin-payment', 80) });

  if (event.amount > before.outstanding) {
    throw new HttpError(
      400,
      'amount_exceeds_outstanding',
      'Nominal pembayaran melebihi sisa invoice.',
      { outstanding: before.outstanding },
    );
  }

  const paymentHistory = [...before.paymentHistory, event];
  const nextBase = { ...booking, paymentHistory, total: before.total };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, event.createdAt),
    dpAmount: after.status === 'partial' ? after.netPaid : 0,
    lastPaymentAt: event.createdAt,
    lastPaymentMethod: event.method,
  };
  const result = {
    booking: nextBooking,
    ledgerEventId: await stableDocumentId('ledger', `booking-payment:${booking.id}:${key}`),
    payment: event,
    snapshot: after,
  };
  const writes = [
    firestore.setWrite('bookings', booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
    await ledgerWrite({ actor, booking, event, firestore, type: 'booking-payment' }),
  ];
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: 'bookings', documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { ledgerEventId: result.ledgerEventId },
    targetId: booking.id,
    type: 'payment',
    writes,
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

export async function recordRefund({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'refund', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  const amount = cleanMoney(body.amount);
  const reason = cleanText(body.reason, 600);

  if (before.status === 'void') throw new HttpError(409, 'invoice_void', 'Invoice void tidak dapat direfund.');
  if (!amount) throw new HttpError(400, 'amount_required', 'Nominal refund wajib lebih dari 0.');
  if (reason.length < 4) throw new HttpError(400, 'reason_required', 'Alasan refund minimal 4 karakter.');
  const refundable = Math.max(0, before.grossPaid - before.refunded);
  if (!refundable || amount > refundable) {
    throw new HttpError(400, 'amount_exceeds_refundable', 'Nominal melebihi saldo yang dapat direfund.', { refundable });
  }

  const now = new Date().toISOString();
  const event = {
    ...actorFields(actor),
    amount,
    createdAt: now,
    date: cleanOperationDate(body.date, now),
    id: `refund_${key.slice(0, 80)}`,
    idempotencyKey: key,
    method: cleanPaymentMethod(body.method),
    reason,
    source: cleanText(body.source || 'admin-refund', 80),
  };
  const nextBase = {
    ...booking,
    paymentHistory: before.paymentHistory,
    refundHistory: [...before.refundHistory, event],
    total: before.total,
  };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, now),
    lastRefundAt: now,
    lastRefundMethod: event.method,
    lastRefundReason: reason,
    refundStatus: after.status === 'refunded' ? 'full' : 'partial',
  };
  const result = {
    booking: nextBooking,
    ledgerEventId: await stableDocumentId('ledger', `booking-refund:${booking.id}:${key}`),
    refund: event,
    snapshot: after,
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: 'bookings', documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { ledgerEventId: result.ledgerEventId },
    targetId: booking.id,
    type: 'refund',
    writes: [
      firestore.setWrite('bookings', booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
      await ledgerWrite({ actor, booking, event, firestore, type: 'booking-refund' }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

export async function voidInvoice({ actor, body, firestore, request }) {
  const key = getIdempotencyKey(request, body);
  const existing = await readOperationResult(firestore, 'invoice-void', key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const bookingDocument = await loadBooking(firestore, body.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  const reason = cleanText(body.reason, 600);
  if (reason.length < 4) throw new HttpError(400, 'reason_required', 'Alasan void minimal 4 karakter.');
  if (before.status === 'void') throw new HttpError(409, 'already_void', 'Invoice sudah void.');
  if (before.netPaid > 0) {
    throw new HttpError(
      409,
      'refund_required',
      'Invoice masih memiliki pembayaran bersih. Catat refund sebelum void.',
      { refundable: before.netPaid },
    );
  }

  const now = new Date().toISOString();
  const nextBooking = {
    ...booking,
    invoiceAmount: 0,
    invoiceStatus: 'void',
    paymentStatus: 'void',
    paymentStatusCanonical: 'void',
    updatedAt: now,
    voidReason: reason,
    voidedAt: now,
    voidedByName: actor.displayName,
    voidedByUid: actor.uid,
  };
  const result = { booking: nextBooking, reason, status: 'void' };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: { booking: { collectionId: 'bookings', documentId: booking.id } },
    firestore,
    key,
    result,
    receipt: { reason, status: 'void' },
    targetId: booking.id,
    type: 'invoice-void',
    writes: [
      firestore.setWrite('bookings', booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}

export async function reviewPaymentProof({ actor, body, firestore, proofId, request, decision }) {
  const type = decision === 'approve' ? 'payment-proof-approve' : 'payment-proof-reject';
  const key = getIdempotencyKey(request, body, `${type}:${proofId}`);
  const existing = await readOperationResult(firestore, type, key);
  if (existing.result) return { ...existing.result, duplicate: true };

  const proofDocument = await firestore.getDocument('paymentProofs', cleanText(proofId, 160));
  if (!proofDocument) throw new HttpError(404, 'proof_not_found', 'Bukti pembayaran tidak ditemukan.');
  const proof = { id: proofDocument.id, ...proofDocument.data };
  if (proof.status !== 'pending') throw new HttpError(409, 'proof_reviewed', 'Bukti sudah direview dan bersifat read-only.');
  const now = new Date().toISOString();
  const note = cleanText(body.note || body.reason, 600);

  if (decision === 'reject') {
    if (note.length < 4) throw new HttpError(400, 'reason_required', 'Alasan penolakan minimal 4 karakter.');
    const nextProof = {
      ...proof,
      adminNote: note,
      reviewedAt: now,
      reviewedByName: actor.displayName,
      reviewedByUid: actor.uid,
      status: 'rejected',
      updatedAt: now,
    };
    const result = { proof: nextProof };
    const committed = await commitIdempotentOperation({
      actor,
      documentRefs: { proof: { collectionId: 'paymentProofs', documentId: proof.id } },
      firestore,
      key,
      result,
      receipt: {},
      targetId: proof.id,
      type,
      writes: [
        firestore.setWrite('paymentProofs', proof.id, nextProof, { updateTime: proofDocument.updateTime }),
      ],
    });
    return { ...committed.result, duplicate: committed.duplicate };
  }

  const bookingDocument = await loadBooking(firestore, proof.bookingId);
  const booking = { id: bookingDocument.id, ...bookingDocument.data };
  const before = financeSnapshot(booking);
  assertBookingOpen(before);
  if (!Object.prototype.hasOwnProperty.call(body, 'amount')) {
    throw new HttpError(400, 'amount_confirmation_required', 'Konfirmasi nominal pembayaran wajib diisi.');
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'method')) {
    throw new HttpError(400, 'method_confirmation_required', 'Konfirmasi metode pembayaran wajib diisi.');
  }
  const event = paymentEvent({
    actor,
    body: {
      ...body,
      amount: body.amount,
      method: body.method,
      note: note || proof.clientNote || 'Bukti pembayaran disetujui',
    },
    key,
    source: 'payment-proof',
  });
  if (event.amount > before.outstanding) {
    throw new HttpError(400, 'amount_exceeds_outstanding', 'Nominal bukti melebihi sisa invoice.', { outstanding: before.outstanding });
  }
  const nextBase = {
    ...booking,
    paymentHistory: [...before.paymentHistory, event],
    total: before.total,
  };
  const after = financeSnapshot(nextBase);
  const nextBooking = {
    ...financeProjection(nextBase, after, now),
    dpAmount: after.status === 'partial' ? after.netPaid : 0,
    lastPaymentAt: event.createdAt,
    lastPaymentMethod: event.method,
  };
  const nextProof = {
    ...proof,
    adminNote: note,
    approvedAmount: event.amount,
    approvedMethod: event.method,
    reviewedAt: now,
    reviewedByName: actor.displayName,
    reviewedByUid: actor.uid,
    status: 'approved',
    updatedAt: now,
  };
  const result = { booking: nextBooking, payment: event, proof: nextProof, snapshot: after };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      booking: { collectionId: 'bookings', documentId: booking.id },
      proof: { collectionId: 'paymentProofs', documentId: proof.id },
    },
    firestore,
    key,
    result,
    receipt: {},
    targetId: proof.id,
    type,
    writes: [
      firestore.setWrite('bookings', booking.id, nextBooking, { updateTime: bookingDocument.updateTime }),
      firestore.setWrite('paymentProofs', proof.id, nextProof, { updateTime: proofDocument.updateTime }),
      await ledgerWrite({ actor, booking, event, firestore, type: 'booking-payment' }),
    ],
  });

  return { ...committed.result, duplicate: committed.duplicate };
}
