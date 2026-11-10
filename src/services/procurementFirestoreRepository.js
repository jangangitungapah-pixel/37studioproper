import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
  createRepositoryPayloadHash,
  createRepositoryRequestId,
  runIdempotentFirestoreTransaction,
} from '../lib/firestoreRepositoryFoundation.js';

const SCOPE = 'procurement';
const SUPPLIERS = 'suppliers';
const PURCHASE_ORDERS = 'purchaseOrders';
const EVENTS = 'procurementEvents';
const PURCHASE_ORDER_STATUSES = Object.freeze([
  'draft', 'submitted', 'approved', 'ordered',
  'partially_received', 'received', 'cancelled',
]);

function assertFirebase() {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
}

function cleanText(value, label, maxLength, required = false) {
  const result = String(value ?? '').trim();
  if (result.length > maxLength || (required && !result)) {
    throw new Error(label + (required ? ' wajib diisi.' : ' melebihi batas karakter.'));
  }
  return result;
}

function finiteQuantity(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(label + ' tidak valid.');
  return Math.round(parsed * 1000) / 1000;
}

function procurementAmount(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) {
    throw new Error(label + ' tidak valid.');
  }
  const rounded = Math.round(amount);
  if (!Number.isSafeInteger(rounded)) throw new Error(label + ' melebihi batas angka yang aman.');
  return rounded;
}

function procurementDate(value, label, { optional = false } = {}) {
  const date = String(value ?? '').trim();
  if (!date && optional) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(label + ' harus menggunakan format YYYY-MM-DD.');
  }
  const parsed = new Date(date + 'T00:00:00.000Z');
  const year = Number(date.slice(0, 4));
  if (
    year < 2000 || year > 2100 || Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(label + ' bukan tanggal kalender yang valid.');
  }
  return date;
}

async function requirePrincipal(permission = 'inventory') {
  assertFirebase();
  const user = firebaseAuth?.currentUser;
  if (!user?.uid) throw new Error('Sesi login diperlukan.');
  const [profileSnapshot, ownershipSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, 'users', user.uid)),
    getDocFromServer(doc(firestoreDb, 'adminControl', 'ownership')),
  ]);
  const profile = profileSnapshot.exists()
    ? { ...profileSnapshot.data(), uid: profileSnapshot.id }
    : null;
  const principal = buildRepositoryPrincipal({
    authUid: user.uid,
    userProfile: profile,
    ownershipControl: ownershipSnapshot.exists() ? ownershipSnapshot.data() : null,
  });
  if (!principal.active || !principal.hasPermission(permission)) {
    throw new Error('Akun tidak memiliki izin ' + permission + '.');
  }
  return {
    uid: user.uid,
    displayName: cleanText(profile?.displayName || user.displayName || user.email || 'Admin', 'Nama actor', 120, true),
    role: principal.role,
  };
}

async function normalizeRequestId(value) {
  const candidate = String(value || '').trim();
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(candidate)) return candidate;
  if (candidate) throw new Error('Request ID operasi tidak valid.');
  return createRepositoryRequestId();
}

async function hydrateDocument(operation, collectionName) {
  const snapshot = await getDocFromServer(doc(firestoreDb, collectionName, operation.result.id));
  if (!snapshot.exists()) throw new Error('Dokumen ' + collectionName + ' hasil operasi tidak ditemukan.');
  return { id: snapshot.id, ...snapshot.data() };
}

async function hydrateSupplier(operation) {
  const supplier = await hydrateDocument(operation, SUPPLIERS);
  const eventSnapshot = supplier.lastEventId
    ? await getDocFromServer(doc(firestoreDb, EVENTS, supplier.lastEventId))
    : null;
  return {
    supplier,
    event: eventSnapshot?.exists() ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null,
    duplicate: operation.replayed,
  };
}

async function hydratePurchaseOrder(operation) {
  const purchaseOrder = await hydrateDocument(operation, PURCHASE_ORDERS);
  const eventSnapshot = purchaseOrder.lastEventId
    ? await getDocFromServer(doc(firestoreDb, EVENTS, purchaseOrder.lastEventId))
    : null;
  return {
    purchaseOrder,
    event: eventSnapshot?.exists() ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null,
    duplicate: operation.replayed,
  };
}

async function hydrateProcurementPayment(operation, paymentId, eventId) {
  const [purchaseOrder, paymentSnapshot, expenseSnapshot, eventSnapshot] = await Promise.all([
    hydrateDocument(operation, PURCHASE_ORDERS),
    getDocFromServer(doc(firestoreDb, 'procurementPayments', paymentId)),
    getDocFromServer(doc(firestoreDb, 'bookkeepingEntries', paymentId)),
    getDocFromServer(doc(firestoreDb, EVENTS, eventId)),
  ]);
  if (!paymentSnapshot.exists() || !expenseSnapshot.exists() || !eventSnapshot.exists()) {
    throw new Error('Dokumen pembayaran Procurement belum lengkap. Gunakan request yang sama untuk memulihkan operasi.');
  }
  return {
    purchaseOrder,
    payment: { id: paymentSnapshot.id, ...paymentSnapshot.data() },
    expense: { id: expenseSnapshot.id, ...expenseSnapshot.data() },
    event: { id: eventSnapshot.id, ...eventSnapshot.data() },
    duplicate: operation.replayed,
  };
}

export async function createCanonicalSupplier(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const name = cleanText(body.name, 'Nama supplier', 160, true);
  if (name.length < 2) throw new Error('Nama supplier minimal 2 karakter.');
  const email = cleanText(body.email, 'Email', 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Format email supplier belum valid.');
  }
  const payload = {
    name,
    contactName: cleanText(body.contactName, 'Nama kontak', 120),
    phone: cleanText(body.phone, 'Nomor telepon', 40),
    email,
    address: cleanText(body.address, 'Alamat', 500),
    notes: cleanText(body.notes, 'Catatan', 1000),
  };
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'supplier-create';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: SCOPE, action, requestId,
  });
  const supplierId = 'sup_' + operationId.slice(3);
  const eventId = 'pev_' + operationId.slice(3);
  const timestamp = new Date().toISOString();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: SCOPE, action, requestId, payload,
    execute: async (transaction, metadata) => {
      const supplierRef = doc(firestoreDb, SUPPLIERS, supplierId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const [supplierSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(supplierRef), transaction.get(eventRef),
      ]);
      if (supplierSnapshot.exists() || eventSnapshot.exists()) {
        throw new Error('ID supplier atau event sudah digunakan.');
      }
      const supplier = {
        id: supplierId,
        ...payload,
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdByUid: actor.uid,
        createdByName: actor.displayName,
        lastOperationId: metadata.operationId,
        lastOperationAction: 'create',
        lastEventId: eventId,
      };
      const event = {
        id: eventId,
        entityType: 'supplier',
        entityId: supplierId,
        action: 'created',
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        operationId: metadata.operationId,
      };
      transaction.set(supplierRef, supplier);
      transaction.set(eventRef, event);
      return { collection: SUPPLIERS, id: supplierId };
    },
  });
  return hydrateSupplier(operation);
}

export async function createCanonicalPurchaseOrder(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const supplierId = cleanText(body.supplierId, 'Supplier', 160, true);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new Error('Purchase order harus memiliki 1 sampai 100 item.');
  }
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'purchase-order-create';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: SCOPE, action, requestId,
  });
  const purchaseOrderId = 'po_' + operationId.slice(3);
  const eventId = 'pev_' + operationId.slice(3);
  const timestamp = new Date().toISOString();
  const orderDate = procurementDate(body.orderDate || timestamp.slice(0, 10), 'Tanggal PO');
  const expectedAt = procurementDate(body.expectedAt, 'Estimasi barang datang', { optional: true });
  if (expectedAt && expectedAt < orderDate) {
    throw new Error('Estimasi barang datang tidak boleh sebelum tanggal PO.');
  }
  const notes = cleanText(body.notes, 'Catatan PO', 1200);
  const seenInventoryIds = new Set();
  const requestedLines = body.items.map((line, index) => {
    const inventoryItemId = cleanText(line?.inventoryItemId, 'Item inventory', 160, true);
    const quantity = finiteQuantity(line?.quantity, 'Jumlah pesanan');
    const unitPrice = procurementAmount(line?.unitPrice, 'Harga satuan');
    if (quantity <= 0) throw new Error('Jumlah pesanan harus lebih dari nol.');
    if (seenInventoryIds.has(inventoryItemId)) {
      throw new Error('Setiap item inventory hanya boleh muncul satu kali dalam PO.');
    }
    seenInventoryIds.add(inventoryItemId);
    return {
      lineId: 'line_' + operationId.slice(3, 15) + '_' + String(index + 1).padStart(3, '0'),
      inventoryItemId, quantity, unitPrice,
    };
  });
  const payload = { supplierId, orderDate, expectedAt, notes, items: requestedLines };

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: SCOPE, action, requestId, payload,
    execute: async (transaction, metadata) => {
      const supplierRef = doc(firestoreDb, SUPPLIERS, supplierId);
      const poRef = doc(firestoreDb, PURCHASE_ORDERS, purchaseOrderId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const inventoryRefs = requestedLines.map((line) => ({
        line,
        reference: doc(firestoreDb, 'inventoryItems', line.inventoryItemId),
      }));
      const [supplierSnapshot, poSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(supplierRef),
        transaction.get(poRef),
        transaction.get(eventRef),
      ]);
      const inventorySnapshots = await Promise.all(
        inventoryRefs.map(({ reference }) => transaction.get(reference)),
      );
      if (!supplierSnapshot.exists() || supplierSnapshot.data().status !== 'active') {
        throw new Error('Supplier aktif tidak ditemukan.');
      }
      if (poSnapshot.exists() || eventSnapshot.exists()) {
        throw new Error('ID purchase order atau event sudah digunakan.');
      }
      const items = inventorySnapshots.map((snapshot, index) => {
        const line = requestedLines[index];
        if (!snapshot.exists() || snapshot.data().status === 'inactive') {
          throw new Error('Item inventory tidak ditemukan atau sudah dinonaktifkan: ' + line.inventoryItemId);
        }
        const inventoryItem = snapshot.data();
        const lineTotal = Math.round(line.quantity * line.unitPrice);
        if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0) {
          throw new Error('Total harga baris PO tidak valid.');
        }
        return {
          lineId: line.lineId,
          inventoryItemId: line.inventoryItemId,
          name: cleanText(inventoryItem.name, 'Nama item', 160, true),
          category: cleanText(inventoryItem.category, 'Kategori item', 80),
          quantity: line.quantity,
          receivedQuantity: 0,
          unit: cleanText(inventoryItem.unit, 'Satuan', 40) || 'pcs',
          unitPrice: line.unitPrice,
          lineTotal,
        };
      });
      const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
      if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 1_000_000_000_000) {
        throw new Error('Total purchase order di luar batas operasional.');
      }
      const supplier = supplierSnapshot.data();
      const purchaseOrder = {
        id: purchaseOrderId,
        poNumber: 'PO-' + orderDate.replaceAll('-', '') + '-' + purchaseOrderId.slice(-8).toUpperCase(),
        supplierId,
        supplierName: cleanText(supplier.name, 'Nama supplier', 160, true),
        items,
        totalAmount,
        paidAmount: 0,
        status: 'draft',
        orderDate,
        expectedAt,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdByUid: actor.uid,
        createdByName: actor.displayName,
        lastOperationId: metadata.operationId,
        lastOperationAction: 'create',
        lastEventId: eventId,
      };
      const event = {
        id: eventId,
        entityType: 'purchase_order',
        entityId: purchaseOrderId,
        action: 'created',
        fromStatus: '',
        toStatus: 'draft',
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        amount: totalAmount,
        operationId: metadata.operationId,
      };
      transaction.set(poRef, purchaseOrder);
      transaction.set(eventRef, event);
      return { collection: PURCHASE_ORDERS, id: purchaseOrderId };
    },
  });
  return hydratePurchaseOrder(operation);
}

export async function transitionCanonicalPurchaseOrder(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal();
  const body = input && typeof input === 'object' ? input : {};
  const purchaseOrderId = cleanText(body.purchaseOrderId, 'Purchase Order', 160, true);
  const expectedUpdatedAt = cleanText(body.expectedUpdatedAt, 'Waktu pembaruan PO', 40, true);
  const status = cleanText(body.status, 'Status PO', 40, true);
  const reason = cleanText(body.reason, 'Alasan perubahan', 600);
  const transitions = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'cancelled'],
    approved: ['ordered', 'cancelled'],
    ordered: [],
    partially_received: [],
    received: [],
    cancelled: [],
  };
  if (!PURCHASE_ORDER_STATUSES.includes(status)) throw new Error('Status PO tidak valid.');
  if ((status === 'approved' || status === 'cancelled') && !['owner', 'admin'].includes(actor.role)) {
    throw new Error('Approval atau pembatalan PO memerlukan Admin atau Owner.');
  }
  if (status === 'cancelled' && reason.length < 4) {
    throw new Error('Alasan pembatalan minimal 4 karakter.');
  }
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'purchase-order-transition';
  const payload = { purchaseOrderId, expectedUpdatedAt, status, reason };
  const timestampForOperation = new Date().toISOString();

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb, actorUid: actor.uid, scope: SCOPE, action, requestId, payload,
    execute: async (transaction, metadata) => {
      const poRef = doc(firestoreDb, PURCHASE_ORDERS, purchaseOrderId);
      const eventId = 'pev_' + metadata.operationId.slice(3);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const [poSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(poRef), transaction.get(eventRef),
      ]);
      if (!poSnapshot.exists()) throw new Error('Purchase Order tidak ditemukan.');
      if (eventSnapshot.exists()) throw new Error('ID event Purchase Order sudah digunakan.');
      const current = { id: poSnapshot.id, ...poSnapshot.data() };
      if (current.updatedAt !== expectedUpdatedAt) throw new Error('PO berubah. Muat ulang sebelum menyimpan.');
      if (!transitions[current.status]?.includes(status)) {
        throw new Error('Transisi status PO tidak diizinkan dari ' + current.status + ' ke ' + status + '.');
      }
      if (status === 'cancelled') {
        if (Number(current.paidAmount || 0) > 0) {
          throw new Error('PO yang sudah memiliki pembayaran tidak dapat dibatalkan dari alur ini.');
        }
        if ((current.items || []).some((item) => Number(item.receivedQuantity || 0) > 0)) {
          throw new Error('PO yang sudah menerima barang tidak dapat dibatalkan.');
        }
      }
      const next = {
        ...current,
        status,
        updatedAt: timestampForOperation,
        lastOperationId: metadata.operationId,
        lastOperationAction: 'transition',
        lastEventId: eventId,
        ...(status === 'approved'
          ? { approvedAt: timestampForOperation, approvedByUid: actor.uid, approvedByName: actor.displayName }
          : {}),
        ...(status === 'ordered' ? { orderedAt: timestampForOperation } : {}),
        ...(status === 'cancelled'
          ? { cancelledAt: timestampForOperation, cancelReason: reason, cancelledByUid: actor.uid }
          : {}),
      };
      const event = {
        id: eventId,
        entityType: 'purchase_order',
        entityId: purchaseOrderId,
        action: 'status_changed',
        fromStatus: current.status,
        toStatus: status,
        reason,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestampForOperation,
        operationId: metadata.operationId,
      };
      transaction.set(poRef, next);
      transaction.set(eventRef, event);
      return { collection: PURCHASE_ORDERS, id: purchaseOrderId };
    },
  });
  return hydratePurchaseOrder(operation);
}


export async function receiveCanonicalPurchaseOrder(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('inventory');
  const body = input && typeof input === 'object' ? input : {};
  const purchaseOrderId = cleanText(body.purchaseOrderId, 'Purchase Order', 160, true);
  const expectedUpdatedAt = cleanText(body.expectedUpdatedAt, 'Waktu pembaruan PO', 40, true);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5) {
    throw new Error('Penerimaan harus berisi 1 sampai 5 baris agar transaksi tetap berada dalam batas evaluasi Firestore Rules.');
  }
  const seenLineIds = new Set();
  const requestedLines = body.items.map((line) => {
    const lineId = cleanText(line?.lineId, 'Baris PO', 160, true);
    const quantity = finiteQuantity(line?.quantity, 'Jumlah diterima');
    if (seenLineIds.has(lineId)) throw new Error('Baris penerimaan tidak boleh duplikat.');
    if (quantity <= 0) throw new Error('Jumlah diterima harus lebih dari nol.');
    seenLineIds.add(lineId);
    return { lineId, quantity };
  });
  const note = cleanText(body.note, 'Catatan penerimaan', 800);
  const payload = { purchaseOrderId, expectedUpdatedAt, items: requestedLines, note };
  const requestId = await normalizeRequestId(idempotencyKey);
  const payloadHash = await createRepositoryPayloadHash(payload);
  const action = 'goods-receipt-create';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid, scope: SCOPE, action, requestId,
  });
  const receiptId = 'gr_' + operationId.slice(3);
  const eventId = 'pev_' + operationId.slice(3);
  const timestamp = new Date().toISOString();

  const operation = await runTransaction(firestoreDb, async (transaction) => {
      const poRef = doc(firestoreDb, PURCHASE_ORDERS, purchaseOrderId);
      const receiptRef = doc(firestoreDb, 'goodsReceipts', receiptId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const receiptSnapshot = await transaction.get(receiptRef);
      if (receiptSnapshot.exists()) {
        const existingReceipt = receiptSnapshot.data();
        if (
          existingReceipt.operationId !== operationId ||
          existingReceipt.payloadHash !== payloadHash ||
          existingReceipt.receivedByUid !== actor.uid
        ) {
          throw new Error('Request ID penerimaan sudah digunakan dengan payload yang berbeda.');
        }
        return { replayed: true };
      }
      const [poSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(poRef),
        transaction.get(eventRef),
      ]);
      if (!poSnapshot.exists()) throw new Error('Purchase Order tidak ditemukan.');
      if (eventSnapshot.exists()) {
        throw new Error('ID event Goods Receipt sudah digunakan.');
      }
      const current = { id: poSnapshot.id, ...poSnapshot.data() };
      if (!['ordered', 'partially_received'].includes(current.status)) {
        throw new Error('PO harus berstatus Ordered atau Partially Received.');
      }
      if (current.updatedAt !== expectedUpdatedAt) {
        throw new Error('PO berubah. Muat ulang sebelum mencatat penerimaan.');
      }
      if (!Array.isArray(current.items) || !current.items.length) {
        throw new Error('PO tidak memiliki detail item yang valid.');
      }

      const lineIndexes = requestedLines.map((line) => {
        const index = current.items.findIndex((item) => item.lineId === line.lineId);
        if (index < 0) throw new Error('Baris penerimaan tidak sesuai dengan PO.');
        return index;
      });
      const inventoryIds = requestedLines.map((line, index) => (
        cleanText(current.items[lineIndexes[index]].inventoryItemId, 'Item inventory', 160, true)
      ));
      if (new Set(inventoryIds).size !== inventoryIds.length) {
        throw new Error('Satu item inventory tidak boleh muncul lebih dari sekali dalam satu penerimaan.');
      }
      const inventoryRefs = inventoryIds.map((id) => doc(firestoreDb, 'inventoryItems', id));
      const movementIds = requestedLines.map((_, index) => (
        'mov_' + operationId.slice(3) + '_' + String(index + 1).padStart(3, '0')
      ));
      const movementRefs = movementIds.map((id) => doc(firestoreDb, 'inventoryMovements', id));
      const inventorySnapshots = await Promise.all(inventoryRefs.map((reference) => transaction.get(reference)));
      const movementSnapshots = await Promise.all(movementRefs.map((reference) => transaction.get(reference)));
      if (movementSnapshots.some((snapshot) => snapshot.exists())) {
        throw new Error('ID stock movement sudah digunakan.');
      }

      const nextItems = current.items.map((item) => ({ ...item }));
      const receiptItems = [];
      const movements = [];
      const nextInventoryItems = [];
      requestedLines.forEach((line, index) => {
        const orderLine = nextItems[lineIndexes[index]];
        const orderedQuantity = finiteQuantity(orderLine.quantity, 'Jumlah pesanan');
        const previouslyReceived = finiteQuantity(orderLine.receivedQuantity || 0, 'Jumlah yang sudah diterima');
        const remaining = Math.max(0, orderedQuantity - previouslyReceived);
        if (line.quantity > remaining) {
          throw new Error('Jumlah diterima melebihi sisa pesanan untuk ' + cleanText(orderLine.name, 'Nama item', 160) + '.');
        }
        const inventorySnapshot = inventorySnapshots[index];
        if (!inventorySnapshot.exists() || inventorySnapshot.data().status === 'inactive') {
          throw new Error('Item inventory tidak ditemukan atau sudah dinonaktifkan: ' + inventoryIds[index]);
        }
        const inventoryItem = { id: inventorySnapshot.id, ...inventorySnapshot.data() };
        const previousQuantity = finiteQuantity(inventoryItem.quantity || 0, 'Stok saat ini');
        const nextQuantity = finiteQuantity(previousQuantity + line.quantity, 'Stok hasil');
        if (nextQuantity > 1_000_000) throw new Error('Stok hasil melebihi batas operasional.');
        const movement = {
          id: movementIds[index],
          itemId: inventoryItem.id,
          itemName: cleanText(inventoryItem.name, 'Nama item', 160, true),
          type: 'goods-receipt',
          quantity: line.quantity,
          previousQuantity,
          nextQuantity,
          unit: cleanText(inventoryItem.unit || orderLine.unit || 'pcs', 'Satuan', 40, true),
          note: 'Penerimaan ' + cleanText(current.poNumber, 'Nomor PO', 64, true),
          reason: note,
          actorUid: actor.uid,
          actorName: actor.displayName,
          createdAt: timestamp,
          operationId: operationId,
          operationAction: 'receive',
          sourcePurchaseOrderId: purchaseOrderId,
          sourceGoodsReceiptId: receiptId,
          sourceLineId: line.lineId,
        };
        const nextInventoryItem = {
          ...inventoryItem,
          quantity: nextQuantity,
          updatedAt: timestamp,
          lastOperationId: operationId,
          lastOperationAction: 'receive',
          lastMovementId: movement.id,
          lastMovementSnapshot: movement,
        };
        orderLine.receivedQuantity = finiteQuantity(previouslyReceived + line.quantity, 'Total diterima');
        receiptItems.push({
          lineId: line.lineId,
          inventoryItemId: inventoryItem.id,
          itemName: cleanText(orderLine.name, 'Nama item PO', 160, true),
          quantity: line.quantity,
          movementId: movement.id,
        });
        movements.push(movement);
        nextInventoryItems.push(nextInventoryItem);
      });

      const allReceived = nextItems.every((item) => (
        finiteQuantity(item.receivedQuantity || 0, 'Jumlah diterima') >=
        finiteQuantity(item.quantity, 'Jumlah pesanan')
      ));
      const status = allReceived ? 'received' : 'partially_received';
      const nextPurchaseOrder = {
        ...current,
        items: nextItems,
        status,
        updatedAt: timestamp,
        ...(allReceived ? { receivedAt: timestamp } : {}),
        lastOperationId: operationId,
        lastOperationAction: 'receipt',
        lastEventId: eventId,
        lastReceiptId: receiptId,
      };
      const receipt = {
        id: receiptId,
        purchaseOrderId,
        poNumber: cleanText(current.poNumber, 'Nomor PO', 64, true),
        supplierId: cleanText(current.supplierId, 'Supplier', 160, true),
        supplierName: cleanText(current.supplierName, 'Nama supplier', 160, true),
        items: receiptItems,
        note,
        receivedAt: timestamp,
        receivedByUid: actor.uid,
        receivedByName: actor.displayName,
        createdAt: timestamp,
        operationId: operationId,
        eventId,
        payloadHash,
      };
      const event = {
        id: eventId,
        entityType: 'goods_receipt',
        entityId: receiptId,
        purchaseOrderId,
        action: 'received',
        fromStatus: current.status,
        toStatus: status,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        items: receiptItems,
        operationId: operationId,
      };

      nextInventoryItems.forEach((item, index) => {
        transaction.set(inventoryRefs[index], item);
        transaction.set(movementRefs[index], movements[index]);
      });
      transaction.set(poRef, nextPurchaseOrder);
      transaction.set(receiptRef, receipt);
      transaction.set(eventRef, event);
      return { replayed: false };
    },
  );

  const operationReplayed = operation.replayed === true;
  const receipt = await hydrateDocument({ result: { id: receiptId } }, 'goodsReceipts');
  const [purchaseOrderSnapshot, eventSnapshot] = await Promise.all([
    getDocFromServer(doc(firestoreDb, PURCHASE_ORDERS, purchaseOrderId)),
    getDocFromServer(doc(firestoreDb, EVENTS, eventId)),
  ]);
  if (!purchaseOrderSnapshot.exists() || !eventSnapshot.exists()) {
    throw new Error('Dokumen PO atau event penerimaan belum lengkap. Gunakan request ID yang sama untuk memulihkan operasi.');
  }
  return {
    receipt,
    purchaseOrder: { id: purchaseOrderSnapshot.id, ...purchaseOrderSnapshot.data() },
    event: { id: eventSnapshot.id, ...eventSnapshot.data() },
    duplicate: operationReplayed,
  };
}

export async function recordCanonicalProcurementPayment(input = {}, idempotencyKey = '') {
  const actor = await requirePrincipal('bookkeeping');
  const body = input && typeof input === 'object' ? input : {};
  const purchaseOrderId = cleanText(body.purchaseOrderId, 'Purchase Order', 160, true);
  const expectedUpdatedAt = cleanText(body.expectedUpdatedAt, 'Waktu pembaruan PO', 40, true);
  const amount = procurementAmount(body.amount, 'Pembayaran');
  if (amount > 1_000_000_000) {
    throw new Error('Nominal per transaksi pembayaran tidak boleh melebihi Rp1.000.000.000.');
  }
  const paymentMethod = cleanText(body.paymentMethod || 'transfer', 'Metode pembayaran', 40).toLowerCase();
  if (!['cash', 'transfer', 'qris'].includes(paymentMethod)) {
    throw new Error('Metode pembayaran tidak didukung.');
  }
  const paymentDate = procurementDate(
    body.date || new Date().toISOString().slice(0, 10),
    'Tanggal pembayaran',
  );
  const reference = cleanText(body.reference, 'Referensi pembayaran', 120);
  const note = cleanText(body.note, 'Catatan pembayaran', 800);
  const requestId = await normalizeRequestId(idempotencyKey);
  const action = 'procurement-payment';
  const operationId = await createRepositoryOperationId({
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
  });
  const paymentId = 'ppay_' + operationId.slice(3);
  const eventId = 'pev_' + operationId.slice(3);
  const closingSessionId = paymentDate + '__main';
  const timestamp = new Date().toISOString();
  const payload = {
    purchaseOrderId,
    expectedUpdatedAt,
    amount,
    paymentMethod,
    date: paymentDate,
    reference,
    note,
  };

  const operation = await runIdempotentFirestoreTransaction({
    db: firestoreDb,
    actorUid: actor.uid,
    scope: SCOPE,
    action,
    requestId,
    payload,
    execute: async (transaction, metadata) => {
      const poRef = doc(firestoreDb, PURCHASE_ORDERS, purchaseOrderId);
      const paymentRef = doc(firestoreDb, 'procurementPayments', paymentId);
      const expenseRef = doc(firestoreDb, 'bookkeepingEntries', paymentId);
      const eventRef = doc(firestoreDb, EVENTS, eventId);
      const closingRef = doc(firestoreDb, 'cashClosingSessions', closingSessionId);
      const [poSnapshot, paymentSnapshot, expenseSnapshot, eventSnapshot, closingSnapshot] = await Promise.all([
        transaction.get(poRef),
        transaction.get(paymentRef),
        transaction.get(expenseRef),
        transaction.get(eventRef),
        transaction.get(closingRef),
      ]);

      if (!poSnapshot.exists()) throw new Error('Purchase Order tidak ditemukan.');
      if (paymentSnapshot.exists() || expenseSnapshot.exists() || eventSnapshot.exists()) {
        throw new Error('ID payment, ledger, atau event Procurement sudah digunakan.');
      }
      const current = { id: poSnapshot.id, ...poSnapshot.data() };
      if (current.status === 'draft' || current.status === 'cancelled') {
        throw new Error('PO belum siap menerima pembayaran.');
      }
      if (current.updatedAt !== expectedUpdatedAt) {
        throw new Error('PO berubah. Muat ulang sebelum mencatat pembayaran.');
      }
      const totalAmount = procurementAmount(current.totalAmount, 'Total PO');
      const paidAmount = current.paidAmount ? procurementAmount(current.paidAmount, 'Total terbayar') : 0;
      const remaining = Math.max(0, totalAmount - paidAmount);
      if (amount > remaining) {
        throw new Error('Pembayaran melebihi sisa kewajiban PO.');
      }

      const closing = closingSnapshot.exists() ? closingSnapshot.data() : null;
      if (closing?.status === 'closed') {
        throw new Error('Tanggal pembayaran sudah ditutup oleh Daily Closing. Reopen hanya dapat dilakukan Owner.');
      }
      if (closing && !['open', 'reopened', 'not_opened'].includes(closing.status)) {
        throw new Error('Status Daily Closing tidak valid untuk mencatat pembayaran.');
      }

      const closingSession = {
        ...(closing || {}),
        id: closingSessionId,
        businessDate: paymentDate,
        registerId: 'main',
        status: closing?.status === 'reopened' ? 'reopened' : 'open',
        activityRevision: Number(closing?.activityRevision || 0) + 1,
        createdAt: closing?.createdAt || timestamp,
        updatedAt: timestamp,
        lastActivityAt: timestamp,
        lastActivityByUid: actor.uid,
        lastOperationId: metadata.operationId,
        lastOperationAction: action,
        lastProcurementPaymentAt: timestamp,
        lastProcurementPaymentId: paymentId,
        lastProcurementPurchaseOrderId: purchaseOrderId,
      };
      const payment = {
        id: paymentId,
        purchaseOrderId,
        poNumber: cleanText(current.poNumber, 'Nomor PO', 64, true),
        supplierId: cleanText(current.supplierId, 'Supplier', 160, true),
        supplierName: cleanText(current.supplierName, 'Nama supplier', 160, true),
        amount,
        paymentMethod,
        date: paymentDate,
        reference,
        note,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        operationId: metadata.operationId,
      };
      const expense = {
        id: paymentId,
        type: 'expense',
        category: 'procurement',
        title: ('Pembayaran ' + payment.poNumber + ' · ' + payment.supplierName).slice(0, 160),
        amount,
        date: paymentDate,
        paymentMethod,
        note,
        source: 'procurement-payment',
        sourcePurchaseOrderId: purchaseOrderId,
        sourceProcurementPaymentId: paymentId,
        actorUid: actor.uid,
        actorName: actor.displayName,
        operationId: metadata.operationId,
        immutable: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const nextPurchaseOrder = {
        ...current,
        paidAmount: paidAmount + amount,
        updatedAt: timestamp,
        lastOperationId: metadata.operationId,
        lastOperationAction: 'payment',
        lastEventId: eventId,
        lastPaymentId: paymentId,
      };
      const event = {
        id: eventId,
        entityType: 'purchase_order',
        entityId: purchaseOrderId,
        action: 'payment_recorded',
        amount,
        paymentId,
        actorUid: actor.uid,
        actorName: actor.displayName,
        createdAt: timestamp,
        operationId: metadata.operationId,
      };

      transaction.set(poRef, nextPurchaseOrder);
      transaction.set(paymentRef, payment);
      transaction.set(expenseRef, expense);
      transaction.set(eventRef, event);
      transaction.set(closingRef, closingSession);
      return { collection: PURCHASE_ORDERS, id: purchaseOrderId };
    },
  });

  return hydrateProcurementPayment(operation, paymentId, eventId);
}

export const procurementFirestoreRepository = Object.freeze({
  createSupplier: createCanonicalSupplier,
  createPurchaseOrder: createCanonicalPurchaseOrder,
  transitionPurchaseOrder: transitionCanonicalPurchaseOrder,
  receivePurchaseOrder: receiveCanonicalPurchaseOrder,
  recordProcurementPayment: recordCanonicalProcurementPayment,
});
