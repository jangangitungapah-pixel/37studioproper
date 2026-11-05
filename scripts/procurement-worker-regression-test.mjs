import assert from 'node:assert/strict';
import {
  createPurchaseOrder,
  createSupplier,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
  transitionPurchaseOrder,
} from '../workers/admin-operations-worker/src/domain/inventory.js';
import { closeDailyClosing } from '../workers/admin-operations-worker/src/domain/dailyClosings.js';

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

  async runQuery(specification) {
    const collectionId = specification?.from?.[0]?.collectionId || '';
    const documents = [...this.collection(collectionId)].map(([id, entry]) => ({
      data: clone(entry.data),
      id,
    }));
    const filter = specification?.where?.fieldFilter;
    const filtered = filter?.op === 'EQUAL'
      ? documents.filter((document) => document.data?.[filter.field?.fieldPath] === filter.value?.stringValue)
      : documents;
    const offset = Number(specification?.offset || 0);
    const limit = Number(specification?.limit || filtered.length);
    return filtered.slice(offset, offset + limit);
  }

  async listDocuments(collectionId, options = {}) {
    const documents = [...this.collection(collectionId)].map(([id, entry]) => ({
      data: clone(entry.data),
      id,
    }));
    const offset = Number(options.pageToken || 0);
    const pageSize = Number(options.pageSize || 500);
    const page = documents.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    return {
      documents: page,
      nextPageToken: nextOffset < documents.length ? String(nextOffset) : '',
    };
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
assert.equal(poRetry.purchaseOrder.id, poResult.purchaseOrder.id,
  'A purchase-order retry must preserve the canonical purchaseOrder response key.');
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
await assert.rejects(
  transitionPurchaseOrder({
    actor: { ...actor, role: 'operator' },
    body: { purchaseOrderId: poId, status: 'approved', expectedUpdatedAt: currentPO.updatedAt },
    firestore,
    request: requestWithKey('procurement-po-approval-forbidden'),
  }),
  (error) => error?.code === 'purchase_order_approval_forbidden',
  'Approval must be rejected for actors outside Owner/Admin.',
);
await transitionPurchaseOrder({
  actor: { ...actor, role: 'admin' },
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
assert.equal(partialReceiptRetry.purchaseOrder.id, partialReceipt.purchaseOrder.id,
  'A Goods Receipt retry must preserve the canonical purchaseOrder response key.');
assert.equal(partialReceiptRetry.receipt.id, partialReceipt.receipt.id);
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
assert.equal(finalReceiptRetry.purchaseOrder.id, finalReceipt.purchaseOrder.id);
assert.equal(finalReceiptRetry.receipt.id, finalReceipt.receipt.id);
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
assert.equal(paymentRetry.purchaseOrder.id, paymentResult.purchaseOrder.id,
  'A payment retry must preserve the canonical purchaseOrder response key.');
assert.equal(paymentRetry.payment.id, paymentResult.payment.id);
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


// A supplier payment and Daily Closing racing on the same business date must
// serialize through cashClosingSessions. Exactly one stale revision may commit.
const raceFirestore = new FakeFirestore({
  purchaseOrders: {
    'po-closing-race': {
      id: 'po-closing-race',
      poNumber: 'PO-CLOSING-RACE',
      supplierId: 'supplier-race',
      supplierName: 'Race Supplier',
      status: 'ordered',
      totalAmount: 10000,
      paidAmount: 0,
      updatedAt: 'race-po-revision-1',
    },
  },
});
const originalRaceCommit = raceFirestore.commit.bind(raceFirestore);
let raceCommitArrivals = 0;
let releaseRaceCommits;
const raceCommitBarrier = new Promise((resolve) => { releaseRaceCommits = resolve; });
raceFirestore.commit = async (writes) => {
  const touchesClosingSession = writes.some((write) =>
    write.collectionId === 'cashClosingSessions' && write.id === '2026-11-05__main');
  if (touchesClosingSession) {
    raceCommitArrivals += 1;
    if (raceCommitArrivals === 2) releaseRaceCommits();
    await raceCommitBarrier;
  }
  return originalRaceCommit(writes);
};
const racePaymentOptions = {
  actor,
  body: {
    purchaseOrderId: 'po-closing-race',
    expectedUpdatedAt: 'race-po-revision-1',
    amount: 1000,
    paymentMethod: 'transfer',
    date: '2026-11-05',
    note: 'Race test supplier payment',
  },
  firestore: raceFirestore,
  request: requestWithKey('procurement-payment-daily-closing-race'),
};
const denominations = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
const raceClosingOptions = {
  actor,
  body: {
    businessDate: '2026-11-05',
    registerId: 'main',
    openingCash: 0,
    cashDenominations: Object.fromEntries(denominations.map((value) => [String(value), 0])),
    digitalCounts: { transfer: 0, qris: 0, other: 0 },
  },
  firestore: raceFirestore,
  request: requestWithKey('daily-closing-procurement-race'),
  now: new Date('2026-11-06T00:00:00.000Z'),
};
const raceResults = await Promise.allSettled([
  recordPurchaseOrderPayment(racePaymentOptions),
  closeDailyClosing(raceClosingOptions),
]);
assert.equal(raceCommitArrivals, 2, 'Both competing operations must reach the atomic commit.');
assert.equal(raceResults.filter((result) => result.status === 'fulfilled').length, 1,
  'Payment and Daily Closing must not both commit against the same session revision.');
const raceSession = await raceFirestore.getDocument('cashClosingSessions', '2026-11-05__main');
const racePO = await raceFirestore.getDocument('purchaseOrders', 'po-closing-race');
if (raceSession.data.status === 'closed') {
  assert.equal(racePO.data.paidAmount, 0);
  assert.equal(raceFirestore.collection('procurementPayments').size, 0);
  assert.equal(raceFirestore.collection('bookkeepingEntries').size, 0,
    'A losing payment must not leave a partial ledger entry.');
  assert.equal(raceFirestore.collection('cashClosingEvents').size, 1);
} else {
  assert.equal(raceSession.data.status, 'not_opened');
  assert.equal(raceSession.data.lastProcurementPaymentId !== undefined, true);
  assert.equal(racePO.data.paidAmount, 1000);
  assert.equal(raceFirestore.collection('procurementPayments').size, 1);
  assert.equal(raceFirestore.collection('bookkeepingEntries').size, 1);
  assert.equal(raceFirestore.collection('cashClosingEvents').size, 0,
    'A losing closing operation must not leave a closing event.');
}


// Concurrent partial receipts on different lines of one PO must not overwrite
// the PO revision or leave stock/movements partially applied.
const receiptRaceSupplier = {
  ...supplierResult.supplier,
  id: supplierResult.supplier.id,
};
const receiptRaceFirestore = new FakeFirestore({
  suppliers: { [receiptRaceSupplier.id]: receiptRaceSupplier },
  inventoryItems: {
    'receipt-race-item-a': {
      id: 'receipt-race-item-a', name: 'Mic Cable A', category: 'cable',
      type: 'consumable', quantity: 2, unit: 'pcs', minStock: 0,
      condition: 'good', status: 'active', location: 'Store Room',
      note: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-05T00:00:00.000Z',
    },
    'receipt-race-item-b': {
      id: 'receipt-race-item-b', name: 'Mic Cable B', category: 'cable',
      type: 'consumable', quantity: 4, unit: 'pcs', minStock: 0,
      condition: 'good', status: 'active', location: 'Store Room',
      note: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-05T00:00:00.000Z',
    },
  },
});
const receiptRacePOResult = await createPurchaseOrder({
  actor,
  body: {
    supplierId: receiptRaceSupplier.id,
    orderDate: '2026-11-05',
    expectedAt: '2026-11-09',
    notes: 'Concurrency receipt test',
    items: [
      { inventoryItemId: 'receipt-race-item-a', quantity: 2, unitPrice: 10000 },
      { inventoryItemId: 'receipt-race-item-b', quantity: 2, unitPrice: 12000 },
    ],
  },
  firestore: receiptRaceFirestore,
  request: requestWithKey('procurement-receipt-race-po-create'),
});
let receiptRacePO = receiptRacePOResult.purchaseOrder;
for (const [status, key] of [
  ['submitted', 'procurement-receipt-race-submit'],
  ['approved', 'procurement-receipt-race-approve'],
  ['ordered', 'procurement-receipt-race-order'],
]) {
  const transitioned = await transitionPurchaseOrder({
    actor,
    body: {
      purchaseOrderId: receiptRacePO.id,
      status,
      expectedUpdatedAt: receiptRacePO.updatedAt,
    },
    firestore: receiptRaceFirestore,
    request: requestWithKey(key),
  });
  receiptRacePO = transitioned.purchaseOrder;
}
const receiptRaceOriginalPO = (await receiptRaceFirestore.getDocument('purchaseOrders', receiptRacePO.id)).data;
const receiptRaceOriginalItemA = (await receiptRaceFirestore.getDocument('inventoryItems', 'receipt-race-item-a')).data.quantity;
const receiptRaceOriginalItemB = (await receiptRaceFirestore.getDocument('inventoryItems', 'receipt-race-item-b')).data.quantity;
const originalReceiptRaceCommit = receiptRaceFirestore.commit.bind(receiptRaceFirestore);
let receiptRaceCommitArrivals = 0;
let releaseReceiptRaceCommits;
const receiptRaceBarrier = new Promise((resolve) => { releaseReceiptRaceCommits = resolve; });
receiptRaceFirestore.commit = async (writes) => {
  if (writes.some((write) =>
    write.collectionId === 'purchaseOrders' && write.id === receiptRacePO.id)) {
    receiptRaceCommitArrivals += 1;
    if (receiptRaceCommitArrivals === 2) releaseReceiptRaceCommits();
    await receiptRaceBarrier;
  }
  return originalReceiptRaceCommit(writes);
};
const receiptRaceResults = await Promise.allSettled([
  receivePurchaseOrder({
    actor,
    body: {
      purchaseOrderId: receiptRacePO.id,
      expectedUpdatedAt: receiptRaceOriginalPO.updatedAt,
      items: [{ lineId: receiptRaceOriginalPO.items[0].lineId, quantity: 1 }],
      note: 'First concurrent line',
    },
    firestore: receiptRaceFirestore,
    request: requestWithKey('procurement-receipt-race-line-a'),
  }),
  receivePurchaseOrder({
    actor,
    body: {
      purchaseOrderId: receiptRacePO.id,
      expectedUpdatedAt: receiptRaceOriginalPO.updatedAt,
      items: [{ lineId: receiptRaceOriginalPO.items[1].lineId, quantity: 1 }],
      note: 'Second concurrent line',
    },
    firestore: receiptRaceFirestore,
    request: requestWithKey('procurement-receipt-race-line-b'),
  }),
]);
assert.equal(receiptRaceCommitArrivals, 2);
assert.equal(receiptRaceResults.filter((result) => result.status === 'fulfilled').length, 1,
  'Only one concurrent receipt may commit against the same PO revision.');
const receiptRacePOAfter = (await receiptRaceFirestore.getDocument('purchaseOrders', receiptRacePO.id)).data;
const receiptRaceItemAAfter = (await receiptRaceFirestore.getDocument('inventoryItems', 'receipt-race-item-a')).data.quantity;
const receiptRaceItemBAfter = (await receiptRaceFirestore.getDocument('inventoryItems', 'receipt-race-item-b')).data.quantity;
assert.equal(receiptRacePOAfter.items.reduce((sum, item) => sum + item.receivedQuantity, 0), 1);
assert.equal(receiptRaceItemAAfter + receiptRaceItemBAfter, receiptRaceOriginalItemA + receiptRaceOriginalItemB + 1);
assert.equal(receiptRaceFirestore.collection('goodsReceipts').size, 1);
assert.equal(receiptRaceFirestore.collection('inventoryMovements').size, 1);
assert.equal(receiptRaceFirestore.collection('procurementEvents').size, 4,
  'Create, transitions and the single winning receipt must each leave one audit event.');

// Two different POs can still contend for one canonical Inventory item. The
// inventory updateTime precondition must prevent the losing receipt overwriting stock.
const sharedItemFirestore = new FakeFirestore({
  suppliers: { [receiptRaceSupplier.id]: receiptRaceSupplier },
  inventoryItems: {
    'shared-stock-item': {
      id: 'shared-stock-item', name: 'Shared XLR Cable', category: 'cable',
      type: 'consumable', quantity: 10, unit: 'pcs', minStock: 0,
      condition: 'good', status: 'active', location: 'Store Room',
      note: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-05T00:00:00.000Z',
    },
  },
});
async function createOrderedSharedItemPO(suffix) {
  let result = await createPurchaseOrder({
    actor,
    body: {
      supplierId: receiptRaceSupplier.id,
      orderDate: '2026-11-05',
      expectedAt: '2026-11-09',
      notes: 'Shared stock contention ' + suffix,
      items: [{ inventoryItemId: 'shared-stock-item', quantity: 2, unitPrice: 5000 }],
    },
    firestore: sharedItemFirestore,
    request: requestWithKey('procurement-shared-item-po-' + suffix),
  });
  let order = result.purchaseOrder;
  for (const [status, key] of [
    ['submitted', 'submit'],
    ['approved', 'approve'],
    ['ordered', 'order'],
  ]) {
    order = (await transitionPurchaseOrder({
      actor,
      body: { purchaseOrderId: order.id, status, expectedUpdatedAt: order.updatedAt },
      firestore: sharedItemFirestore,
      request: requestWithKey('procurement-shared-item-' + suffix + '-' + key),
    })).purchaseOrder;
  }
  return order;
}
const sharedPOA = await createOrderedSharedItemPO('a');
const sharedPOB = await createOrderedSharedItemPO('b');
const sharedItemInitial = await sharedItemFirestore.getDocument('inventoryItems', 'shared-stock-item');
const sharedStockBefore = sharedItemInitial.data.quantity;
const sharedItemRevision = sharedItemInitial.updateTime;
const originalSharedCommit = sharedItemFirestore.commit.bind(sharedItemFirestore);
let sharedItemCommitArrivals = 0;
let releaseSharedItemCommits;
const sharedItemBarrier = new Promise((resolve) => { releaseSharedItemCommits = resolve; });
sharedItemFirestore.commit = async (writes) => {
  if (writes.some((write) =>
    write.collectionId === 'inventoryItems' && write.id === 'shared-stock-item')) {
    sharedItemCommitArrivals += 1;
    if (sharedItemCommitArrivals === 2) releaseSharedItemCommits();
    await sharedItemBarrier;
  }
  return originalSharedCommit(writes);
};
const sharedStockRaceResults = await Promise.allSettled(
  [sharedPOA, sharedPOB].map((order, index) => receivePurchaseOrder({
    actor,
    body: {
      purchaseOrderId: order.id,
      expectedUpdatedAt: order.updatedAt,
      items: [{ lineId: order.items[0].lineId, quantity: 1 }],
      note: 'Concurrent shared stock receipt',
    },
    firestore: sharedItemFirestore,
    request: requestWithKey('procurement-shared-stock-receipt-' + index),
  })),
);
assert.equal(sharedItemCommitArrivals, 2);
assert.equal(sharedStockRaceResults.filter((result) => result.status === 'fulfilled').length, 1,
  'Only one PO receipt may update a shared inventory item revision.');
const sharedItemAfter = await sharedItemFirestore.getDocument('inventoryItems', 'shared-stock-item');
assert.equal(sharedItemAfter.data.quantity, sharedStockBefore + 1);
assert.equal(sharedPOA.items[0].receivedQuantity + sharedPOB.items[0].receivedQuantity, 0,
  'The in-memory PO snapshots remain unchanged; canonical revisions are asserted below.');
const sharedPOAAfter = (await sharedItemFirestore.getDocument('purchaseOrders', sharedPOA.id)).data;
const sharedPOBAfter = (await sharedItemFirestore.getDocument('purchaseOrders', sharedPOB.id)).data;
assert.equal(sharedPOAAfter.items[0].receivedQuantity + sharedPOBAfter.items[0].receivedQuantity, 1);
assert.equal(sharedItemAfter.updateTime === sharedItemRevision, false);
assert.equal(sharedItemFirestore.collection('goodsReceipts').size, 1);
assert.equal(sharedItemFirestore.collection('inventoryMovements').size, 1);

console.log('procurement-worker-regression-test: PASS');
