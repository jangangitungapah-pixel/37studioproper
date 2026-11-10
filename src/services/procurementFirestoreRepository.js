import { doc, getDocFromServer } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  buildRepositoryPrincipal,
  createRepositoryOperationId,
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
        title: 'Pembayaran ' + payment.poNumber + ' · ' + payment.supplierName,
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
  recordProcurementPayment: recordCanonicalProcurementPayment,
});
