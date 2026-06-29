import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

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

export async function createInventoryMovement(movement) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const movementId = movement.id || doc(collection(firestoreDb, INVENTORY_MOVEMENTS_COLLECTION)).id;
  const docRef = doc(firestoreDb, INVENTORY_MOVEMENTS_COLLECTION, movementId);
  const cleanMovement = normalizeInventoryMovement(
    {
      ...movement,
      id: movementId,
      createdAt: movement.createdAt || new Date().toISOString(),
    },
    movementId
  );

  await setDoc(docRef, cleanMovement);
  return cleanMovement;
}

export async function createInventoryItem(item) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const itemId = item.id || doc(collection(firestoreDb, INVENTORY_COLLECTION)).id;
  const docRef = doc(firestoreDb, INVENTORY_COLLECTION, itemId);
  const now = new Date().toISOString();
  const cleanItem = normalizeInventoryItem(
    {
      ...item,
      id: itemId,
      createdAt: item.createdAt || now,
      updatedAt: now,
    },
    itemId
  );

  await setDoc(docRef, cleanItem);
  return cleanItem;
}

export async function updateInventoryItem(item) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!item.id) {
    throw new Error('Inventory item ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, INVENTORY_COLLECTION, item.id);
  const cleanItem = normalizeInventoryItem(
    {
      ...item,
      updatedAt: new Date().toISOString(),
    },
    item.id
  );

  await setDoc(docRef, cleanItem, { merge: true });
  return cleanItem;
}

export async function deleteInventoryItem(itemId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!itemId) {
    throw new Error('Inventory item ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, INVENTORY_COLLECTION, itemId);
  await deleteDoc(docRef);
}

export const inventoryRepository = {
  subscribeInventoryItems,
  subscribeInventoryMovements,
  createInventoryItem,
  updateInventoryItem,
  createInventoryMovement,
  deleteInventoryItem,
};
