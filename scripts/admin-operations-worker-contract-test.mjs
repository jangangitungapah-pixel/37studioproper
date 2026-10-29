import assert from 'node:assert/strict';
import { transferOwnership } from '../workers/admin-operations-worker/src/domain/accounts.js';
import { createManualBooking, decideBookingRequest, updateManualBooking } from '../workers/admin-operations-worker/src/domain/bookings.js';
import {
  recordPayment,
  recordRefund,
  reviewPaymentProof,
  voidInvoice,
} from '../workers/admin-operations-worker/src/domain/finance.js';
import { permanentlyDeleteGalleryItem } from '../workers/admin-operations-worker/src/domain/gallery.js';
import { adjustInventory } from '../workers/admin-operations-worker/src/domain/inventory.js';
import { readJson } from '../workers/admin-operations-worker/src/lib/http.js';

function clone(value) {
  return structuredClone(value);
}

class FakeFirestore {
  constructor(seed = {}) {
    this.collections = new Map();
    this.version = 1;
    this.projectId = 'studio37-test';

    Object.entries(seed).forEach(([collectionId, documents]) => {
      this.collections.set(collectionId, new Map(
        Object.entries(documents).map(([id, data]) => [id, {
          data: clone(data),
          updateTime: `v${this.version++}`,
        }]),
      ));
    });
  }

  collection(collectionId) {
    if (!this.collections.has(collectionId)) this.collections.set(collectionId, new Map());
    return this.collections.get(collectionId);
  }

  async getDocument(collectionId, id) {
    const entry = this.collection(collectionId).get(id);
    return entry ? { data: clone(entry.data), id, updateTime: entry.updateTime } : null;
  }

  setWrite(collectionId, id, data, precondition = null) {
    return { collectionId, data: clone(data), id, kind: 'set', precondition };
  }

  deleteWrite(collectionId, id, precondition = null) {
    return { collectionId, id, kind: 'delete', precondition };
  }

  async commit(writes) {
    for (const write of writes) {
      const existing = this.collection(write.collectionId).get(write.id);
      if (write.precondition?.exists === false && existing) {
        const error = new Error('exists');
        error.status = 409;
        throw error;
      }
      if (write.precondition?.updateTime && existing?.updateTime !== write.precondition.updateTime) {
        const error = new Error('stale');
        error.status = 412;
        throw error;
      }
    }

    for (const write of writes) {
      const collection = this.collection(write.collectionId);
      if (write.kind === 'delete') collection.delete(write.id);
      else collection.set(write.id, { data: clone(write.data), updateTime: `v${this.version++}` });
    }
    return { writeResults: writes.map(() => ({})) };
  }

  async runQuery(query) {
    const collectionId = query.from?.[0]?.collectionId;
    const field = query.where?.fieldFilter?.field?.fieldPath;
    const value = query.where?.fieldFilter?.value?.stringValue;
    return Array.from(this.collection(collectionId).entries())
      .filter(([, entry]) => entry.data[field] === value)
      .slice(0, query.limit || 100)
      .map(([id, entry]) => ({ data: clone(entry.data), id, updateTime: entry.updateTime }));
  }
}

class BarrierReadFirestore extends FakeFirestore {
  constructor(seed, targetCollection, targetId, requiredReads = 2) {
    super(seed);
    this.targetCollection = targetCollection;
    this.targetId = targetId;
    this.requiredReads = requiredReads;
    this.targetReadCount = 0;
    this.readBarrier = new Promise((resolveBarrier) => {
      this.releaseReadBarrier = resolveBarrier;
    });
  }

  async getDocument(collectionId, id) {
    const snapshot = await super.getDocument(collectionId, id);

    if (
      collectionId === this.targetCollection &&
      id === this.targetId &&
      this.targetReadCount < this.requiredReads
    ) {
      this.targetReadCount += 1;
      if (this.targetReadCount === this.requiredReads) this.releaseReadBarrier();
      await this.readBarrier;
    }

    return snapshot;
  }
}

function requestWithKey(key) {
  return new Request('https://operations.test/action', {
    headers: { 'x-idempotency-key': key },
    method: 'POST',
  });
}

const actor = {
  displayName: 'Owner Test',
  role: 'owner',
  uid: 'owner-1',
};

{
  const parsed = await readJson(new Request('https://operations.test/body', {
    body: JSON.stringify({ ok: true }),
    method: 'POST',
  }));
  assert.deepEqual(parsed, { ok: true });
  await assert.rejects(
    readJson(new Request('https://operations.test/body', {
      body: JSON.stringify({ payload: 'x'.repeat(70_000) }),
      method: 'POST',
    })),
    (error) => error?.code === 'payload_too_large',
  );
}

{
  const firestore = new FakeFirestore();
  const body = {
    customer: 'Band Canonical',
    date: '2026-08-20',
    durationHours: 2,
    id: 'booking-created-server-side',
    invoiceNumber: 'INV-SERVER-1',
    paymentHistory: [{ amount: 250_000, method: 'transfer' }],
    pricingMode: 'session',
    sessionLabel: 'Recording',
    startHour: 10,
    subtotal: 500_000,
    total: 500_000,
  };
  const first = await createManualBooking({
    actor,
    body,
    firestore,
    request: requestWithKey('manual-booking-one'),
  });
  const retry = await createManualBooking({
    actor,
    body,
    firestore,
    request: requestWithKey('manual-booking-one'),
  });
  assert.equal(first.booking.paymentStatusCanonical, 'partial');
  assert.equal(first.booking.paymentHistory.length, 1);
  assert.equal(retry.duplicate, true);
  assert.equal(firestore.collection('bookkeepingEntries').size, 1);
  assert.equal(firestore.collection('clientCalendarSlots').size, 1);
  assert.equal(firestore.collection('bookingScheduleDays').size, 1);
  assert.equal(
    JSON.stringify(firestore.collection('adminOperationKeys').values().next().value.data).includes('Band Canonical'),
    false,
    'Idempotency receipts must not duplicate booking/customer PII.',
  );

  await assert.rejects(
    createManualBooking({
      actor,
      body: { ...body, id: 'booking-conflict' },
      firestore,
      request: requestWithKey('manual-booking-conflict'),
    }),
    (error) => error?.code === 'booking_conflict',
  );
}

for (const invalidStartHour of ['', null, true, false, '1e1', '10.5', 10.5, 24, -1]) {
  const firestore = new FakeFirestore();
  await assert.rejects(
    createManualBooking({
      actor,
      body: {
        customer: 'Invalid hour',
        date: '2026-08-20',
        durationHours: 1,
        id: 'invalid-hour-booking',
        pricingMode: 'session',
        sessionLabel: 'Recording',
        startHour: invalidStartHour,
        total: 100_000,
        subtotal: 100_000,
      },
      firestore,
      request: requestWithKey('invalid-hour-' + String(invalidStartHour)),
    }),
    (error) => error?.code === 'invalid_start_hour',
    'Manual booking creation must reject invalid start hour: ' + String(invalidStartHour),
  );
  assert.equal(firestore.collection('bookings').size, 0);
}


function pendingClientRequest(id, startHour, durationHours = 2) {
  return {
    bookingRequestStatus: 'submitted',
    clientUid: `client-${id}`,
    customer: `Customer ${id}`,
    date: '2026-08-20',
    durationHours,
    id,
    paymentStatus: 'pending',
    paymentStatusCanonical: 'unpaid',
    requestStatus: 'submitted',
    sessionLabel: 'Recording',
    sessionStatus: 'scheduled',
    source: 'clientPortal',
    startHour,
    status: 'pending',
    updatedAt: '2026-08-19T10:00:00.000Z',
  };
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'request-reason-required': pendingClientRequest('request-reason-required', 10),
    },
  });

  await assert.rejects(
    decideBookingRequest({
      actor,
      body: { bookingId: 'request-reason-required', status: 'rejected', note: '' },
      firestore,
      request: requestWithKey('reject-without-reason'),
    }),
    (error) => error?.code === 'booking_reason_required',
    'The server must enforce a reason for rejected booking requests.',
  );
  assert.equal(firestore.collection('bookings').get('request-reason-required').data.requestStatus, 'submitted');
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'cancel-request-active': {
        ...pendingClientRequest('cancel-request-active', 10, 2),
        bookingRequestStatus: 'cancellation_requested',
        requestStatus: 'cancellation_requested',
      },
      'new-overlapping-request': pendingClientRequest('new-overlapping-request', 10, 2),
    },
  });
  await assert.rejects(
    decideBookingRequest({
      actor,
      body: { bookingId: 'new-overlapping-request', status: 'confirmed', note: 'Disetujui admin' },
      firestore,
      request: requestWithKey('confirm-overlaps-cancellation-request'),
    }),
    (error) => error?.code === 'booking_conflict',
    'A cancellation request must keep occupying its slot until cancellation is approved.',
  );
  assert.equal(firestore.collection('bookings').get('cancel-request-active').data.requestStatus, 'cancellation_requested');
  assert.equal(firestore.collection('clientCalendarSlots').size, 0);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'request-race-a': pendingClientRequest('request-race-a', 10, 2),
      'request-race-b': pendingClientRequest('request-race-b', 10, 2),
    },
  });
  const makeDecision = (bookingId, key) => decideBookingRequest({
    actor,
    body: { bookingId, decisionKey: key, note: 'Disetujui admin', status: 'confirmed' },
    firestore,
    request: requestWithKey(key),
  });
  const outcomes = await Promise.allSettled([
    makeDecision('request-race-a', 'race-decision-a'),
    makeDecision('request-race-b', 'race-decision-b'),
  ]);
  const successful = outcomes.filter((result) => result.status === 'fulfilled');
  const rejected = outcomes.filter((result) => result.status === 'rejected');

  assert.equal(successful.length, 1, 'Only one overlapping request may be confirmed concurrently.');
  assert.equal(rejected.length, 1, 'The overlapping decision must be rejected after the date lock is refreshed.');
  assert.equal(rejected[0].reason?.code, 'booking_conflict');
  assert.equal(firestore.collection('clientCalendarSlots').size, 1);
  assert.equal(firestore.collection('bookingMessages').size, 1);
  assert.equal(firestore.collection('bookingScheduleDays').get('2026-08-20').data.revision, 1);

  const confirmed = [...firestore.collection('bookings').values()].filter((entry) => entry.data.requestStatus === 'confirmed');
  assert.equal(confirmed.length, 1);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'request-edge-a': pendingClientRequest('request-edge-a', 10, 2),
      'request-edge-b': pendingClientRequest('request-edge-b', 12, 1),
    },
  });
  const outcomes = await Promise.all([
    decideBookingRequest({
      actor,
      body: { bookingId: 'request-edge-a', decisionKey: 'edge-decision-a', note: 'Disetujui admin', status: 'confirmed' },
      firestore,
      request: requestWithKey('edge-decision-a'),
    }),
    decideBookingRequest({
      actor,
      body: { bookingId: 'request-edge-b', decisionKey: 'edge-decision-b', note: 'Disetujui admin', status: 'confirmed' },
      firestore,
      request: requestWithKey('edge-decision-b'),
    }),
  ]);
  assert.equal(outcomes.length, 2, 'A session starting exactly at the previous end time remains available.');
  assert.equal(firestore.collection('clientCalendarSlots').size, 2);
  assert.equal(firestore.collection('bookingScheduleDays').get('2026-08-20').data.revision, 2);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'request-vs-manual': pendingClientRequest('request-vs-manual', 10, 2),
    },
  });
  const manualBody = {
    customer: 'Manual race',
    date: '2026-08-20',
    durationHours: 2,
    id: 'manual-vs-request',
    pricingMode: 'session',
    sessionLabel: 'Recording',
    startHour: 10,
    total: 100_000,
    subtotal: 100_000,
  };
  const outcomes = await Promise.allSettled([
    decideBookingRequest({
      actor,
      body: { bookingId: 'request-vs-manual', decisionKey: 'request-vs-manual-decision', note: 'Disetujui admin', status: 'confirmed' },
      firestore,
      request: requestWithKey('request-vs-manual-decision'),
    }),
    createManualBooking({
      actor,
      body: manualBody,
      firestore,
      request: requestWithKey('manual-vs-request-create'),
    }),
  ]);
  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
    'The shared schedule-day precondition must serialize confirmation against manual creation.',
  );
  assert.equal(firestore.collection('clientCalendarSlots').size, 1);
  assert.equal(firestore.collection('bookingScheduleDays').get('2026-08-20').data.revision, 1);
}

{
  const currentManual = {
    bookingRequestStatus: 'confirmed',
    customer: 'Manual race',
    date: '2026-08-21',
    durationHours: 2,
    id: 'manual-race-reschedule',
    requestStatus: 'confirmed',
    sessionLabel: 'Rehearsal',
    sessionStatus: 'scheduled',
    source: 'admin',
    startHour: 14,
    status: 'pending',
    updatedAt: '2026-08-19T10:00:00.000Z',
  };
  const firestore = new FakeFirestore({
    bookings: {
      'request-vs-reschedule': pendingClientRequest('request-vs-reschedule', 10, 2),
      'manual-race-reschedule': currentManual,
    },
  });
  const outcomes = await Promise.allSettled([
    decideBookingRequest({
      actor,
      body: {
        bookingId: 'request-vs-reschedule',
        decisionKey: 'request-vs-reschedule-decision',
        note: 'Disetujui admin',
        status: 'confirmed',
      },
      firestore,
      request: requestWithKey('request-vs-reschedule-decision'),
    }),
    updateManualBooking({
      actor,
      body: {
        expectedUpdatedAt: currentManual.updatedAt,
        id: currentManual.id,
        patch: { date: '2026-08-20', durationHours: 2, startHour: 10 },
      },
      firestore,
      request: requestWithKey('manual-reschedule-vs-confirmation'),
    }),
  ]);

  assert.equal(
    outcomes.filter((result) => result.status === 'fulfilled').length,
    1,
    'Only one of an overlapping confirmation and reschedule may claim the same slot.',
  );
  assert.equal(
    outcomes.filter((result) => result.status === 'rejected').length,
    1,
    'The concurrent mutation that loses the schedule-day revision must be revalidated.',
  );

  const activeOverlaps = [...firestore.collection('bookings').values()].filter(({ data }) => (
    data.date === '2026-08-20' &&
    (data.requestStatus === 'confirmed' || data.source === 'admin')
  ));
  assert.equal(activeOverlaps.length, 1);
  assert.equal(firestore.collection('bookingScheduleDays').has('2026-08-20'), true);
}

{
  const current = {
    bookingRequestStatus: 'confirmed',
    customer: 'Existing customer',
    date: '2026-08-20',
    durationHours: 2,
    id: 'manual-reschedule',
    sessionLabel: 'Rehearsal',
    sessionStatus: 'scheduled',
    source: 'admin',
    startHour: 10,
    status: 'pending',
    updatedAt: '2026-08-19T10:00:00.000Z',
  };
  const firestore = new FakeFirestore({
    bookings: {
      'manual-reschedule': current,
      'existing-conflict': {
        ...current,
        date: '2026-08-21',
        id: 'existing-conflict',
        startHour: 12,
      },
    },
  });
  await assert.rejects(
    updateManualBooking({
      actor,
      body: {
        expectedUpdatedAt: current.updatedAt,
        id: current.id,
        patch: { date: '2026-08-21', durationHours: 2, startHour: 11 },
      },
      firestore,
      request: requestWithKey('manual-reschedule-conflict'),
    }),
    (error) => error?.code === 'booking_conflict',
  );

  const saved = await updateManualBooking({
    actor,
    body: {
      expectedUpdatedAt: current.updatedAt,
      id: current.id,
      patch: { date: '2026-08-22', durationHours: 2, startHour: 11 },
    },
    firestore,
    request: requestWithKey('manual-reschedule-success'),
  });
  assert.equal(saved.booking.date, '2026-08-22');
  assert.equal(saved.booking.startHour, 11);
  assert.equal(firestore.collection('bookingScheduleDays').has('2026-08-20'), true);
  assert.equal(firestore.collection('bookingScheduleDays').has('2026-08-22'), true);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'invalid-update': {
        bookingRequestStatus: 'confirmed',
        customer: 'Invalid test',
        date: '2026-08-20',
        durationHours: 2,
        id: 'invalid-update',
        sessionLabel: 'Recording',
        startHour: 10,
        updatedAt: '2026-08-19T10:00:00.000Z',
      },
    },
  });
  await assert.rejects(
    updateManualBooking({
      actor,
      body: {
        expectedUpdatedAt: '2026-08-19T10:00:00.000Z',
        id: 'invalid-update',
        patch: { startHour: 10.5 },
      },
      firestore,
      request: requestWithKey('invalid-update-hour'),
    }),
    (error) => error?.code === 'invalid_start_hour',
  );
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-1': {
        bookingCode: 'BKG-1',
        bookingRequestStatus: 'confirmed',
        customer: 'Hazel',
        date: '2026-08-20',
        durationHours: 2,
        invoiceNumber: 'INV-1',
        paymentHistory: [],
        paymentStatus: 'pending',
        refundHistory: [],
        sessionStatus: 'scheduled',
        startHour: 10,
        total: 1000,
      },
    },
    clientCalendarSlots: {
      'booking-1': {
        bookingId: 'booking-1',
        date: '2026-08-20',
        durationHours: 2,
        startHour: 10,
        title: 'Terisi',
      },
    },
  });
  const paymentBody = { amount: 400, bookingId: 'booking-1', method: 'transfer' };
  const first = await recordPayment({
    actor,
    body: paymentBody,
    firestore,
    request: requestWithKey('payment-one'),
  });
  const retry = await recordPayment({
    actor,
    body: paymentBody,
    firestore,
    request: requestWithKey('payment-one'),
  });

  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal((await firestore.getDocument('bookings', 'booking-1')).data.paymentHistory.length, 1);
  assert.equal(firestore.collection('bookkeepingEntries').size, 1);
  assert.equal(firestore.collection('adminOperationAudit').values().next().value.data.result, undefined);

  await assert.rejects(
    recordRefund({
      actor,
      body: { amount: 1, bookingId: 'booking-1', reason: 'x' },
      firestore,
      request: requestWithKey('refund-invalid'),
    }),
    /minimal 4 karakter/,
  );
  await recordRefund({
    actor,
    body: { amount: 200, bookingId: 'booking-1', method: 'cash', reason: 'Koreksi sebagian' },
    firestore,
    request: requestWithKey('refund-one'),
  });
  await assert.rejects(
    voidInvoice({
      actor,
      body: { bookingId: 'booking-1', reason: 'Invoice batal' },
      firestore,
      request: requestWithKey('void-blocked'),
    }),
    /Catat refund sebelum void/,
  );
  await recordRefund({
    actor,
    body: { amount: 200, bookingId: 'booking-1', method: 'cash', reason: 'Koreksi penuh' },
    firestore,
    request: requestWithKey('refund-two'),
  });
  const voided = await voidInvoice({
    actor,
    body: { bookingId: 'booking-1', reason: 'Invoice batal' },
    firestore,
    request: requestWithKey('void-final'),
  });
  assert.equal(voided.booking.paymentStatusCanonical, 'void');
  assert.equal(firestore.collection('clientCalendarSlots').has('booking-1'), false);
  assert.equal(firestore.collection('bookingScheduleDays').get('2026-08-20').data.revision, 1);
}

// Force two finance requests to read the same booking revision before either commits.
// This models the race that sequential retry tests cannot expose.
{
  const firestore = new BarrierReadFirestore({
    bookings: {
      'booking-payment-race': {
        paymentHistory: [],
        paymentStatus: 'pending',
        paymentStatusCanonical: 'unpaid',
        refundHistory: [],
        total: 1000,
      },
    },
  }, 'bookings', 'booking-payment-race');

  const attempts = await Promise.allSettled([
    recordPayment({
      actor,
      body: { amount: 700, bookingId: 'booking-payment-race', method: 'transfer' },
      firestore,
      request: requestWithKey('payment-race-a'),
    }),
    recordPayment({
      actor,
      body: { amount: 700, bookingId: 'booking-payment-race', method: 'qris' },
      firestore,
      request: requestWithKey('payment-race-b'),
    }),
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const rejected = attempts.find((attempt) => attempt.status === 'rejected');
  assert.equal(rejected.reason.code, 'operation_conflict');

  const booking = (await firestore.getDocument('bookings', 'booking-payment-race')).data;
  assert.equal(booking.paymentHistory.length, 1);
  assert.equal(booking.paidAmount, 700);
  assert.equal(booking.invoiceAmount, 300);
  assert.equal(firestore.collection('bookkeepingEntries').size, 1);
  assert.equal(firestore.collection('adminOperationKeys').size, 1);
  assert.equal(firestore.collection('adminOperationAudit').size, 1);
}

// Proof approval and a manual payment also compete for the same invoice balance.
// The proof must remain pending when the manual payment wins, and neither path may
// create two payment-history or ledger entries from the same stale invoice snapshot.
{
  const firestore = new BarrierReadFirestore({
    bookings: {
      'booking-proof-race': {
        paymentHistory: [],
        paymentStatus: 'pending',
        paymentStatusCanonical: 'unpaid',
        refundHistory: [],
        total: 1000,
      },
    },
    paymentProofs: {
      'proof-race': {
        amount: 700,
        bookingId: 'booking-proof-race',
        method: 'qris',
        status: 'pending',
      },
    },
  }, 'bookings', 'booking-proof-race');

  const attempts = await Promise.allSettled([
    recordPayment({
      actor,
      body: { amount: 700, bookingId: 'booking-proof-race', method: 'transfer' },
      firestore,
      request: requestWithKey('proof-race-manual'),
    }),
    reviewPaymentProof({
      actor,
      body: { amount: 700, method: 'qris', note: 'Dana cocok' },
      decision: 'approve',
      firestore,
      proofId: 'proof-race',
      request: requestWithKey('proof-race-approval'),
    }),
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const rejected = attempts.find((attempt) => attempt.status === 'rejected');
  assert.equal(rejected.reason.code, 'operation_conflict');

  const booking = (await firestore.getDocument('bookings', 'booking-proof-race')).data;
  const proof = (await firestore.getDocument('paymentProofs', 'proof-race')).data;
  assert.equal(booking.paymentHistory.length, 1);
  assert.equal(booking.paidAmount, 700);
  assert.equal(booking.invoiceAmount, 300);
  assert.equal(firestore.collection('bookkeepingEntries').size, 1);
  assert.equal(firestore.collection('adminOperationKeys').size, 1);
  assert.equal(firestore.collection('adminOperationAudit').size, 1);
  assert.equal(
    proof.status,
    attempts[1].status === 'fulfilled' ? 'approved' : 'pending',
    'A failed proof-approval race must leave the proof pending for a safe retry.',
  );
}

// Two stale refund calculations must never refund more than the original receipt total.
{
  const firestore = new BarrierReadFirestore({
    bookings: {
      'booking-refund-race': {
        paymentHistory: [{
          amount: 1000,
          createdAt: '2026-08-20T10:00:00.000Z',
          date: '2026-08-20',
          id: 'payment-seed',
          idempotencyKey: 'payment-seed',
          method: 'transfer',
          source: 'admin-payment',
        }],
        paymentStatus: 'lunas',
        paymentStatusCanonical: 'paid',
        refundHistory: [],
        total: 1000,
      },
    },
  }, 'bookings', 'booking-refund-race');

  const attempts = await Promise.allSettled([
    recordRefund({
      actor,
      body: { amount: 700, bookingId: 'booking-refund-race', method: 'transfer', reason: 'Refund pertama' },
      firestore,
      request: requestWithKey('refund-race-a'),
    }),
    recordRefund({
      actor,
      body: { amount: 700, bookingId: 'booking-refund-race', method: 'qris', reason: 'Refund kedua' },
      firestore,
      request: requestWithKey('refund-race-b'),
    }),
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const rejected = attempts.find((attempt) => attempt.status === 'rejected');
  assert.equal(rejected.reason.code, 'operation_conflict');

  const booking = (await firestore.getDocument('bookings', 'booking-refund-race')).data;
  assert.equal(booking.refundHistory.length, 1);
  assert.equal(booking.refundedAmount, 700);
  assert.equal(booking.paidAmount, 300);
  assert.equal(booking.invoiceAmount, 700);
  assert.equal(firestore.collection('bookkeepingEntries').size, 1);
  assert.equal(firestore.collection('adminOperationKeys').size, 1);
  assert.equal(firestore.collection('adminOperationAudit').size, 1);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-zero': {
        paymentHistory: [],
        paymentStatus: 'pending',
        refundHistory: [],
        subtotal: 500_000,
        total: 0,
      },
    },
  });
  await assert.rejects(
    recordPayment({
      actor,
      body: { amount: 1, bookingId: 'booking-zero', method: 'cash' },
      firestore,
      request: requestWithKey('zero-total-payment'),
    }),
    (error) => error?.code === 'amount_exceeds_outstanding',
  );
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-proof': { paymentHistory: [], paymentStatus: 'pending', refundHistory: [], total: 500 },
    },
    paymentProofs: {
      'proof-1': { amount: 500, bookingId: 'booking-proof', method: 'qris', status: 'pending' },
    },
  });
  const options = {
    actor,
    body: { amount: 500, method: 'qris', note: 'Dana cocok' },
    decision: 'approve',
    firestore,
    proofId: 'proof-1',
    request: requestWithKey('proof-approve-one'),
  };
  const first = await reviewPaymentProof(options);
  const retry = await reviewPaymentProof(options);
  assert.equal(first.proof.status, 'approved');
  assert.equal(retry.duplicate, true);
  assert.equal((await firestore.getDocument('bookings', 'booking-proof')).data.paymentHistory.length, 1);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-proof-explicit': { paymentHistory: [], paymentStatus: 'pending', refundHistory: [], total: 500 },
    },
    paymentProofs: {
      'proof-explicit': { amount: 500, bookingId: 'booking-proof-explicit', method: 'qris', status: 'pending' },
    },
  });
  await assert.rejects(
    reviewPaymentProof({
      actor,
      body: { method: 'qris' },
      decision: 'approve',
      firestore,
      proofId: 'proof-explicit',
      request: requestWithKey('proof-missing-amount'),
    }),
    (error) => error?.code === 'amount_confirmation_required',
  );
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-legacy': {
        customer: 'Legacy Customer',
        dpAmount: 200_000,
        invoiceAmount: 400_000,
        paidAmount: 200_000,
        paymentStatus: 'dp',
      },
    },
  });
  const result = await recordPayment({
    actor,
    body: { amount: 400_000, bookingId: 'booking-legacy', method: 'transfer' },
    firestore,
    request: requestWithKey('legacy-payment-one'),
  });
  assert.equal(result.snapshot.total, 600_000);
  assert.equal(result.snapshot.netPaid, 600_000);
  assert.equal(result.snapshot.outstanding, 0);
  assert.equal(result.booking.paymentHistory.length, 2);
}

{
  const firestore = new FakeFirestore({
    bookings: {
      'booking-legacy-refund': {
        customer: 'Legacy Refund',
        dpAmount: 200_000,
        invoiceAmount: 400_000,
        paidAmount: 200_000,
        paymentStatus: 'dp',
        total: 600_000,
      },
    },
  });
  await recordRefund({
    actor,
    body: { amount: 50_000, bookingId: 'booking-legacy-refund', method: 'transfer', reason: 'Refund tahap pertama' },
    firestore,
    request: requestWithKey('legacy-refund-one'),
  });
  const second = await recordRefund({
    actor,
    body: { amount: 50_000, bookingId: 'booking-legacy-refund', method: 'transfer', reason: 'Refund tahap kedua' },
    firestore,
    request: requestWithKey('legacy-refund-two'),
  });
  assert.equal(second.snapshot.grossPaid, 200_000);
  assert.equal(second.snapshot.refunded, 100_000);
  assert.equal(second.snapshot.netPaid, 100_000);
  assert.equal(second.booking.paymentHistory.length, 1);
  assert.equal(second.booking.refundHistory.length, 2);
}

{
  const firestore = new FakeFirestore({
    inventoryItems: {
      'item-1': { name: 'Cable', quantity: 4, unit: 'pcs' },
    },
  });
  const options = {
    actor,
    body: { delta: -2, itemId: 'item-1', reason: 'Dipakai sesi' },
    firestore,
    request: requestWithKey('stock-one'),
  };
  await adjustInventory(options);
  const retry = await adjustInventory(options);
  assert.equal(retry.duplicate, true);
  assert.equal((await firestore.getDocument('inventoryItems', 'item-1')).data.quantity, 2);
  assert.equal(firestore.collection('inventoryMovements').size, 1);
}

{
  const firestore = new FakeFirestore({
    gallery: {
      'photo-1': { isDeleted: true, publicId: 'studio37/gallery/photo-1', title: 'Photo' },
    },
  });
  await assert.rejects(
    permanentlyDeleteGalleryItem({
      actor,
      body: { itemId: 'photo-1' },
      env: {},
      firestore,
      request: requestWithKey('gallery-one'),
    }),
    (error) => error?.code === 'cloudinary_not_configured',
  );
  const retained = await firestore.getDocument('gallery', 'photo-1');
  assert.notEqual(retained, null);
  assert.equal(retained.data.permanentDeleteStatus, undefined);
}

{
  const permissions = { dashboard: true };
  const firestore = new FakeFirestore({
    users: {
      'admin-2': { permissions, role: 'admin', status: 'approved' },
      'owner-1': { permissions, role: 'owner', status: 'approved' },
    },
  });
  const result = await transferOwnership({
    actor,
    body: { targetUid: 'admin-2' },
    firestore,
    request: requestWithKey('owner-transfer-one'),
  });
  assert.equal(result.status, 'transferred');
  assert.equal((await firestore.getDocument('users', 'admin-2')).data.role, 'owner');
  assert.equal((await firestore.getDocument('users', 'owner-1')).data.role, 'admin');
}

// Two Owner transfers that read the same ownership revision must not promote
// two admins or leave adminControl/ownership pointing at a former owner.
{
  const permissions = { dashboard: true };
  const firestore = new BarrierReadFirestore({
    users: {
      'admin-2': { permissions, role: 'admin', status: 'approved' },
      'admin-3': { permissions, role: 'admin', status: 'approved' },
      'owner-1': { permissions, role: 'owner', status: 'approved' },
    },
    adminControl: {
      ownership: {
        currentOwnerUid: 'owner-1',
        initializedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }, 'users', 'owner-1');

  const attempts = await Promise.allSettled([
    transferOwnership({
      actor,
      body: { targetUid: 'admin-2' },
      firestore,
      request: requestWithKey('owner-race-admin-2'),
    }),
    transferOwnership({
      actor,
      body: { targetUid: 'admin-3' },
      firestore,
      request: requestWithKey('owner-race-admin-3'),
    }),
  ]);

  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const rejected = attempts.find((attempt) => attempt.status === 'rejected');
  assert.equal(rejected.reason.code, 'operation_conflict');

  const users = ['owner-1', 'admin-2', 'admin-3'];
  const owners = [];
  for (const uid of users) {
    const user = await firestore.getDocument('users', uid);
    if (user.data.role === 'owner') owners.push(uid);
  }
  const ownership = (await firestore.getDocument('adminControl', 'ownership')).data;
  assert.equal(owners.length, 1);
  assert.equal(ownership.currentOwnerUid, owners[0]);
  assert.equal((await firestore.getDocument('users', 'owner-1')).data.role, 'admin');
  assert.equal(firestore.collection('adminOperationKeys').size, 1);
  assert.equal(firestore.collection('adminOperationAudit').size, 1);
}

console.log('Admin operations Worker contract passed.');
