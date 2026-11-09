import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  createRepositoryOperationId,
  createRepositoryPayloadHash,
} from '../src/lib/firestoreRepositoryFoundation.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this test through npm run test:rules.');

const projectId = 'demo-studio37';
const now = '2026-08-14T08:00:00.000Z';
const later = '2026-08-14T08:30:00.000Z';
const defaultBusinessDate = '2026-08-14';
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const environment = await initializeTestEnvironment({ firestore: { rules }, projectId });
const permissions = (enabled = {}) => ({
  billing: false, bookkeeping: false, customers: false, dashboard: false, gallery: false,
  'guard-attendance': false, inventory: false, notifications: false, 'operator-fee': false,
  schedule: false, settings: false, ...enabled,
});

function makeBooking(options = {}) {
  const id = options.id;
  const date = options.date || '2026-08-15';
  const total = options.total ?? 100000;
  const history = options.paymentHistory || [];
  return {
    id, bookingCode: 'BKG-' + id, bookingId: 'BKG-' + id,
    customer: 'Finance Rules Test', phone: '', date, startHour: 10, durationHours: 1,
    total, subtotal: total, invoiceAmount: options.invoiceAmount ?? total,
    paidAmount: options.paidAmount ?? 0, dpAmount: options.dpAmount ?? 0,
    paymentStatus: options.paymentStatus || 'pending',
    paymentStatusCanonical: options.paymentStatusCanonical || 'unpaid',
    status: options.paymentStatus || 'pending',
    paymentHistory: history, refundHistory: options.refundHistory || [],
    refundedAmount: options.refundedAmount ?? 0,
    lastPaymentAt: history.length ? history[history.length - 1].createdAt : '',
    lastPaymentMethod: history.length ? history[history.length - 1].method : '',
    lastRefundAt: '', lastRefundMethod: '', lastRefundReason: '', refundStatus: '',
    updatedAt: options.updatedAt || now,
  };
}

async function addMarker(batch, db, actorUid, action, requestId, collectionName, resultId) {
  const operationId = await createRepositoryOperationId({
    actorUid, scope: 'finance', action, requestId,
  });
  const payloadHash = await createRepositoryPayloadHash({ action, requestId, resultId });
  batch.set(doc(db, 'users', actorUid, 'repositoryOperations', operationId), {
    action, actorUid, createdAt: serverTimestamp(), operationId, payloadHash,
    requestId, resultCollection: collectionName, resultId, scope: 'finance',
  });
  return operationId;
}

function makeFence(actorUid, action, operationId, bookingId, ledgerId, revision, businessDate) {
  return {
    activityRevision: revision, businessDate, createdAt: now,
    id: businessDate + '__main', lastActivityAt: later, lastActivityByUid: actorUid,
    lastBookingId: bookingId, lastLedgerEntryId: ledgerId, lastOperationAction: action,
    lastOperationId: operationId, lastProofId: '', registerId: 'main', status: 'open',
    updatedAt: later,
  };
}

function makeLedger({ id, actorUid, operationId, requestId, bookingId, eventId, amount, refund = false }) {
  return {
    actorName: 'Billing Admin', actorUid, amount,
    category: refund ? 'refund' : 'booking', createdAt: later,
    date: defaultBusinessDate, id, idempotencyKey: requestId, immutable: true,
    note: 'Finance Rules Emulator test', operationId, paymentMethod: 'cash',
    reversalOf: '', source: refund ? 'booking-refund' : 'booking-payment',
    sourceAction: refund ? 'refund' : 'payment', sourceAttendanceDate: '',
    sourceAttendanceId: '', sourceBookingId: bookingId, sourceEventId: eventId,
    sourceFeeEntryId: '', sourceGuardPersonId: '', sourceProofId: '',
    sourceWorkOrderId: '', title: 'Finance Rules test ' + id,
    type: refund ? 'expense' : 'income', updatedAt: later,
  };
}

async function paymentBatch(db, state, amount, requestId) {
  const batch = writeBatch(db);
  const actorUid = 'billing-admin';
  const operationId = await createRepositoryOperationId({
    actorUid, scope: 'finance', action: 'payment', requestId,
  });
  const eventId = 'payment_' + requestId;
  const ledgerId = 'ledger_' + requestId;
  const paid = state.paidAmount + amount;
  const outstanding = Math.max(0, state.total - paid);
  const status = outstanding === 0 ? 'lunas' : 'dp';
  const event = {
    actorName: 'Billing Admin', actorUid, amount, createdAt: later,
    date: defaultBusinessDate, id: eventId, idempotencyKey: requestId,
    ledgerEntryId: ledgerId, method: 'cash', note: 'Test payment',
    operationId, source: 'admin-payment',
  };
  batch.update(doc(db, 'bookings', state.id), {
    paymentHistory: [...state.paymentHistory, event],
    invoiceAmount: outstanding, paidAmount: paid, paymentStatus: status,
    paymentStatusCanonical: outstanding === 0 ? 'paid' : 'partial',
    dpAmount: outstanding === 0 ? 0 : paid,
    lastPaymentAt: later, lastPaymentMethod: 'cash', updatedAt: later,
    lastFinanceAction: 'payment', lastFinanceBusinessDate: defaultBusinessDate,
    lastFinanceEventId: eventId, lastFinanceLedgerEntryId: ledgerId,
    lastFinanceOperationId: operationId, lastFinanceProofId: '',
  });
  batch.set(doc(db, 'bookkeepingEntries', ledgerId), makeLedger({
    id: ledgerId, actorUid, operationId, requestId, bookingId: state.id,
    eventId, amount,
  }));
  batch.set(doc(db, 'cashClosingSessions', defaultBusinessDate + '__main'),
    makeFence(actorUid, 'payment', operationId, state.id, ledgerId,
      (state.fenceRevision || 0) + 1, defaultBusinessDate));
  await addMarker(batch, db, actorUid, 'payment', requestId, 'bookings', state.id);
  return {
    batch,
    nextState: {
      ...state, paymentHistory: [...state.paymentHistory, event],
      paidAmount: paid, invoiceAmount: outstanding, fenceRevision: (state.fenceRevision || 0) + 1,
    },
  };
}

async function refundBatch(db, state, amount, requestId) {
  const batch = writeBatch(db);
  const actorUid = 'billing-admin';
  const operationId = await createRepositoryOperationId({
    actorUid, scope: 'finance', action: 'refund', requestId,
  });
  const eventId = 'refund_' + requestId;
  const ledgerId = 'ledger_' + requestId;
  const paid = state.paidAmount - amount;
  const outstanding = state.invoiceAmount + amount;
  const refunded = state.refundedAmount + amount;
  const status = paid === 0 ? 'refunded' : 'dp';
  const event = {
    actorName: 'Billing Admin', actorUid, amount, createdAt: later,
    date: defaultBusinessDate, id: eventId, idempotencyKey: requestId,
    ledgerEntryId: ledgerId, method: 'cash', operationId, reason: 'Test refund',
    source: 'admin-refund',
  };
  batch.update(doc(db, 'bookings', state.id), {
    refundHistory: [...state.refundHistory, event],
    invoiceAmount: outstanding, paidAmount: paid, paymentStatus: status,
    paymentStatusCanonical: paid === 0 ? 'refunded' : 'partial',
    refundedAmount: refunded, lastRefundAt: later, lastRefundMethod: 'cash',
    lastRefundReason: 'Test refund', refundStatus: paid === 0 ? 'full' : 'partial',
    updatedAt: later, lastFinanceAction: 'refund',
    lastFinanceBusinessDate: defaultBusinessDate, lastFinanceEventId: eventId,
    lastFinanceLedgerEntryId: ledgerId, lastFinanceOperationId: operationId,
    lastFinanceProofId: '',
  });
  batch.set(doc(db, 'bookkeepingEntries', ledgerId), makeLedger({
    id: ledgerId, actorUid, operationId, requestId, bookingId: state.id,
    eventId, amount, refund: true,
  }));
  batch.set(doc(db, 'cashClosingSessions', defaultBusinessDate + '__main'),
    makeFence(actorUid, 'refund', operationId, state.id, ledgerId,
      (state.fenceRevision || 0) + 1, defaultBusinessDate));
  await addMarker(batch, db, actorUid, 'refund', requestId, 'bookings', state.id);
  return {
    batch,
    nextState: {
      ...state, refundHistory: [...state.refundHistory, event],
      paidAmount: paid, invoiceAmount: outstanding, refundedAmount: refunded,
      fenceRevision: (state.fenceRevision || 0) + 1,
    },
  };
}

async function voidBatch(db, bookingId, requestId, operationDate) {
  const batch = writeBatch(db);
  const actorUid = 'billing-admin';
  const operationId = await createRepositoryOperationId({
    actorUid, scope: 'finance', action: 'void', requestId,
  });
  const bookingDate = '2026-08-15';
  batch.update(doc(db, 'bookings', bookingId), {
    invoiceAmount: 0, invoiceStatus: 'void', paymentStatus: 'void',
    paymentStatusCanonical: 'void', updatedAt: later,
    voidReason: 'Test void reason', voidedAt: later, voidedByName: 'Billing Admin',
    voidedByUid: actorUid, lastFinanceAction: 'void',
    lastFinanceBusinessDate: operationDate, lastFinanceEventId: '',
    lastFinanceLedgerEntryId: '', lastFinanceOperationId: operationId,
    lastFinanceProofId: '',
  });
  batch.update(doc(db, 'bookingScheduleDays', bookingDate), {
    lastBookingId: bookingId, revision: 2, updatedAt: later,
  });
  batch.delete(doc(db, 'clientCalendarSlots', bookingId));
  batch.set(doc(db, 'cashClosingSessions', operationDate + '__main'),
    makeFence(actorUid, 'void', operationId, bookingId, '', 1, operationDate));
  await addMarker(batch, db, actorUid, 'void', requestId, 'bookings', bookingId);
  return batch;
}

async function seedVoidBooking(adminDb, bookingId, paid) {
  await setDoc(doc(adminDb, 'bookings', bookingId), makeBooking({
    id: bookingId, date: '2026-08-15', total: 100000,
    invoiceAmount: paid ? 0 : 100000, paidAmount: paid ? 100000 : 0,
    paymentStatus: paid ? 'lunas' : 'pending',
    paymentStatusCanonical: paid ? 'paid' : 'unpaid',
    paymentHistory: paid ? [{
      amount: 100000, createdAt: now, date: '2026-08-15',
      id: 'seed-payment-' + bookingId, method: 'cash',
    }] : [],
  }));
  await setDoc(doc(adminDb, 'bookingScheduleDays', '2026-08-15'), {
    date: '2026-08-15', lastBookingId: bookingId, revision: 1, updatedAt: now,
  });
  await setDoc(doc(adminDb, 'clientCalendarSlots', bookingId), {
    bookingId, date: '2026-08-15', durationHours: 1, sessionLabel: 'Rehearsal',
    startHour: 10, status: paid ? 'lunas' : 'pending', title: 'Occupied', updatedAt: now,
  });
}

async function closingBatch(db, actorUid, action, requestId, date, reason) {
  const batch = writeBatch(db);
  const operationId = await createRepositoryOperationId({
    actorUid, scope: 'finance', action, requestId,
  });
  const sessionId = date + '__main';
  const eventId = 'event_' + requestId;
  const closing = action === 'daily-close';
  const eventAction = closing ? 'closed' : 'reopened';
  const fingerprint = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const event = {
    action: eventAction, actorName: actorUid === 'new-owner' ? 'Owner' : 'Bookkeeping Admin',
    actorUid, businessDate: date, closingId: sessionId, createdAt: later,
    id: eventId, reason, registerId: 'main', revision: 1,
    sourceFingerprint: fingerprint, type: 'cash-closing-event', operationId,
  };
  if (closing) {
    batch.set(doc(db, 'cashClosingSessions', sessionId), {
      businessDate: date, cashVariance: 0, closedAt: later,
      closedByName: 'Bookkeeping Admin', closedByUid: actorUid,
      cashDenominations: {}, countedCash: 0, createdAt: later, cutoffAt: later,
      digitalCounts: { transfer: 0, qris: 0, other: 0 },
      digitalReconciliation: { transfer: {}, qris: {}, other: {} },
      expectedCash: 0, id: sessionId, lastEventAt: later, lastEventId: eventId,
      lastEventType: 'closed', lastOperationAction: action,
      lastOperationId: operationId, lastBookingId: '', lastLedgerEntryId: '',
      lastProofId: '', lastFinanceOperationId: operationId, openingCash: 0,
      registerId: 'main', revision: 1, sourceFingerprint: fingerprint,
      sourceWatermark: later, status: 'closed',
      totalsByMethod: { cash: {}, transfer: {}, qris: {}, other: {} },
      transactionCount: 0, transactionReferences: [], updatedAt: later,
      varianceReason: '', activityRevision: 0, reviewNote: '',
    });
  } else {
    batch.update(doc(db, 'cashClosingSessions', sessionId), {
      lastEventAt: later, lastEventId: eventId, lastEventType: 'reopened',
      lastOperationAction: action, lastOperationId: operationId,
      lastBookingId: '', lastLedgerEntryId: '', lastProofId: '',
      lastFinanceOperationId: operationId, reopenReason: reason,
      reopenedAt: later, reopenedByName: 'Owner', reopenedByUid: actorUid,
      status: 'reopened', activityRevision: 1, updatedAt: later,
    });
  }
  batch.set(doc(db, 'cashClosingEvents', eventId), event);
  await addMarker(batch, db, actorUid, action, requestId, 'cashClosingSessions', sessionId);
  return batch;
}

try {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'billing-admin'), {
      displayName: 'Billing Admin', email: 'billing@example.com',
      permissions: permissions({ billing: true }), role: 'admin',
      status: 'approved', uid: 'billing-admin',
    });
    await setDoc(doc(db, 'users', 'bookkeeping-admin'), {
      displayName: 'Bookkeeping Admin', email: 'bookkeeping@example.com',
      permissions: permissions({ bookkeeping: true }), role: 'admin',
      status: 'approved', uid: 'bookkeeping-admin',
    });
    await setDoc(doc(db, 'users', 'new-owner'), {
      displayName: 'Canonical Owner', email: 'owner@example.com',
      permissions: permissions(), role: 'owner', status: 'approved', uid: 'new-owner',
    });
    await setDoc(doc(db, 'adminControl', 'ownership'), {
      currentOwnerUid: 'new-owner', initializedAt: now, updatedAt: now,
    });
  });

  const billingDb = environment.authenticatedContext('billing-admin').firestore();
  const bookkeepingDb = environment.authenticatedContext('bookkeeping-admin').firestore();
  const ownerDb = environment.authenticatedContext('new-owner').firestore();
  const adminDb = environment.unauthenticatedContext().firestore();

  // Valid partial payment is accepted; overpayment against the remaining balance is denied.
  let paymentState = { ...makeBooking({ id: 'finance-payment-1' }), fenceRevision: 0 };
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bookings', paymentState.id), paymentState);
  });
  const paidOnce = await paymentBatch(billingDb, paymentState, 40000, 'payment-valid-0001');
  await assertSucceeds(paidOnce.batch.commit());
  paymentState = paidOnce.nextState;
  const overPayment = await paymentBatch(billingDb, paymentState, 70000, 'payment-over-0002');
  await assertFails(overPayment.batch.commit());

  // Valid partial refund is accepted; a refund above the current net paid amount is denied.
  const paidHistory = [{
    amount: 100000, createdAt: now, date: defaultBusinessDate,
    id: 'seed-payment-refund-1', method: 'cash',
  }];
  let refundState = {
    ...makeBooking({
      id: 'finance-refund-1', total: 100000, invoiceAmount: 0,
      paidAmount: 100000, paymentStatus: 'lunas',
      paymentStatusCanonical: 'paid', paymentHistory: paidHistory,
    }),
    fenceRevision: 0,
  };
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bookings', refundState.id), refundState);
  });
  const refundedOnce = await refundBatch(billingDb, refundState, 30000, 'refund-valid-0001');
  await assertSucceeds(refundedOnce.batch.commit());
  refundState = refundedOnce.nextState;
  const overRefund = await refundBatch(billingDb, refundState, 80000, 'refund-over-0002');
  await assertFails(overRefund.batch.commit());

  // Unpaid invoices can be voided with schedule companions; paid invoices cannot.
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await seedVoidBooking(db, 'finance-void-unpaid', false);
    await seedVoidBooking(db, 'finance-void-paid', true);
  });
  await assertSucceeds((await voidBatch(billingDb, 'finance-void-unpaid', 'void-unpaid-0001', '2026-08-16')).commit());
  await assertFails((await voidBatch(billingDb, 'finance-void-paid', 'void-paid-0002', '2026-08-17')).commit());

  // Bookkeeping permission can close a day; only the canonical Owner can reopen it.
  const closingDate = '2026-08-20';
  await assertSucceeds((await closingBatch(bookkeepingDb, 'bookkeeping-admin', 'daily-close',
    'daily-close-valid-0001', closingDate, '')).commit());
  await assertFails((await closingBatch(bookkeepingDb, 'bookkeeping-admin', 'daily-reopen',
    'daily-reopen-denied-0002', closingDate, 'Unauthorized reopen')).commit());
  await assertSucceeds((await closingBatch(ownerDb, 'new-owner', 'daily-reopen',
    'daily-reopen-owner-0003', closingDate, 'Owner approved correction')).commit());

  process.stdout.write(
    'Firebase Finance Rules invariant test passed: payment bounds, refund bounds, void balance, daily close, and Owner-only reopen.\n',
  );
} finally {
  await environment.cleanup();
}
