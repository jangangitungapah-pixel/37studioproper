import {
  collection,
  doc,
  onSnapshot,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

const INVENTORY_COLLECTION = 'inventoryItems';
const INVENTORY_MOVEMENTS_COLLECTION = 'inventoryMovements';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function makeInventoryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 7);
}

function makeInventoryMovementId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'mov_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 7);
}

export function normalizeInventoryItem(item, fallbackId = '') {
  const source = item && typeof item === 'object' ? item : {};
  const id = cleanText(source.id, fallbackId || makeInventoryId());
  const now = new Date().toISOString();

  return {
    id,
    name: cleanText(source.name, 'Inventory Item'),
    category: cleanText(source.category, 'other'),
    type: cleanText(source.type, 'asset'),
    quantity: toNumber(source.quantity),
    unit: cleanText(source.unit, 'pcs'),
    minStock: toNumber(source.minStock),
    condition: cleanText(source.condition, 'good'),
    status: cleanText(source.status, 'active'),
    location: cleanText(source.location),
    note: cleanText(source.note),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
  };
}

export function normalizeInventoryMovement(movement, fallbackId = '') {
  const source = movement && typeof movement === 'object' ? movement : {};
  const id = cleanText(source.id, fallbackId || makeInventoryMovementId());
  const now = new Date().toISOString();

  return {
    id,
    itemId: cleanText(source.itemId),
    itemName: cleanText(source.itemName, 'Inventory Item'),
    type: cleanText(source.type, 'adjust'),
    quantity: toNumber(source.quantity),
    previousQuantity: toNumber(source.previousQuantity),
    nextQuantity: toNumber(source.nextQuantity),
    unit: cleanText(source.unit, 'pcs'),
    note: cleanText(source.note),
    reason: cleanText(source.reason || source.note),
    actorUid: cleanText(source.actorUid),
    actorName: cleanText(source.actorName),
    createdAt: source.createdAt || now,
  };
}

export function subscribeInventoryItems(options, callback, onError) {
  let opts = {};
  let cb = callback;
  let errCb = onError;

  if (typeof options === 'function') {
    errCb = callback;
    cb = options;
  } else if (options && typeof options === 'object') {
    opts = options;
  }

  if (!isFirebaseConfigured || !firestoreDb) {
    if (errCb) errCb(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const inventoryRef = collection(firestoreDb, INVENTORY_COLLECTION);
  const constraints = [];

  constraints.push(orderBy('updatedAt', 'desc'));

  if (opts.limitCount) {
    constraints.push(limit(opts.limitCount));
  }

  const q = query(inventoryRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((itemDoc) => {
        items.push(normalizeInventoryItem(
          {
            id: itemDoc.id,
            ...itemDoc.data(),
          },
          itemDoc.id
        ));
      });

      cb(items);
    },
    (error) => {
      console.error('Error fetching inventory items from Firestore:', error);
      if (errCb) errCb(error);
    }
  );
}

export function subscribeInventoryMovements(callback, onError, maxResults = 8) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const movementsRef = collection(firestoreDb, INVENTORY_MOVEMENTS_COLLECTION);
  const q = query(movementsRef, orderBy('createdAt', 'desc'), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const movements = [];
      snapshot.forEach((movementDoc) => {
        movements.push(normalizeInventoryMovement(
          {
            id: movementDoc.id,
            ...movementDoc.data(),
          },
          movementDoc.id
        ));
      });

      callback(movements);
    },
    (error) => {
      console.error('Error fetching inventory movements from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

export const inventoryRepository = {
  subscribeInventoryItems,
  subscribeInventoryMovements,
};

export function subscribeSuppliers(callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }
  const suppliersRef = collection(firestoreDb, 'suppliers');
  const q = query(suppliersRef, orderBy('name', 'asc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const rows = [];
    snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
    callback(rows);
  }, onError);
}

export function subscribePurchaseOrders(callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }
  const ordersRef = collection(firestoreDb, 'purchaseOrders');
  const q = query(ordersRef, orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    const rows = [];
    snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
    callback(rows);
  }, onError);
}

export function subscribeGoodsReceipts(callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }
  const receiptsRef = collection(firestoreDb, 'goodsReceipts');
  const q = query(receiptsRef, orderBy('receivedAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const rows = [];
    snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
    callback(rows);
  }, onError);
}

export function subscribeProcurementPayments(callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }
  const paymentsRef = collection(firestoreDb, 'procurementPayments');
  const q = query(paymentsRef, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const rows = [];
    snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
    callback(rows);
  }, onError);
}
