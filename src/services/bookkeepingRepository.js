import {
  collection,
  limit,
  onSnapshot,
  where,
  orderBy,
  query,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { financeRepository } from './firestoreFinanceRepository.js';

const BOOKKEEPING_COLLECTION = 'bookkeepingEntries';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

export function normalizeBookkeepingEntry(entry, fallbackId = '') {
  const source = entry && typeof entry === 'object' ? entry : {};
  const id = cleanText(source.id, fallbackId);
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
    sourceWorkOrderId: cleanText(source.sourceWorkOrderId),
    actorName: cleanText(source.actorName),
    actorUid: cleanText(source.actorUid),
    idempotencyKey: cleanText(source.idempotencyKey),
    operationId: cleanText(source.operationId),
    sourceProofId: cleanText(source.sourceProofId),
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

export async function createBookkeepingEntry(entry, operationRequestId = '') {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
  const saved = await financeRepository.createManualBookkeepingEntry(entry, operationRequestId);
  return normalizeBookkeepingEntry(saved, saved.id);
}

export async function updateBookkeepingEntry(entry, operationRequestId = '') {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
  if (!entry?.id) throw new Error('Bookkeeping entry ID tidak boleh kosong.');
  if (entry.immutable === true || (entry.source && entry.source !== 'manual')) {
    throw new Error('Transaksi hasil rekonsiliasi bersifat read-only. Gunakan reversal untuk koreksi.');
  }
  const saved = await financeRepository.updateManualBookkeepingEntry(entry, operationRequestId);
  return normalizeBookkeepingEntry(saved, saved.id);
}

export async function deleteBookkeepingEntry(entryId, operationRequestId = '') {
  if (!isFirebaseConfigured || !firestoreDb) throw new Error('Firebase belum dikonfigurasi.');
  if (!entryId) throw new Error('Bookkeeping entry ID tidak boleh kosong.');
  await financeRepository.deleteManualBookkeepingEntry(entryId, operationRequestId);
}

export const bookkeepingRepository = {
  subscribeBookkeepingEntries,
  createBookkeepingEntry,
  updateBookkeepingEntry,
  deleteBookkeepingEntry,
};
