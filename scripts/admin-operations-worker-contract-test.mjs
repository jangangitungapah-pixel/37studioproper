import assert from 'node:assert/strict';
import { transferOwnership } from '../workers/admin-operations-worker/src/domain/accounts.js';
import {
  recordPayment,
  recordRefund,
  reviewPaymentProof,
  voidInvoice,
} from '../workers/admin-operations-worker/src/domain/finance.js';
import { permanentlyDeleteGalleryItem } from '../workers/admin-operations-worker/src/domain/gallery.js';
import { adjustInventory } from '../workers/admin-operations-worker/src/domain/inventory.js';

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
  const firestore = new FakeFirestore({
    bookings: {
      'booking-1': {
        bookingCode: 'BKG-1',
        customer: 'Hazel',
        invoiceNumber: 'INV-1',
        paymentHistory: [],
        paymentStatus: 'pending',
        refundHistory: [],
        total: 1000,
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
      'photo-1': { isDeleted: true, publicId: 'cloud/photo-1', title: 'Photo' },
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
  assert.notEqual(await firestore.getDocument('gallery', 'photo-1'), null);
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

console.log('Admin operations Worker contract passed.');
