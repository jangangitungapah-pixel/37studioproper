import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { normalizeBookkeepingEntry } from './bookkeepingRepository.js';

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

export const OPERATOR_FEE_VISIBILITY_STATUSES =
  Object.freeze({
    DRAFT:
      'draft',

    ESTIMATE:
      'estimate',

    POSTED:
      'posted',

    REVIEWED:
      'reviewed',
  });

function getOperatorFeeBookingIdentity(
  booking = {},
) {
  return {
    bookingCode:
      cleanText(
        booking?.bookingCode ||
          booking?.invoiceNumber ||
          booking?.id,
      ),

    bookingId:
      cleanText(
        booking?.id ||
          booking?.bookingId ||
          booking?.bookingCode,
      ),
  };
}

export function getOperatorFeeEntriesForBooking(
  entries = [],
  booking = {},
) {
  const {
    bookingCode,
    bookingId,
  } =
    getOperatorFeeBookingIdentity(
      booking,
    );

  const sourceEntries =
    Array.isArray(
      entries,
    )
      ? entries
      : [];

  return sourceEntries
    .map(
      (
        entry,
      ) =>
        normalizeOperatorFeeEntry(
          entry,
        ),
    )
    .filter(
      (
        entry,
      ) =>
        entry.status !==
          OPERATOR_FEE_ENTRY_STATUSES.VOID &&
        (
          (
            bookingId &&
            entry.bookingId ===
              bookingId
          ) ||
          (
            bookingCode &&
            entry.bookingCode ===
              bookingCode
          )
        ),
    );
}

export function getBookingOperatorFeeVisibility(
  entries = [],
  booking = {},
) {
  const relatedEntries =
    getOperatorFeeEntriesForBooking(
      entries,
      booking,
    );

  let status =
    OPERATOR_FEE_VISIBILITY_STATUSES.ESTIMATE;

  if (
    relatedEntries.length
  ) {
    const statuses =
      relatedEntries.map(
        (
          entry,
        ) =>
          entry.status,
      );

    if (
      statuses.every(
        (
          entryStatus,
        ) =>
          entryStatus ===
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.POSTED;
    } else if (
      statuses.every(
        (
          entryStatus,
        ) =>
          [
            OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
            OPERATOR_FEE_ENTRY_STATUSES.POSTED,
          ].includes(
            entryStatus,
          ),
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.REVIEWED;
    } else if (
      statuses.some(
        (
          entryStatus,
        ) =>
          [
            OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
            OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
            OPERATOR_FEE_ENTRY_STATUSES.POSTED,
          ].includes(
            entryStatus,
          ),
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.DRAFT;
    }
  }

  const statusMeta = {
    draft: {
      label:
        'Fee Draft',

      shortLabel:
        'Fee Draft',
    },

    estimate: {
      label:
        'Fee Belum Direview',

      shortLabel:
        'Fee?',
    },

    posted: {
      label:
        'Fee Posted',

      shortLabel:
        'Fee Posted',
    },

    reviewed: {
      label:
        'Fee Siap Post',

      shortLabel:
        'Fee Ready',
    },
  }[status];

  return {
    entryCount:
      relatedEntries.length,

    label:
      statusMeta.label,

    shortLabel:
      statusMeta.shortLabel,

    status,

    totalAmount:
      relatedEntries.reduce(
        (
          total,
          entry,
        ) =>
          total +
          Number(
            entry.totalAmount ||
              entry.amount ||
              0,
          ),
        0,
      ),
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

export function buildOperatorFeePostedPatch(
  entry,
  bookkeepingEntryId,
  postedByUid,
  {
    timestamp =
      nowIso(),
  } = {},
) {
  const record =
    normalizeOperatorFeeEntry(
      entry,
    );

  if (
    !record.id
  ) {
    throw new Error(
      'Operator fee entry ID tidak valid.',
    );
  }

  if (
    record.status ===
    OPERATOR_FEE_ENTRY_STATUSES.POSTED
  ) {
    throw new Error(
      'Operator fee ini sudah diposting.',
    );
  }

  if (
    record.status !==
    OPERATOR_FEE_ENTRY_STATUSES.REVIEWED
  ) {
    throw new Error(
      'Operator fee harus Reviewed sebelum diposting.',
    );
  }

  const cleanBookkeepingEntryId =
    cleanText(
      bookkeepingEntryId,
    );

  const cleanPostedByUid =
    cleanText(
      postedByUid,
    );

  if (
    !cleanBookkeepingEntryId
  ) {
    throw new Error(
      'Bookkeeping entry ID tidak valid.',
    );
  }

  if (
    !cleanPostedByUid
  ) {
    throw new Error(
      'Identitas user posting tidak valid.',
    );
  }

  return {
    postedAt:
      timestamp,

    postedBookkeepingEntryId:
      cleanBookkeepingEntryId,

    postedByUid:
      cleanPostedByUid,

    status:
      OPERATOR_FEE_ENTRY_STATUSES.POSTED,

    updatedAt:
      timestamp,
  };
}

export async function postOperatorFeeEntryToBookkeeping(
  entry,
  booking = {},
  postedByUid = '',
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  const record =
    normalizeOperatorFeeEntry(
      entry,
    );

  const timestamp =
    nowIso();

  const bookkeepingPayload =
    createOperatorFeeBookkeepingPayload(
      record,
      booking,
    );

  const bookkeepingEntry =
    normalizeBookkeepingEntry(
      {
        ...bookkeepingPayload,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,
      },
      bookkeepingPayload.id,
    );

  const postingPatch =
    buildOperatorFeePostedPatch(
      record,
      bookkeepingEntry.id,
      postedByUid,
      {
        timestamp,
      },
    );

  const batch =
    writeBatch(
      firestoreDb,
    );

  batch.set(
    doc(
      firestoreDb,
      'bookkeepingEntries',
      bookkeepingEntry.id,
    ),
    bookkeepingEntry,
  );

  batch.update(
    doc(
      firestoreDb,
      OPERATOR_FEE_ENTRIES_COLLECTION,
      record.id,
    ),
    postingPatch,
  );

  await batch.commit();

  return {
    bookkeepingEntry,

    operatorFeeEntry:
      normalizeOperatorFeeEntry({
        ...record,
        ...postingPatch,
      }),
  };
}

export async function voidOperatorFeeEntry(entry, note = '') {
  return updateOperatorFeeEntry({
    ...entry,
    note: cleanText(note, entry.note),
    status: OPERATOR_FEE_ENTRY_STATUSES.VOID,
  });
}

function createSafeBookkeepingId(sourceFeeEntryId) {
  const cleanId = cleanText(sourceFeeEntryId, 'operator-fee')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 220);

  return 'opfee__' + cleanId;
}

export function createOperatorFeeBookkeepingPayload(entry, booking = {}) {
  const normalizedEntry = normalizeOperatorFeeEntry(entry);
  const bookingId = normalizedEntry.bookingId || booking.id || booking.bookingId || '';
  const bookkeepingEntryId = createSafeBookkeepingId(normalizedEntry.id);

  return {
    id: bookkeepingEntryId,
    amount: normalizedEntry.totalAmount || normalizedEntry.amount,
    category: 'crew',
    date: normalizedEntry.bookingDate || booking.date || new Date().toISOString().slice(0, 10),
    note: [
      'Auto dari Operator Fee',
      normalizedEntry.note,
      normalizedEntry.bookingCode ? 'Booking: ' + normalizedEntry.bookingCode : '',
      normalizedEntry.personName ? 'Crew: ' + normalizedEntry.personName : '',
      normalizedEntry.ruleName ? 'Rule: ' + normalizedEntry.ruleName : '',
    ].filter(Boolean).join(' | '),
    paymentMethod: normalizedEntry.paymentMethod || 'cash',
    source: 'operatorFee',
    sourceBookingId: bookingId,
    sourceFeeEntryId: normalizedEntry.id,
    title: normalizedEntry.title || 'Operator Fee - ' + (normalizedEntry.personName || 'Crew Studio'),
    type: 'expense',
  };
}

export const operatorFeeRepository = {
  buildOperatorFeePostedPatch,
  createOperatorFeeBookkeepingPayload,
  deleteOperatorFeeEntry,
  markOperatorFeeEntryReviewed,
  postOperatorFeeEntryToBookkeeping,
  normalizeOperatorFeeEntry,
  subscribeOperatorFeeEntries,
  updateOperatorFeeEntry,
  upsertOperatorFeeEntry,
  voidOperatorFeeEntry,
};
