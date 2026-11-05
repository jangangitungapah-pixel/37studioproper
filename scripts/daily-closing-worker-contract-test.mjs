import assert from 'node:assert/strict';
import {
  closeDailyClosing,
  previewDailyClosing,
  reopenDailyClosing,
} from '../workers/admin-operations-worker/src/domain/dailyClosings.js';

function clone(value) {
  return structuredClone(value);
}

class FakeFirestore {
  constructor(seed = {}) {
    this.collections = new Map();
    this.version = 1;
    Object.entries(seed).forEach(([collectionId, documents]) => {
      this.collections.set(collectionId, new Map(
        Object.entries(documents).map(([id, data]) => [id, {
          data: clone(data),
          updateTime: 'v' + this.version++,
        }]),
      ));
    });
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  async getDocument(collectionId, id) {
    const entry = this.collection(collectionId).get(id);
    return entry ? { data: clone(entry.data), id, updateTime: entry.updateTime } : null;
  }

  setWrite(collectionId, id, data, precondition = null) {
    return { collectionId, data: clone(data), id, kind: 'set', precondition };
  }

  async commit(writes) {
    for (const write of writes) {
      const current = this.collection(write.collectionId).get(write.id);
      if (write.precondition?.exists === false && current) {
        const error = new Error('Document already exists.');
        error.status = 409;
        throw error;
      }
      if (write.precondition?.updateTime && current?.updateTime !== write.precondition.updateTime) {
        const error = new Error('Stale document.');
        error.status = 412;
        throw error;
      }
    }
    for (const write of writes) {
      this.collection(write.collectionId).set(write.id, {
        data: clone(write.data),
        updateTime: 'v' + this.version++,
      });
    }
    return { writeResults: writes.map(() => ({})) };
  }

  async runQuery(query) {
    const collectionId = query.from?.[0]?.collectionId;
    const field = query.where?.fieldFilter?.field?.fieldPath;
    const value = query.where?.fieldFilter?.value?.stringValue;
    const offset = Number(query.offset || 0);
    const limit = Number(query.limit || 500);
    return Array.from(this.collection(collectionId).entries())
      .filter(([, entry]) => !field || entry.data[field] === value)
      .slice(offset, offset + limit)
      .map(([id, entry]) => ({ data: clone(entry.data), id, updateTime: entry.updateTime }));
  }

  async listDocuments(collectionId, { pageSize = 250, pageToken = '' } = {}) {
    const all = Array.from(this.collection(collectionId).entries());
    const offset = Number(pageToken || 0);
    const page = all.slice(offset, offset + pageSize);
    return {
      documents: page.map(([id, entry]) => ({ data: clone(entry.data), id, updateTime: entry.updateTime })),
      nextPageToken: offset + page.length < all.length ? String(offset + page.length) : '',
    };
  }
}

const date = '2026-11-05';
const nowBeforeCutoff = '2026-11-05T08:55:00.000Z';
const actor = { displayName: 'Admin Test', role: 'admin', uid: 'admin-1' };
const owner = { displayName: 'Owner Test', role: 'owner', uid: 'owner-1' };

await assert.rejects(
  () => previewDailyClosing({
    actor,
    body: { businessDate: '2026-11-05', registerId: 'secondary' },
    firestore: new FakeFirestore(),
  }),
  (error) => error?.code === 'register_not_supported',
);

await assert.rejects(
  () => closeDailyClosing({
    actor,
    body: {
      businessDate: '2026-11-06',
      registerId: 'main',
      openingCash: 0,
      countedCash: 0,
      digitalCounts: { transfer: 0, qris: 0, other: 0 },
    },
    firestore: new FakeFirestore(),
    request: new Request('https://worker.test/close', { headers: { 'x-idempotency-key': 'close-future-date' }, method: 'POST' }),
    now: new Date('2026-11-05T09:00:00.000Z'),
  }),
  (error) => error?.code === 'future_business_date',
);


const firestore = new FakeFirestore({
  bookkeepingEntries: {
    'canonical-payment-1': {
      amount: 80000, createdAt: nowBeforeCutoff, date, id: 'canonical-payment-1',
      paymentMethod: 'cash', source: 'booking-payment', sourceBookingId: 'booking-canonical',
      sourceEventId: 'payment-1', type: 'income',
    },
    'canonical-refund-1': {
      amount: 10000, createdAt: nowBeforeCutoff, date, id: 'canonical-refund-1',
      paymentMethod: 'cash', source: 'booking-refund', sourceBookingId: 'booking-canonical',
      sourceEventId: 'refund-1', type: 'expense',
    },
    'manual-transfer': {
      amount: 200000, createdAt: nowBeforeCutoff, date, id: 'manual-transfer',
      paymentMethod: 'transfer', source: 'manual', type: 'income',
    },
    'manual-qris': {
      amount: 150000, createdAt: nowBeforeCutoff, date, id: 'manual-qris',
      paymentMethod: 'qris', source: 'manual', type: 'income',
    },
    'manual-other-expense': {
      amount: 5000, createdAt: nowBeforeCutoff, date, id: 'manual-other-expense',
      paymentMethod: 'other', source: 'manual', type: 'expense',
    },
    'manual-cash-expense': {
      amount: 10000, createdAt: nowBeforeCutoff, date, id: 'manual-cash-expense',
      paymentMethod: 'cash', source: 'manual', type: 'expense',
    },
  },
  bookings: {
    'booking-canonical': {
      date,
      id: 'booking-canonical',
      paymentHistory: [{
        amount: 80000, createdAt: nowBeforeCutoff, date, id: 'payment-1', method: 'cash',
      }],
      refundHistory: [{
        amount: 10000, createdAt: nowBeforeCutoff, date, id: 'refund-1', method: 'cash',
      }],
      paymentStatus: 'partial',
    },
    'booking-legacy-jakarta-boundary': {
      createdAt: '2026-11-04T17:00:00.000Z',
      date: '2026-11-04',
      dpAmount: 50000,
      id: 'booking-legacy-jakarta-boundary',
      lastPaymentAt: '2026-11-04T17:00:00.000Z',
      lastPaymentMethod: 'cash',
      paymentStatus: 'dp',
      paidAmount: 50000,
      paymentHistory: [],
    },
  },
});

const preview = await previewDailyClosing({
  actor,
  body: {
    businessDate: date,
    registerId: 'main',
    openingCash: 100000,
    countedCash: 220000,
    digitalCounts: { transfer: 200000, qris: 150000, other: 0 },
  },
  firestore,
  now: new Date('2026-11-05T09:00:00.000Z'),
});

assert.equal(preview.transactionCount, 7, 'Canonical payment/refund must not be double-counted with booking histories.');
assert.equal(preview.totalsByMethod.cash.income, 130000);
assert.equal(preview.totalsByMethod.cash.expense, 20000);
assert.equal(preview.totalsByMethod.cash.net, 110000);
assert.equal(preview.expectedCash, 210000);
assert.equal(preview.totalsByMethod.transfer.net, 200000);
assert.equal(preview.totalsByMethod.qris.net, 150000);
assert.equal(preview.totalsByMethod.other.net, -5000);
assert.equal(preview.reconciliation.cashVariance, 10000);
assert.equal(preview.reconciliation.digital.transfer.variance, 0);
assert.equal(preview.reconciliation.digital.qris.variance, 0);
assert.equal(preview.reconciliation.digital.other.variance, 5000);
assert.equal(
  preview.transactionReferences.some((row) => row.id.includes('booking-legacy-jakarta-boundary')),
  true,
  'Timestamp 17:00 UTC must resolve to the next Asia/Jakarta business date.',
);

const closePayload = {
  businessDate: date,
  registerId: 'main',
  openingCash: 100000,
  countedCash: 215000,
  digitalCounts: { transfer: 200000, qris: 150000, other: 0 },
  varianceReason: 'Selisih kas sudah diperiksa',
  reviewNote: 'Closing shift malam',
};
await assert.rejects(
  () => closeDailyClosing({
    actor,
    body: { ...closePayload, varianceReason: '' },
    firestore,
    request: new Request('https://worker.test/close', { headers: { 'x-idempotency-key': 'close-missing-reason' }, method: 'POST' }),
    now: new Date('2026-11-05T09:00:00.000Z'),
  }),
  (error) => error?.code === 'variance_reason_required',
);

const firstCloseRequest = () => new Request('https://worker.test/close', {
  headers: { 'x-idempotency-key': 'close-key-1' },
  method: 'POST',
});
const closed = await closeDailyClosing({
  actor,
  body: closePayload,
  firestore,
  request: firstCloseRequest(),
  now: new Date('2026-11-05T09:00:00.000Z'),
});
assert.equal(closed.duplicate, false);
assert.equal(closed.session.status, 'closed');
assert.equal(closed.session.revision, 1);
assert.equal(closed.session.expectedCash, 210000);
assert.equal(closed.session.transactionCount, 7);
assert.equal(firestore.collection('cashClosingSessions').size, 1);
assert.equal(firestore.collection('cashClosingEvents').size, 1);
assert.equal(firestore.collection('adminOperationKeys').size, 1);
assert.equal(firestore.collection('adminOperationAudit').size, 1);
const firstCloseEvent = Array.from(firestore.collection('cashClosingEvents').values())[0].data;
assert.equal(firstCloseEvent.snapshot.revision, 1);
assert.equal(firstCloseEvent.snapshot.transactionCount, 7);
assert.equal(firstCloseEvent.snapshot.transactionReferences.length, 7);

const duplicate = await closeDailyClosing({
  actor,
  body: closePayload,
  firestore,
  request: firstCloseRequest(),
  now: new Date('2026-11-05T09:01:00.000Z'),
});
assert.equal(duplicate.duplicate, true);
assert.equal(firestore.collection('cashClosingEvents').size, 1);

await assert.rejects(
  () => closeDailyClosing({
    actor,
    body: { ...closePayload, varianceReason: 'Tindakan baru' },
    firestore,
    request: new Request('https://worker.test/close', { headers: { 'x-idempotency-key': 'close-key-2' }, method: 'POST' }),
    now: new Date('2026-11-05T09:02:00.000Z'),
  }),
  (error) => error?.code === 'daily_closing_already_closed',
);

await assert.rejects(
  () => reopenDailyClosing({
    actor,
    body: { businessDate: date, registerId: 'main', reason: 'Reopen test' },
    firestore,
    request: new Request('https://worker.test/reopen', { headers: { 'x-idempotency-key': 'reopen-admin' }, method: 'POST' }),
  }),
  (error) => error?.status === 403 && error?.code === 'owner_required',
);

const reopened = await reopenDailyClosing({
  actor: owner,
  body: { businessDate: date, registerId: 'main', reason: 'Koreksi posting terlambat' },
  firestore,
  request: new Request('https://worker.test/reopen', { headers: { 'x-idempotency-key': 'reopen-owner' }, method: 'POST' }),
  now: new Date('2026-11-05T09:10:00.000Z'),
});
assert.equal(reopened.session.status, 'reopened');
assert.equal(reopened.session.revision, 1);
assert.equal(reopened.session.transactionCount, 7);
assert.equal(firestore.collection('cashClosingEvents').size, 2);

await firestore.commit([firestore.setWrite('bookkeepingEntries', 'late-cash-income', {
  amount: 5000,
  createdAt: '2026-11-05T09:20:00.000Z',
  date,
  id: 'late-cash-income',
  paymentMethod: 'cash',
  source: 'manual',
  type: 'income',
})]);

const latePreview = await previewDailyClosing({
  actor: owner,
  body: {
    businessDate: date,
    registerId: 'main',
    openingCash: 100000,
    countedCash: 220000,
    digitalCounts: { transfer: 200000, qris: 150000, other: 0 },
  },
  firestore,
  now: new Date('2026-11-05T09:25:00.000Z'),
});
assert.equal(latePreview.status, 'reopened');
assert.equal(latePreview.latePostingCount, 1);
assert.equal(latePreview.latePostingExceptions[0].id, 'late-cash-income');
assert.equal(latePreview.transactionCount, 8);
assert.equal(latePreview.events.length, 2);
assert.equal(latePreview.events.some((event) => event.action === 'reopened'), true);
assert.equal(latePreview.existingSession.transactionCount, 7, 'The previous closed snapshot must remain unchanged while reopened.');

const secondClose = await closeDailyClosing({
  actor: owner,
  body: {
    ...closePayload,
    countedCash: 220000,
    varianceReason: 'Posting terlambat masuk',
  },
  firestore,
  request: new Request('https://worker.test/close', { headers: { 'x-idempotency-key': 'close-key-3' }, method: 'POST' }),
  now: new Date('2026-11-05T09:30:00.000Z'),
});
assert.equal(secondClose.session.status, 'closed');
assert.equal(secondClose.session.revision, 2);
assert.equal(secondClose.session.transactionCount, 8);
assert.equal(secondClose.session.expectedCash, 215000);
const closeEvents = Array.from(firestore.collection('cashClosingEvents').values()).map((entry) => entry.data);
assert.equal(closeEvents.find((event) => event.revision === 1 && event.action === 'closed').snapshot.transactionCount, 7);
assert.equal(closeEvents.find((event) => event.revision === 2 && event.action === 'closed').snapshot.transactionCount, 8);
assert.equal(firestore.collection('cashClosingEvents').size, 3);

const closedPreview = await previewDailyClosing({
  actor,
  body: { businessDate: date, registerId: 'main', openingCash: 0, countedCash: 0, digitalCounts: { transfer: 0, qris: 0, other: 0 } },
  firestore,
  now: new Date('2026-11-05T09:35:00.000Z'),
});
assert.equal(closedPreview.isClosed, true);
assert.equal(closedPreview.expectedCash, 215000, 'Closed snapshot values must not be replaced by later UI input.');
assert.equal(closedPreview.transactionCount, 8);
assert.equal(closedPreview.transactionReferences.length, 8);
assert.equal(closedPreview.events.length, 3);
assert.equal(closedPreview.canReopen, false);

await assert.rejects(
  () => reopenDailyClosing({
    actor: owner,
    body: { businessDate: date, registerId: 'main', reason: 'x' },
    firestore,
    request: new Request('https://worker.test/reopen', { headers: { 'x-idempotency-key': 'reopen-invalid-reason' }, method: 'POST' }),
  }),
  (error) => error?.code === 'reopen_reason_required',
);

assert.equal(firestore.collection('adminOperationAudit').size, 3);
console.log('daily-closing-worker-contract-test: PASS');
