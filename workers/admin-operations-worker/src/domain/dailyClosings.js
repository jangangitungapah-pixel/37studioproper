import { HttpError, cleanMoney, cleanText, getIdempotencyKey } from '../lib/http.js';
import { commitIdempotentOperation, readOperationResult } from '../lib/operation.js';
import { stableDocumentId } from '../lib/firestore.js';

const BUSINESS_TIME_ZONE = 'Asia/Jakarta';
const METHODS = Object.freeze(['cash', 'transfer', 'qris', 'other']);
const CASH_DENOMINATIONS = Object.freeze([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]);
const MAX_QUERY_ROWS = 10_000;
const MAX_BOOKING_PAGES = 50;
const MAX_TRANSACTION_REFERENCES = 1_000;

function validBusinessDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(date + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
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

function normalizeRegisterId(value) {
  const registerId = cleanText(value || 'main', 40).toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(registerId)) {
    throw new HttpError(400, 'invalid_register', 'Register ID hanya boleh berisi huruf, angka, tanda hubung, dan underscore.');
  }
  if (registerId !== 'main') {
    throw new HttpError(400, 'register_not_supported', 'Register tambahan belum diaktifkan. MVP saat ini menggunakan register main.');
  }
  return registerId;
}

function sessionDocumentId(businessDate, registerId) {
  return businessDate + '__' + registerId;
}

function optionalMoney(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) {
    throw new HttpError(400, 'invalid_amount', field + ' harus berupa nominal non-negatif yang valid.');
  }
  return Math.round(amount);
}

function requiredMoney(value, field) {
  const amount = optionalMoney(value, field);
  if (amount === null) throw new HttpError(400, 'amount_required', field + ' wajib diisi.');
  return amount;
}

function normalizeMethod(value) {
  const method = cleanText(value, 30).toLowerCase();
  return METHODS.includes(method) ? method : 'other';
}

function emptyMethodTotals() {
  return Object.fromEntries(METHODS.map((method) => [method, { income: 0, expense: 0, net: 0 }]));
}

function addTransaction(totals, transaction, references) {
  const method = normalizeMethod(transaction.method);
  const amount = cleanMoney(transaction.amount);
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

function bookingTotal(booking) {
  const candidates = [booking.total, booking.subtotal, booking.invoiceAmount];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && Number.isFinite(Number(candidate))) {
      return cleanMoney(candidate);
    }
  }
  return 0;
}

function legacyPaymentRows(booking) {
  const history = Array.isArray(booking.paymentHistory) ? booking.paymentHistory : [];
  if (history.length) return history.filter((row) => cleanMoney(row?.amount) > 0);
  const status = cleanText(booking.paymentStatusCanonical || booking.paymentStatus, 40).toLowerCase();
  const amount = Math.max(
    cleanMoney(booking.paidAmount),
    cleanMoney(booking.dpAmount),
    ['paid', 'lunas'].includes(status) ? bookingTotal(booking) : 0,
  );
  if (!amount) return [];
  return [{
    amount,
    createdAt: booking.lastPaymentAt || booking.createdAt || booking.date || '',
    date: booking.lastPaymentAt || booking.createdAt || booking.date || '',
    id: 'legacy_' + cleanText(booking.id || 'booking', 120) + '_payment',
    method: booking.lastPaymentMethod || booking.paymentMethod || 'other',
    source: 'legacy-projection',
  }];
}

function legacyRefundRows(booking) {
  const history = Array.isArray(booking.refundHistory) ? booking.refundHistory : [];
  if (history.length) return history.filter((row) => cleanMoney(row?.amount) > 0);
  const amount = cleanMoney(booking.refundedAmount);
  if (!amount) return [];
  const timestamp = booking.lastRefundAt || booking.refundCompletedAt || booking.updatedAt || booking.createdAt || booking.date || '';
  return [{
    amount,
    createdAt: timestamp,
    date: timestamp,
    id: 'legacy_' + cleanText(booking.id || 'booking', 120) + '_refund',
    method: booking.lastRefundMethod || 'other',
    source: 'legacy-refund-projection',
  }];
}

async function loadLedgerEntries(firestore, businessDate) {
  const results = [];
  let offset = 0;
  while (offset < MAX_QUERY_ROWS) {
    const page = await firestore.runQuery({
      from: [{ collectionId: 'bookkeepingEntries' }],
      limit: 500,
      offset,
      where: {
        fieldFilter: {
          field: { fieldPath: 'date' },
          op: 'EQUAL',
          value: { stringValue: businessDate },
        },
      },
    });
    results.push(...page);
    if (page.length < 500) return results;
    offset += page.length;
  }
  throw new HttpError(413, 'closing_volume_too_large', 'Volume ledger tanggal ini melampaui batas aman closing. Hubungi Owner untuk pemeriksaan.');
}

async function loadBookings(firestore) {
  const documents = [];
  let pageToken = '';
  let pageCount = 0;
  do {
    const page = await firestore.listDocuments('bookings', { pageSize: 500, pageToken });
    documents.push(...page.documents);
    pageToken = page.nextPageToken;
    pageCount += 1;
    if (pageCount >= MAX_BOOKING_PAGES && pageToken) {
      throw new HttpError(413, 'closing_booking_scan_too_large', 'Jumlah booking terlalu besar untuk dipindai dalam satu closing.');
    }
  } while (pageToken);
  return documents;
}

function canonicalEventKey(bookingId, eventId) {
  return bookingId && eventId ? bookingId + ':' + eventId : '';
}

async function collectBusinessTransactions({ businessDate, firestore, registerId }) {
  const entries = await loadLedgerEntries(firestore, businessDate);
  const bookings = await loadBookings(firestore);
  const totals = emptyMethodTotals();
  const references = [];
  const canonicalEvents = new Set();

  entries.forEach((document) => {
    const row = document.data || {};
    if (normalizeRegisterId(row.registerId || 'main') !== registerId) return;
    if (!['income', 'expense'].includes(row.type)) return;
    const source = cleanText(row.source || 'manual', 80);
    const bookingId = cleanText(row.sourceBookingId, 160);
    const eventId = cleanText(row.sourceEventId, 180);
    const eventKey = canonicalEventKey(bookingId, eventId);
    if (eventKey) canonicalEvents.add(eventKey);
    addTransaction(totals, {
      amount: row.amount,
      bookingId,
      createdAt: row.createdAt || row.updatedAt,
      eventId,
      id: document.id || row.id,
      method: row.paymentMethod,
      source,
      type: row.type,
    }, references);
  });

  bookings.forEach((document) => {
    const booking = { id: document.id, ...(document.data || {}) };
    const bookingId = cleanText(booking.id, 160);
    if (!bookingId) return;

    legacyPaymentRows(booking).forEach((payment, index) => {
      if (businessDateOf(payment.date || payment.createdAt || payment.timestamp) !== businessDate) return;
      const eventId = cleanText(payment.id, 180) || 'legacy_payment_' + index;
      if (canonicalEvents.has(canonicalEventKey(bookingId, eventId))) return;
      addTransaction(totals, {
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
      if (canonicalEvents.has(canonicalEventKey(bookingId, eventId))) return;
      addTransaction(totals, {
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

  references.sort((first, second) => first.id.localeCompare(second.id));
  if (references.length > MAX_TRANSACTION_REFERENCES) {
    throw new HttpError(413, 'closing_reference_limit', 'Jumlah transaksi melebihi kapasitas snapshot closing.');
  }
  const fingerprintInput = JSON.stringify(references);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintInput));
  const sourceFingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const sourceWatermark = references
    .map((reference) => reference.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1) || '';
  return { references, sourceFingerprint, sourceWatermark, totals };
}

function normalizeCounts(body, required = false) {
  const digitalSource = body.digitalCounts && typeof body.digitalCounts === 'object' ? body.digitalCounts : {};
  const denominationSource = body.cashDenominations && typeof body.cashDenominations === 'object'
    ? body.cashDenominations
    : null;
  if (required && !denominationSource) {
    throw new HttpError(400, 'cash_denominations_required', 'Rincian pecahan uang fisik wajib diisi untuk menyimpan closing.');
  }
  const cashDenominations = {};
  let countedCashFromDenominations = 0;
  CASH_DENOMINATIONS.forEach((denomination) => {
    const rawCount = denominationSource?.[String(denomination)] ?? 0;
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 0 || count > 100000) {
      throw new HttpError(400, 'invalid_cash_denomination', 'Jumlah lembar atau keping uang tidak valid.');
    }
    cashDenominations[String(denomination)] = count;
    countedCashFromDenominations += denomination * count;
  });
  const openingCash = required
    ? requiredMoney(body.openingCash, 'Opening cash')
    : optionalMoney(body.openingCash, 'Opening cash');
  const suppliedCountedCash = optionalMoney(body.countedCash, 'Cash fisik terhitung');
  if (denominationSource && suppliedCountedCash !== null && suppliedCountedCash !== countedCashFromDenominations) {
    throw new HttpError(400, 'cash_count_mismatch', 'Total kas harus sama dengan penjumlahan rincian pecahan uang.');
  }
  const countedCash = denominationSource ? countedCashFromDenominations : suppliedCountedCash;
  if (required && countedCash === null) {
    throw new HttpError(400, 'amount_required', 'Cash fisik terhitung wajib diisi.');
  }
  const digitalCounts = {};
  METHODS.filter((method) => method !== 'cash').forEach((method) => {
    digitalCounts[method] = required
      ? requiredMoney(digitalSource[method], 'Saldo ' + method.toUpperCase())
      : optionalMoney(digitalSource[method], 'Saldo ' + method.toUpperCase());
  });
  return { cashDenominations, countedCash, digitalCounts, openingCash };
}

function calculateReconciliation(totals, counts) {
  const expectedCash = counts.openingCash === null ? null : counts.openingCash + totals.cash.net;
  const cashVariance = counts.countedCash === null || expectedCash === null
    ? null
    : counts.countedCash - expectedCash;
  const digital = {};
  METHODS.filter((method) => method !== 'cash').forEach((method) => {
    const counted = counts.digitalCounts[method];
    const expected = totals[method].net;
    digital[method] = {
      counted,
      expected,
      variance: counted === null ? null : counted - expected,
    };
  });
  const variances = [cashVariance, ...Object.values(digital).map((row) => row.variance)];
  return {
    cashVariance,
    digital,
    expectedCash,
    hasVariance: variances.some((value) => value !== null && value !== 0),
  };
}

function varianceReason(body, reconciliation) {
  const reason = cleanText(body.varianceReason || body.reason, 600);
  if (reconciliation.hasVariance && reason.length < 4) {
    throw new HttpError(400, 'variance_reason_required', 'Alasan selisih wajib diisi minimal 4 karakter.');
  }
  return reason;
}

function summarizeLatePostings(snapshot, currentReferences) {
  const previous = new Set((Array.isArray(snapshot?.transactionReferences) ? snapshot.transactionReferences : []).map((row) => row.id));
  return currentReferences.filter((row) => !previous.has(row.id));
}

async function loadClosingEvents(firestore, sessionId) {
  const rows = await firestore.runQuery({
    from: [{ collectionId: 'cashClosingEvents' }],
    limit: 100,
    where: {
      fieldFilter: {
        field: { fieldPath: 'closingId' },
        op: 'EQUAL',
        value: { stringValue: sessionId },
      },
    },
  });
  return rows
    .map((row) => {
      const data = row.data || {};
      return {
        action: data.action || '',
        actorName: data.actorName || '',
        actorUid: data.actorUid || '',
        createdAt: data.createdAt || '',
        id: row.id,
        reason: data.reason || '',
        revision: data.revision || 0,
        snapshot: data.snapshot ? {
          cutoffAt: data.snapshot.cutoffAt || '',
          reviewNote: data.snapshot.reviewNote || '',
          sourceFingerprint: data.snapshot.sourceFingerprint || '',
          transactionCount: data.snapshot.transactionCount || 0,
        } : null,
        sourceFingerprint: data.sourceFingerprint || '',
        summary: data.summary || null,
      };
    })
    .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
}

function buildPreviewResult({ actor, businessDate, collected, counts, events, existing, registerId }) {
  const isClosed = existing?.status === 'closed';
  const snapshotCounts = isClosed ? {
    openingCash: existing.openingCash,
    cashDenominations: existing.cashDenominations || {},
    countedCash: existing.countedCash,
    digitalCounts: existing.digitalCounts || {},
  } : counts;
  const snapshotTotals = isClosed ? existing.totalsByMethod : collected.totals;
  const reconciliation = calculateReconciliation(snapshotTotals, snapshotCounts);
  const latePostingExceptions = existing?.cutoffAt
    ? summarizeLatePostings(existing, collected.references)
    : [];
  return {
    businessDate,
    canReopen: actor.role === 'owner',
    counts: snapshotCounts,
    cutoffAt: existing?.cutoffAt || '',
    digitalReconciliation: reconciliation.digital,
    expectedCash: isClosed ? existing.expectedCash : reconciliation.expectedCash,
    events: events || [],
    existingSession: existing ? { ...existing } : null,
    isClosed,
    latePostingExceptions,
    latePostingCount: latePostingExceptions.length,
    reconciliation: isClosed ? {
      ...reconciliation,
      cashVariance: existing.cashVariance,
      digital: existing.digitalReconciliation || reconciliation.digital,
      expectedCash: existing.expectedCash,
      hasVariance: Number(existing.cashVariance || 0) !== 0 || Object.values(existing.digitalReconciliation || {}).some((row) => Number(row.variance || 0) !== 0),
    } : reconciliation,
    registerId,
    sourceFingerprint: isClosed ? existing.sourceFingerprint : collected.sourceFingerprint,
    sourceWatermark: isClosed ? existing.sourceWatermark : collected.sourceWatermark,
    status: existing?.status || 'not_opened',
    totalsByMethod: snapshotTotals,
    transactionCount: isClosed ? existing.transactionCount : collected.references.length,
    transactionReferences: isClosed ? (existing.transactionReferences || []) : collected.references,
  };
}

export async function previewDailyClosing({ actor, body, firestore, now = new Date() }) {
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new HttpError(400, 'invalid_business_date', 'Tanggal bisnis wajib valid (YYYY-MM-DD).');
  const registerId = normalizeRegisterId(body.registerId);
  const counts = normalizeCounts(body, false);
  const existing = await firestore.getDocument(
    'cashClosingSessions',
    sessionDocumentId(businessDate, registerId),
  );
  const collected = await collectBusinessTransactions({ businessDate, firestore, registerId });
  const existingData = existing?.data || null;
  const events = existingData ? await loadClosingEvents(firestore, existing.id) : [];
  const preview = buildPreviewResult({ actor, businessDate, collected, counts, events, existing: existingData, registerId });
  return { ...preview, generatedAt: now.toISOString(), ok: true };
}

export async function closeDailyClosing({ actor, body, firestore, request, now = new Date() }) {
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new HttpError(400, 'invalid_business_date', 'Tanggal bisnis wajib valid (YYYY-MM-DD).');
  const registerId = normalizeRegisterId(body.registerId);
  if (businessDate > businessDateOf(now.toISOString())) {
    throw new HttpError(400, 'future_business_date', 'Tanggal bisnis di masa depan belum dapat ditutup.');
  }
  const counts = normalizeCounts(body, true);
  const key = getIdempotencyKey(request, body);
  const type = 'daily-closing-close';
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };

  const sessionId = sessionDocumentId(businessDate, registerId);
  const existingDocument = await firestore.getDocument('cashClosingSessions', sessionId);
  const existing = existingDocument?.data || null;
  if (existing?.status === 'closed') {
    throw new HttpError(409, 'daily_closing_already_closed', 'Tanggal dan register ini sudah ditutup. Reopen hanya dapat dilakukan Owner.');
  }

  const collected = await collectBusinessTransactions({ businessDate, firestore, registerId });
  const reconciliation = calculateReconciliation(collected.totals, counts);
  const reason = varianceReason(body, reconciliation);
  const revision = Math.max(0, Number(existing?.revision || 0)) + 1;
  const timestamp = now.toISOString();
  const eventId = await stableDocumentId('cash-closing-event', sessionId + ':' + key);
  const session = {
    businessDate,
    cashVariance: reconciliation.cashVariance,
    closedAt: timestamp,
    closedByName: actor.displayName,
    closedByUid: actor.uid,
    cashDenominations: counts.cashDenominations,
    countedCash: counts.countedCash,
    createdAt: existing?.createdAt || timestamp,
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
    registerId,
    revision,
    sourceFingerprint: collected.sourceFingerprint,
    sourceWatermark: collected.sourceWatermark,
    status: 'closed',
    totalsByMethod: collected.totals,
    transactionCount: collected.references.length,
    transactionReferences: collected.references,
    updatedAt: timestamp,
    varianceReason: reason,
  };
  const event = {
    action: 'closed',
    actorName: actor.displayName,
    actorUid: actor.uid,
    businessDate,
    closingId: sessionId,
    createdAt: timestamp,
    id: eventId,
    reason,
    registerId,
    revision,
    sourceFingerprint: collected.sourceFingerprint,
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
      registerId,
      reviewNote: cleanText(body.reviewNote, 1000),
      revision,
      sourceFingerprint: collected.sourceFingerprint,
      sourceWatermark: collected.sourceWatermark,
      totalsByMethod: collected.totals,
      transactionCount: collected.references.length,
      transactionReferences: collected.references,
      varianceReason: reason,
    },
    summary: {
      cashVariance: reconciliation.cashVariance,
      expectedCash: reconciliation.expectedCash,
      transactionCount: collected.references.length,
    },
    type: 'cash-closing-event',
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: 'cashClosingEvents', documentId: eventId },
      session: { collectionId: 'cashClosingSessions', documentId: sessionId },
    },
    firestore,
    key,
    receipt: {},
    result: { event, session },
    targetId: sessionId,
    type,
    writes: [
      firestore.setWrite('cashClosingSessions', sessionId, session,
        existingDocument ? { updateTime: existingDocument.updateTime } : { exists: false }),
      firestore.setWrite('cashClosingEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}

export async function reopenDailyClosing({ actor, body, firestore, request, now = new Date() }) {
  if (actor.role !== 'owner') throw new HttpError(403, 'owner_required', 'Reopen closing hanya dapat dilakukan Owner.');
  const businessDate = validBusinessDate(body.businessDate);
  if (!businessDate) throw new HttpError(400, 'invalid_business_date', 'Tanggal bisnis wajib valid (YYYY-MM-DD).');
  const registerId = normalizeRegisterId(body.registerId);
  const reason = cleanText(body.reason, 600);
  if (reason.length < 4) throw new HttpError(400, 'reopen_reason_required', 'Alasan reopen wajib diisi minimal 4 karakter.');
  const key = getIdempotencyKey(request, body);
  const type = 'daily-closing-reopen';
  const existingOperation = await readOperationResult(firestore, type, key);
  if (existingOperation.result) return { ...existingOperation.result, duplicate: true };

  const sessionId = sessionDocumentId(businessDate, registerId);
  const existingDocument = await firestore.getDocument('cashClosingSessions', sessionId);
  if (!existingDocument || existingDocument.data.status !== 'closed') {
    throw new HttpError(409, 'daily_closing_not_closed', 'Hanya closing berstatus Closed yang dapat dibuka kembali.');
  }

  const timestamp = now.toISOString();
  const eventId = await stableDocumentId('cash-closing-event', sessionId + ':' + key);
  const session = {
    ...existingDocument.data,
    id: sessionId,
    lastEventAt: timestamp,
    lastEventId: eventId,
    lastEventType: 'reopened',
    reopenReason: reason,
    reopenedAt: timestamp,
    reopenedByName: actor.displayName,
    reopenedByUid: actor.uid,
    status: 'reopened',
    updatedAt: timestamp,
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
    registerId,
    revision: Number(existingDocument.data.revision || 1),
    sourceFingerprint: existingDocument.data.sourceFingerprint || '',
    type: 'cash-closing-event',
  };
  const committed = await commitIdempotentOperation({
    actor,
    documentRefs: {
      event: { collectionId: 'cashClosingEvents', documentId: eventId },
      session: { collectionId: 'cashClosingSessions', documentId: sessionId },
    },
    firestore,
    key,
    receipt: {},
    result: { event, session },
    targetId: sessionId,
    type,
    writes: [
      firestore.setWrite('cashClosingSessions', sessionId, session, { updateTime: existingDocument.updateTime }),
      firestore.setWrite('cashClosingEvents', eventId, event, { exists: false }),
    ],
  });
  return { ...committed.result, duplicate: committed.duplicate };
}
