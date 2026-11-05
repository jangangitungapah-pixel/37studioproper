import assert from 'node:assert/strict';
import {
  createPurchaseOrder,
  createSupplier,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
  transitionPurchaseOrder,
} from '../workers/admin-operations-worker/src/domain/inventory.js';

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
}

function requestWithKey(key) {
  return new Request('https://worker.test/procurement', {
    headers: { 'x-idempotency-key': key },
    method: 'POST',
  });
}

const actor = { displayName: 'Procurement Owner', role: 'owner', uid: 'owner-procurement' };
const firestore = new FakeFirestore({
  cashClosingSessions: {
    '2026-11-04__main': {
      id: '2026-11-04__main',
      status: 'closed',
    },
  },
  inventoryItems: {
    'item-cable': {
      id: 'item-cable',
      name: 'XLR Cable 6m',
      category: 'cable',
      type: 'consumable',
      quantity: 4,
      unit: 'pcs',
      minStock: 2,
      condition: 'good',
      status: 'active',
      location: 'Store Room',
      note: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-11-05T00:00:00.000Z',
    },
  },
});

const supplierOptions = {
  actor,
  body: {
    name: 'Audio Supply Jakarta',
    contactName: 'Rina',
    phone: '08123456789',
    email: 'sales@audiosupply.example',
    address: 'Jakarta',
    notes: 'Vendor kabel dan aksesoris',
  },
  firestore,
  request: requestWithKey('procurement-supplier-create-1'),
};
const supplierResult = await createSupplier(supplierOptions);
assert.equal(supplierResult.supplier.name, 'Audio Supply Jakarta');
assert.equal(firestore.collection('suppliers').size, 1);
const supplierRetry = await createSupplier(supplierOptions);
assert.equal(supplierRetry.duplicate, true);
assert.equal(firestore.collection('suppliers').size, 1);

const poPayload = {
  supplierId: supplierResult.supplier.id,
  orderDate: '2026-11-05',
  expectedAt: '2026-11-09',
  notes: 'Restock bulanan',
  items: [{ inventoryItemId: 'item-cable', quantity: 5, unitPrice: 10000 }],
};
await assert.rejects(
  createPurchaseOrder({
    actor, body: { ...poPayload, items: [...poPayload.items, ...poPayload.items] },
    firestore, request: requestWithKey('procurement-po-duplicate-item'),
  }),
  (error) => error?.code === 'po_duplicate_inventory_item',
);
await assert.rejects(
  createPurchaseOrder({
    actor, body: { ...poPayload, expectedAt: '2026-11-01' },
    firestore, request: requestWithKey('procurement-po-invalid-date'),
  }),
  (error) => error?.code === 'po_expected_date_invalid',
);
await assert.rejects(
  createPurchaseOrder({
    actor, body: { ...poPayload, expectedAt: '2026-11-09-extra' },
    firestore, request: requestWithKey('procurement-po-malformed-date'),
  }),
  (error) => error?.code === 'procurement_date_invalid',
);

const poOptions = {
  actor,
  body: poPayload,
  firestore,
  request: requestWithKey('procurement-po-create-1'),
};
const poResult = await createPurchaseOrder(poOptions);
assert.equal(poResult.purchaseOrder.status, 'draft');
assert.equal(poResult.purchaseOrder.totalAmount, 50000);
assert.equal(poResult.purchaseOrder.items[0].name, 'XLR Cable 6m');
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 4,
  'Creating a PO must not change inventory stock.');
const poRetry = await createPurchaseOrder(poOptions);
assert.equal(poRetry.duplicate, true);
assert.equal(firestore.collection('purchaseOrders').size, 1);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 4);

const poId = poResult.purchaseOrder.id;
let currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await assert.rejects(
  transitionPurchaseOrder({
    actor,
    body: { purchaseOrderId: poId, status: 'ordered', expectedUpdatedAt: currentPO.updatedAt },
    firestore,
    request: requestWithKey('procurement-po-invalid-transition'),
  }),
  (error) => error?.code === 'purchase_order_transition_invalid',
);
await transitionPurchaseOrder({
  actor,
  body: { purchaseOrderId: poId, status: 'submitted', expectedUpdatedAt: currentPO.updatedAt },
  firestore,
  request: requestWithKey('procurement-po-submit-1'),
});
currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await transitionPurchaseOrder({
  actor,
  body: { purchaseOrderId: poId, status: 'approved', expectedUpdatedAt: currentPO.updatedAt },
  firestore,
  request: requestWithKey('procurement-po-approve-1'),
});
currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await transitionPurchaseOrder({
  actor,
  body: { purchaseOrderId: poId, status: 'ordered', expectedUpdatedAt: currentPO.updatedAt },
  firestore,
  request: requestWithKey('procurement-po-order-1'),
});
currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
assert.equal(currentPO.status, 'ordered');

const lineId = currentPO.items[0].lineId;
const partialReceiptOptions = {
  actor,
  body: {
    purchaseOrderId: poId,
    expectedUpdatedAt: currentPO.updatedAt,
    items: [{ lineId, quantity: 3 }],
    note: 'Tiga unit diterima lebih dahulu',
  },
  firestore,
  request: requestWithKey('procurement-receipt-partial-1'),
};
const partialReceipt = await receivePurchaseOrder(partialReceiptOptions);
assert.equal(partialReceipt.purchaseOrder.status, 'partially_received');
assert.equal(partialReceipt.purchaseOrder.items[0].receivedQuantity, 3);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 7,
  'A partial receipt must add only the quantity actually received.');
const partialReceiptRetry = await receivePurchaseOrder(partialReceiptOptions);
assert.equal(partialReceiptRetry.duplicate, true);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 7,
  'A receipt retry must not add stock twice.');

currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await assert.rejects(
  receivePurchaseOrder({
    actor,
    body: {
      purchaseOrderId: poId,
      expectedUpdatedAt: currentPO.updatedAt,
      items: [{ lineId, quantity: 3 }],
    },
    firestore,
    request: requestWithKey('procurement-receipt-overreceive-1'),
  }),
  (error) => error?.code === 'goods_receipt_quantity_invalid',
);
await assert.rejects(
  receivePurchaseOrder({
    actor,
    body: {
      purchaseOrderId: poId,
      expectedUpdatedAt: currentPO.updatedAt,
      items: [{ lineId, quantity: 1 }, { lineId, quantity: 1 }],
    },
    firestore,
    request: requestWithKey('procurement-receipt-duplicate-line-1'),
  }),
  (error) => error?.code === 'goods_receipt_line_duplicate',
);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 7);

const finalReceiptOptions = {
  actor,
  body: {
    purchaseOrderId: poId,
    expectedUpdatedAt: currentPO.updatedAt,
    items: [{ lineId, quantity: 2 }],
    note: 'Sisa barang diterima',
  },
  firestore,
  request: requestWithKey('procurement-receipt-final-1'),
};
const finalReceipt = await receivePurchaseOrder(finalReceiptOptions);
assert.equal(finalReceipt.purchaseOrder.status, 'received');
assert.equal(finalReceipt.purchaseOrder.items[0].receivedQuantity, 5);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 9);
assert.equal(firestore.collection('inventoryMovements').size, 2);
const finalReceiptRetry = await receivePurchaseOrder(finalReceiptOptions);
assert.equal(finalReceiptRetry.duplicate, true);
assert.equal((await firestore.getDocument('inventoryItems', 'item-cable')).data.quantity, 9);

currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await assert.rejects(
  recordPurchaseOrderPayment({
    actor,
    body: {
      purchaseOrderId: poId,
      expectedUpdatedAt: currentPO.updatedAt,
      amount: 10000,
      paymentMethod: 'transfer',
      date: '2026-11-04',
    },
    firestore,
    request: requestWithKey('procurement-payment-closed-date'),
  }),
  (error) => error?.code === 'business_date_closed',
  'Procurement payment must not post into a date closed by Daily Closing.',
);

const paymentOptions = {
  actor,
  body: {
    purchaseOrderId: poId,
    expectedUpdatedAt: currentPO.updatedAt,
    amount: 10000,
    paymentMethod: 'transfer',
    date: '2026-11-05',
    reference: 'TRF-001',
    note: 'Pembayaran termin pertama',
  },
  firestore,
  request: requestWithKey('procurement-payment-1'),
};
const paymentResult = await recordPurchaseOrderPayment(paymentOptions);
assert.equal(paymentResult.payment.amount, 10000);
assert.equal(paymentResult.expense.source, 'procurement-payment');
assert.equal(paymentResult.purchaseOrder.paidAmount, 10000);
assert.equal(firestore.collection('bookkeepingEntries').size, 1);
const paymentRetry = await recordPurchaseOrderPayment(paymentOptions);
assert.equal(paymentRetry.duplicate, true);
assert.equal(firestore.collection('bookkeepingEntries').size, 1);
currentPO = (await firestore.getDocument('purchaseOrders', poId)).data;
await assert.rejects(
  recordPurchaseOrderPayment({
    actor,
    body: {
      purchaseOrderId: poId,
      expectedUpdatedAt: currentPO.updatedAt,
      amount: 50000,
      paymentMethod: 'transfer',
      date: '2026-11-05',
    },
    firestore,
    request: requestWithKey('procurement-payment-overpay-1'),
  }),
  (error) => error?.code === 'procurement_payment_exceeds_balance',
);

const cancelPOOptions = {
  actor,
  body: poPayload,
  firestore,
  request: requestWithKey('procurement-po-cancel-protected'),
};
const cancelPOResult = await createPurchaseOrder(cancelPOOptions);
let cancelPO = (await firestore.getDocument('purchaseOrders', cancelPOResult.purchaseOrder.id)).data;
await transitionPurchaseOrder({
  actor,
  body: { purchaseOrderId: cancelPO.id, status: 'submitted', expectedUpdatedAt: cancelPO.updatedAt },
  firestore,
  request: requestWithKey('procurement-cancel-submit'),
});
cancelPO = (await firestore.getDocument('purchaseOrders', cancelPO.id)).data;
await transitionPurchaseOrder({
  actor,
  body: { purchaseOrderId: cancelPO.id, status: 'approved', expectedUpdatedAt: cancelPO.updatedAt },
  firestore,
  request: requestWithKey('procurement-cancel-approve'),
});
cancelPO = (await firestore.getDocument('purchaseOrders', cancelPO.id)).data;
await recordPurchaseOrderPayment({
  actor,
  body: {
    purchaseOrderId: cancelPO.id,
    expectedUpdatedAt: cancelPO.updatedAt,
    amount: 1000,
    paymentMethod: 'cash',
    date: '2026-11-05',
  },
  firestore,
  request: requestWithKey('procurement-cancel-payment'),
});
cancelPO = (await firestore.getDocument('purchaseOrders', cancelPO.id)).data;
await assert.rejects(
  transitionPurchaseOrder({
    actor,
    body: {
      purchaseOrderId: cancelPO.id,
      status: 'cancelled',
      expectedUpdatedAt: cancelPO.updatedAt,
      reason: 'Supplier batal',
    },
    firestore,
    request: requestWithKey('procurement-cancel-after-payment'),
  }),
  (error) => error?.code === 'purchase_order_has_payment',
);

console.log('procurement-worker-regression-test: PASS');
