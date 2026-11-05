import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  where,
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
    sourceAttendanceId: cleanText(source.sourceAttendanceId),
    sourceAttendanceDate: cleanText(source.sourceAttendanceDate),
    sourceGuardPersonId: cleanText(source.sourceGuardPersonId),
    sourceBookingId: cleanText(source.sourceBookingId),
    sourceEventId: cleanText(source.sourceEventId),
    sourceAction: cleanText(source.sourceAction),
    sourceFeeEntryId: cleanText(source.sourceFeeEntryId),
    actorName: cleanText(source.actorName),
    actorUid: cleanText(source.actorUid),
    idempotencyKey: cleanText(source.idempotencyKey),
    immutable: source.immutable === true,
    reversalOf: cleanText(source.reversalOf),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
  };
}

export function subscribeBookkeepingEntries(options, callback, onError) {
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

  const entriesRef = collection(firestoreDb, BOOKKEEPING_COLLECTION);
  const constraints = [];

  if (opts.startDate) {
    constraints.push(where('date', '>=', opts.startDate));
  }
  if (opts.endDate) {
    constraints.push(where('date', '<=', opts.endDate));
  }

  constraints.push(orderBy('date', 'desc'));

  if (opts.limitCount) {
    constraints.push(limit(opts.limitCount));
  }

  const q = query(entriesRef, ...constraints);

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

      cb(entries);
    },
    (error) => {
      console.error('Error fetching bookkeeping entries from Firestore:', error);
      if (errCb) errCb(error);
    }
  );
}

export const bookkeepingRepository = {
  subscribeBookkeepingEntries,
};
