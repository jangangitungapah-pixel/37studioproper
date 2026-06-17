import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

const INVENTORY_COLLECTION = 'inventoryItems';

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

export function subscribeInventoryItems(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const inventoryRef = collection(firestoreDb, INVENTORY_COLLECTION);
  const q = query(inventoryRef, orderBy('updatedAt', 'desc'));

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

      callback(items);
    },
    (error) => {
      console.error('Error fetching inventory items from Firestore:', error);
      if (onError) onError(error);
    }
  );
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
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
};
