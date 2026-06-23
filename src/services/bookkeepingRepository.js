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

const BOOKKEEPING_COLLECTION = 'bookkeepingEntries';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function makeEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'book_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 7);
}

export function normalizeBookkeepingEntry(entry, fallbackId = '') {
  const source = entry && typeof entry === 'object' ? entry : {};
  const id = cleanText(source.id, fallbackId || makeEntryId());
  const now = new Date().toISOString();

  return {
    id,
    type: cleanText(source.type, 'expense'),
    category: cleanText(source.category, 'other'),
    title: cleanText(source.title, 'Pengeluaran Studio'),
    amount: toNumber(source.amount),
    date: cleanText(source.date, now.slice(0, 10)),
    paymentMethod: cleanText(source.paymentMethod, 'cash'),
    note: cleanText(source.note),
    source: cleanText(source.source),
    sourceBookingId: cleanText(source.sourceBookingId),
    sourceFeeEntryId: cleanText(source.sourceFeeEntryId),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
  };
}

export function subscribeBookkeepingEntries(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const entriesRef = collection(firestoreDb, BOOKKEEPING_COLLECTION);
  const q = query(entriesRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = [];

      snapshot.forEach((entryDoc) => {
        entries.push(normalizeBookkeepingEntry(
          {
            id: entryDoc.id,
            ...entryDoc.data(),
          },
          entryDoc.id
        ));
      });

      callback(entries);
    },
    (error) => {
      console.error('Error fetching bookkeeping entries from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

export async function createBookkeepingEntry(entry) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const entryId = entry.id || doc(collection(firestoreDb, BOOKKEEPING_COLLECTION)).id;
  const docRef = doc(firestoreDb, BOOKKEEPING_COLLECTION, entryId);
  const now = new Date().toISOString();
  const cleanEntry = normalizeBookkeepingEntry(
    {
      ...entry,
      id: entryId,
      createdAt: entry.createdAt || now,
      updatedAt: now,
    },
    entryId
  );

  await setDoc(docRef, cleanEntry);
  return cleanEntry;
}

export async function updateBookkeepingEntry(entry) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!entry.id) {
    throw new Error('Bookkeeping entry ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, BOOKKEEPING_COLLECTION, entry.id);
  const cleanEntry = normalizeBookkeepingEntry(
    {
      ...entry,
      updatedAt: new Date().toISOString(),
    },
    entry.id
  );

  await setDoc(docRef, cleanEntry, { merge: true });
  return cleanEntry;
}

export async function deleteBookkeepingEntry(entryId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!entryId) {
    throw new Error('Bookkeeping entry ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, BOOKKEEPING_COLLECTION, entryId);
  await deleteDoc(docRef);
}

export const bookkeepingRepository = {
  subscribeBookkeepingEntries,
  createBookkeepingEntry,
  updateBookkeepingEntry,
  deleteBookkeepingEntry,
};
