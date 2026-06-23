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

export const OPERATOR_FEE_ENTRIES_COLLECTION = 'operatorFeeEntries';

export const OPERATOR_FEE_ENTRY_STATUSES = {
  DRAFT: 'draft',
  POSTED: 'posted',
  REVIEWED: 'reviewed',
  VOID: 'void',
};

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export function makeOperatorFeeEntryId({ bookingId = '', personId = '', ruleId = '' } = {}) {
  const cleanBookingId = cleanText(bookingId, 'booking').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPersonId = cleanText(personId, 'person').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRuleId = cleanText(ruleId, 'rule').replace(/[^a-zA-Z0-9_-]/g, '_');

  return [cleanBookingId, cleanPersonId, cleanRuleId].join('__');
}

export function normalizeOperatorFeeEntry(entry, fallbackId = '') {
  const source = entry && typeof entry === 'object' ? entry : {};
  const id = cleanText(source.id, fallbackId || makeOperatorFeeEntryId(source));
  const createdAt = cleanText(source.createdAt, nowIso());
  const status = Object.values(OPERATOR_FEE_ENTRY_STATUSES).includes(source.status)
    ? source.status
    : OPERATOR_FEE_ENTRY_STATUSES.DRAFT;

  return {
    id,
    amount: toNumber(source.amount),
    bookingCode: cleanText(source.bookingCode),
    bookingDate: cleanText(source.bookingDate),
    bookingId: cleanText(source.bookingId),
    calculationMode: cleanText(source.calculationMode, 'flat'),
    durationHours: toNumber(source.durationHours),
    mealAmount: toNumber(source.mealAmount),
    note: cleanText(source.note),
    overtimeAmount: toNumber(source.overtimeAmount),
    payeeRole: cleanText(source.payeeRole, 'guard'),
    paymentMethod: cleanText(source.paymentMethod, 'cash'),
    personId: cleanText(source.personId),
    personName: cleanText(source.personName, 'Crew Studio'),
    postedAt: cleanText(source.postedAt),
    postedBookkeepingEntryId: cleanText(source.postedBookkeepingEntryId),
    postedByUid: cleanText(source.postedByUid),
    ruleId: cleanText(source.ruleId),
    ruleName: cleanText(source.ruleName, 'Operator Fee'),
    serviceLabel: cleanText(source.serviceLabel),
    sourcePricingId: cleanText(source.sourcePricingId),
    sourcePricingLabel: cleanText(source.sourcePricingLabel),
    sourcePricingType: cleanText(source.sourcePricingType),
    status,
    title: cleanText(source.title, 'Operator Fee'),
    totalAmount: toNumber(source.totalAmount, toNumber(source.amount) + toNumber(source.mealAmount) + toNumber(source.overtimeAmount)),
    createdAt,
    updatedAt: cleanText(source.updatedAt, createdAt),
  };
}

export function subscribeOperatorFeeEntries(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const entriesRef = collection(firestoreDb, OPERATOR_FEE_ENTRIES_COLLECTION);
  const entriesQuery = query(entriesRef, orderBy('bookingDate', 'desc'));

  return onSnapshot(
    entriesQuery,
    (snapshot) => {
      const entries = [];

      snapshot.forEach((entryDoc) => {
        entries.push(normalizeOperatorFeeEntry({
          id: entryDoc.id,
          ...entryDoc.data(),
        }, entryDoc.id));
      });

      callback(entries);
    },
    (error) => {
      console.error('Error fetching operator fee entries:', error);
      if (onError) onError(error);
    }
  );
}

export async function upsertOperatorFeeEntry(entry) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const entryId = cleanText(entry?.id, makeOperatorFeeEntryId(entry));
  const entryRef = doc(firestoreDb, OPERATOR_FEE_ENTRIES_COLLECTION, entryId);
  const cleanEntry = normalizeOperatorFeeEntry({
    ...entry,
    id: entryId,
    updatedAt: nowIso(),
  }, entryId);

  await setDoc(entryRef, cleanEntry, { merge: true });

  return cleanEntry;
}

export async function updateOperatorFeeEntry(entry) {
  if (!entry?.id) {
    throw new Error('Operator fee entry ID tidak boleh kosong.');
  }

  return upsertOperatorFeeEntry(entry);
}

export async function deleteOperatorFeeEntry(entryId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!entryId) {
    throw new Error('Operator fee entry ID tidak boleh kosong.');
  }

  await deleteDoc(doc(firestoreDb, OPERATOR_FEE_ENTRIES_COLLECTION, entryId));
}

export async function markOperatorFeeEntryReviewed(entry) {
  return updateOperatorFeeEntry({
    ...entry,
    status: OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
  });
}

export async function markOperatorFeeEntryPosted(entry, bookkeepingEntry = {}, postedByUid = '') {
  return updateOperatorFeeEntry({
    ...entry,
    postedAt: nowIso(),
    postedBookkeepingEntryId: cleanText(bookkeepingEntry.id),
    postedByUid: cleanText(postedByUid),
    status: OPERATOR_FEE_ENTRY_STATUSES.POSTED,
  });
}

export async function voidOperatorFeeEntry(entry, note = '') {
  return updateOperatorFeeEntry({
    ...entry,
    note: cleanText(note, entry.note),
    status: OPERATOR_FEE_ENTRY_STATUSES.VOID,
  });
}

export function createOperatorFeeBookkeepingPayload(entry, booking = {}) {
  const normalizedEntry = normalizeOperatorFeeEntry(entry);

  return {
    amount: normalizedEntry.totalAmount || normalizedEntry.amount,
    category: 'crew',
    date: normalizedEntry.bookingDate || booking.date || new Date().toISOString().slice(0, 10),
    note: [
      normalizedEntry.note,
      normalizedEntry.bookingCode ? 'Booking: ' + normalizedEntry.bookingCode : '',
      normalizedEntry.personName ? 'Crew: ' + normalizedEntry.personName : '',
    ].filter(Boolean).join(' | '),
    paymentMethod: normalizedEntry.paymentMethod || 'cash',
    source: 'operatorFee',
    sourceBookingId: normalizedEntry.bookingId || booking.id || '',
    sourceFeeEntryId: normalizedEntry.id,
    title: normalizedEntry.title || 'Operator Fee - ' + (normalizedEntry.personName || 'Crew Studio'),
    type: 'expense',
  };
}

export const operatorFeeRepository = {
  createOperatorFeeBookkeepingPayload,
  deleteOperatorFeeEntry,
  markOperatorFeeEntryPosted,
  markOperatorFeeEntryReviewed,
  normalizeOperatorFeeEntry,
  subscribeOperatorFeeEntries,
  updateOperatorFeeEntry,
  upsertOperatorFeeEntry,
  voidOperatorFeeEntry,
};
