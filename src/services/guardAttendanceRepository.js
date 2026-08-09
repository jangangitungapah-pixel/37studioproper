import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { normalizeBookkeepingEntry } from './bookkeepingRepository.js';
import {
  NOTIFICATION_EVENT_TYPES,
  createAdminNotificationEvent,
} from './notificationEventRepository.js';
import { OPERATOR_FEE_PERSON_ROLES } from '../settings/operatorFeeSettings.js';

export const GUARD_ATTENDANCE_COLLECTION = 'guardAttendanceSessions';
export const STUDIO_GUARD_ROLE = 'studio_guard';

export const GUARD_ATTENDANCE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  CLOSED: 'closed',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected',
  VOID: 'void',
});

export const GUARD_ATTENDANCE_APPROVAL_STATUSES = Object.freeze({
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
});

export const GUARD_MEAL_BOOKKEEPING_STATUSES = Object.freeze({
  NOT_POSTED: 'not_posted',
  POSTED: 'posted',
});

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

export function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function getDurationHours(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100);
}

export function makeGuardAttendanceId({
  guardUid = '',
  date = '',
} = {}) {
  const safeGuardUid =
    cleanText(
      guardUid,
    );

  if (
    !safeGuardUid
  ) {
    throw new Error(
      'UID penjaga wajib tersedia untuk membuat ID absen.',
    );
  }

  if (
    safeGuardUid.includes(
      '/',
    )
  ) {
    throw new Error(
      'UID penjaga tidak valid untuk document ID absen.',
    );
  }

  const safeDate =
    cleanText(
      date,
      getTodayIsoDate(),
    ).replace(
      /[^0-9-]/g,
      '',
    );

  return (
    'att__' +
    safeGuardUid +
    '__' +
    safeDate
  );
}

export function makeGuardMealBookkeepingId({ guardPersonId = '', date = '' } = {}) {
  const safePersonId = cleanText(guardPersonId, 'guard').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = cleanText(date, getTodayIsoDate()).replace(/[^0-9-]/g, '');

  return 'guardmeal__' + safePersonId + '__' + safeDate;
}

export function normalizeGuardAttendanceSession(session, fallbackId = '') {
  const source = session && typeof session === 'object' ? session : {};
  const id = cleanText(source.id, fallbackId);
  const createdAt = cleanText(source.createdAt, nowIso());
  const approvalStatus = Object.values(GUARD_ATTENDANCE_APPROVAL_STATUSES).includes(source.approvalStatus)
    ? source.approvalStatus
    : GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING;
  const status = Object.values(GUARD_ATTENDANCE_STATUSES).includes(source.status)
    ? source.status
    : GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL;

  return {
    id,
    approvalStatus,
    approvedAt: cleanText(source.approvedAt),
    approvedByName: cleanText(source.approvedByName),
    approvedByUid: cleanText(source.approvedByUid),
    closedAt: cleanText(source.closedAt),
    clockInAt: cleanText(source.clockInAt),
    clockInByUid: cleanText(source.clockInByUid),
    clockOutAt: cleanText(source.clockOutAt),
    clockOutByUid: cleanText(source.clockOutByUid),
    createdAt,
    date: cleanText(source.date, getTodayIsoDate()),
    durationHours: toNumber(source.durationHours),
    guardEmail: cleanText(source.guardEmail),
    guardName: cleanText(source.guardName, 'Penjaga Studio'),
    guardPersonId: cleanText(source.guardPersonId),
    guardUid: cleanText(source.guardUid),
    mealAmount: toNumber(source.mealAmount, 40000),
    mealEligible: source.mealEligible === true,
    mealBookkeepingEntryId: cleanText(source.mealBookkeepingEntryId),
    mealBookkeepingStatus: Object.values(
      GUARD_MEAL_BOOKKEEPING_STATUSES,
    ).includes(
      source.mealBookkeepingStatus,
    )
      ? source.mealBookkeepingStatus
      : GUARD_MEAL_BOOKKEEPING_STATUSES.NOT_POSTED,
    mealPostedAt: cleanText(source.mealPostedAt),
    mealPostedByUid: cleanText(source.mealPostedByUid),
    note: cleanText(source.note),
    ownerActionRequired: source.ownerActionRequired !== false && approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
    rejectedAt: cleanText(source.rejectedAt),
    rejectedByName: cleanText(source.rejectedByName),
    rejectedByUid: cleanText(source.rejectedByUid),
    rejectionReason: cleanText(source.rejectionReason),
    source: cleanText(source.source, 'guardAttendance'),
    status,
    updatedAt: cleanText(source.updatedAt, createdAt),
    voidedAt: cleanText(source.voidedAt),
    voidedByUid: cleanText(source.voidedByUid),
    voidReason: cleanText(source.voidReason),
  };
}

export function isGuardAttendanceApprovedForDate(session, { guardPersonId = '', guardUid = '', date = '' } = {}) {
  const record = normalizeGuardAttendanceSession(session);

  if (record.approvalStatus !== GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return false;
  if (![GUARD_ATTENDANCE_STATUSES.ACTIVE, GUARD_ATTENDANCE_STATUSES.CLOSED].includes(record.status)) return false;
  if (date && record.date !== date) return false;

  const personMatches = guardPersonId && record.guardPersonId === guardPersonId;
  const uidMatches = guardUid && record.guardUid === guardUid;

  return Boolean(personMatches || uidMatches);
}

export function hasApprovedGuardAttendanceForDate(sessions = [], input = {}) {
  return sessions.some((session) => isGuardAttendanceApprovedForDate(session, input));
}

export function isGuardFeeLineEligibleByAttendance(line, sessions = []) {
  if (line?.payeeRole !== OPERATOR_FEE_PERSON_ROLES.GUARD) return true;

  return hasApprovedGuardAttendanceForDate(sessions, {
    date: cleanText(line.bookingDate),
    guardPersonId: cleanText(line.personId),
    guardUid: cleanText(line.guardUid),
  });
}

export function createGuardMealBookkeepingPayload(
  session,
  {
    paymentMethod = 'cash',
  } = {},
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  const id =
    makeGuardMealBookkeepingId({
      date:
        record.date,

      guardPersonId:
        record.guardPersonId ||
        record.guardUid,
    });

  return {
    id,

    amount:
      record.mealAmount,

    category:
      'crew',

    date:
      record.date,

    note:
      'Auto dari Absen Penjaga | Guard: ' +
      record.guardName,

    paymentMethod:
      cleanText(
        paymentMethod,
        'cash',
      ),

    source:
      'guardAttendanceMeal',

    sourceAttendanceDate:
      record.date,

    sourceAttendanceId:
      record.id,

    sourceGuardPersonId:
      record.guardPersonId,

    title:
      'Uang Makan Penjaga - ' +
      record.guardName +
      ' - ' +
      record.date,

    type:
      'expense',
  };
}


function getGuardAttendanceDocumentRef(
  attendanceId,
) {
  return doc(
    firestoreDb,
    GUARD_ATTENDANCE_COLLECTION,
    attendanceId,
  );
}

function getGuardAttendanceId(
  sessionOrId,
) {
  const id =
    typeof sessionOrId ===
    'string'
      ? cleanText(
          sessionOrId,
        )
      : cleanText(
          sessionOrId?.id,
        );

  if (
    !id
  ) {
    throw new Error(
      'ID absen penjaga tidak valid.',
    );
  }

  return id;
}

async function resolveGuardAttendanceSession(
  sessionOrId,
) {
  const id =
    getGuardAttendanceId(
      sessionOrId,
    );

  const snapshot =
    await getDoc(
      getGuardAttendanceDocumentRef(
        id,
      ),
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      'Data absen penjaga tidak ditemukan.',
    );
  }

  return normalizeGuardAttendanceSession(
    {
      id:
        snapshot.id,

      ...snapshot.data(),
    },
    snapshot.id,
  );
}

function assertOwnerAttendanceActor(
  ownerUser,
) {
  if (
    !ownerUser?.uid
  ) {
    throw new Error(
      'Identitas admin approval tidak valid.',
    );
  }
}

export function buildGuardMealPostingPatch(
  session,
  ownerUser,
  bookkeepingEntryId,
  {
    timestamp =
      nowIso(),
  } = {},
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  assertOwnerAttendanceActor(
    ownerUser,
  );

  if (
    record.approvalStatus !==
    GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
  ) {
    throw new Error(
      'Uang makan hanya bisa diposting dari attendance approved.',
    );
  }

  if (
    record.status !==
    GUARD_ATTENDANCE_STATUSES.CLOSED
  ) {
    throw new Error(
      'Selesaikan shift penjaga sebelum posting uang makan.',
    );
  }

  if (
    !record.mealEligible ||
    record.mealAmount <= 0
  ) {
    throw new Error(
      'Attendance ini tidak eligible untuk uang makan.',
    );
  }

  if (
    record.mealBookkeepingStatus ===
    GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED
  ) {
    throw new Error(
      'Uang makan attendance ini sudah diposting.',
    );
  }

  const cleanEntryId =
    cleanText(
      bookkeepingEntryId,
    );

  if (
    !cleanEntryId
  ) {
    throw new Error(
      'Bookkeeping entry ID uang makan tidak valid.',
    );
  }

  return {
    mealBookkeepingEntryId:
      cleanEntryId,

    mealBookkeepingStatus:
      GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED,

    mealPostedAt:
      timestamp,

    mealPostedByUid:
      ownerUser.uid,

    updatedAt:
      timestamp,
  };
}

export async function postGuardMealToBookkeeping(
  sessionOrId,
  ownerUser,
  {
    paymentMethod =
      'cash',
  } = {},
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  assertOwnerAttendanceActor(
    ownerUser,
  );

  const record =
    await resolveGuardAttendanceSession(
      sessionOrId,
    );

  const timestamp =
    nowIso();

  const payload =
    createGuardMealBookkeepingPayload(
      record,
      {
        paymentMethod,
      },
    );

  const bookkeepingEntry =
    normalizeBookkeepingEntry(
      {
        ...payload,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,
      },
      payload.id,
    );

  const attendancePatch =
    buildGuardMealPostingPatch(
      record,
      ownerUser,
      bookkeepingEntry.id,
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
    getGuardAttendanceDocumentRef(
      record.id,
    ),
    attendancePatch,
  );

  await batch.commit();

  return {
    attendance:
      normalizeGuardAttendanceSession({
        ...record,
        ...attendancePatch,
      }),

    bookkeepingEntry,
  };
}

function assertGuardAttendanceCanApprove(
  session,
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  if (
    record.status ===
    GUARD_ATTENDANCE_STATUSES.VOID
  ) {
    throw new Error(
      'Absen void tidak bisa di-approve.',
    );
  }

  if (
    record.approvalStatus ===
    GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
  ) {
    throw new Error(
      'Absen sudah di-approve.',
    );
  }

  if (
    ![
      GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
      GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED,
    ].includes(
      record.approvalStatus,
    )
  ) {
    throw new Error(
      'Transition approval absen tidak valid.',
    );
  }

  return record;
}

function assertGuardAttendanceCanReject(
  session,
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  if (
    record.status ===
    GUARD_ATTENDANCE_STATUSES.VOID
  ) {
    throw new Error(
      'Absen void tidak bisa di-reject.',
    );
  }

  if (
    record.mealBookkeepingStatus ===
    GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED
  ) {
    throw new Error(
      'Absen tidak bisa ditolak karena uang makan sudah diposting.',
    );
  }

  if (
    record.approvalStatus ===
    GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED
  ) {
    throw new Error(
      'Absen sudah ditolak.',
    );
  }

  return record;
}

function assertGuardAttendanceCanVoid(
  session,
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  if (
    record.status ===
    GUARD_ATTENDANCE_STATUSES.VOID
  ) {
    throw new Error(
      'Absen sudah void.',
    );
  }

  if (
    record.mealBookkeepingStatus ===
    GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED
  ) {
    throw new Error(
      'Absen tidak bisa di-void karena uang makan sudah diposting.',
    );
  }

  return record;
}

export function buildGuardAttendanceCheckOutPatch(
  session,
  user,
  {
    timestamp =
      nowIso(),
  } = {},
) {
  const record =
    normalizeGuardAttendanceSession(
      session,
    );

  if (
    !record.id
  ) {
    throw new Error(
      'ID absen penjaga tidak valid.',
    );
  }

  if (
    !user?.uid ||
    user.uid !==
      record.guardUid
  ) {
    throw new Error(
      'Hanya penjaga terkait yang bisa menutup absen ini.',
    );
  }

  if (
    record.clockOutAt
  ) {
    throw new Error(
      'Shift ini sudah selesai.',
    );
  }

  if (
    ![
      GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL,
      GUARD_ATTENDANCE_STATUSES.ACTIVE,
    ].includes(
      record.status,
    )
  ) {
    throw new Error(
      'Status absen tidak dapat ditutup.',
    );
  }

  const start =
    new Date(
      record.clockInAt,
    );

  const end =
    new Date(
      timestamp,
    );

  if (
    Number.isNaN(
      start.getTime(),
    ) ||
    Number.isNaN(
      end.getTime(),
    ) ||
    end.getTime() <=
      start.getTime()
  ) {
    throw new Error(
      'Waktu selesai jaga harus setelah waktu mulai.',
    );
  }

  return {
    closedAt:
      timestamp,

    clockOutAt:
      timestamp,

    clockOutByUid:
      user.uid,

    durationHours:
      getDurationHours(
        record.clockInAt,
        timestamp,
      ),

    status:
      GUARD_ATTENDANCE_STATUSES.CLOSED,

    updatedAt:
      timestamp,
  };
}

async function hasApprovedGuardMealForDay(
  record,
) {
  const snapshot =
    await getDocs(
      query(
        collection(
          firestoreDb,
          GUARD_ATTENDANCE_COLLECTION,
        ),
        where(
          'guardUid',
          '==',
          record.guardUid,
        ),
      ),
    );

  let hasApprovedMeal =
    false;

  snapshot.forEach(
    (
      sessionDoc,
    ) => {
      if (
        hasApprovedMeal ||
        sessionDoc.id ===
          record.id
      ) {
        return;
      }

      const session =
        normalizeGuardAttendanceSession(
          {
            id:
              sessionDoc.id,

            ...sessionDoc.data(),
          },
          sessionDoc.id,
        );

      if (
        session.date ===
          record.date &&
        session.approvalStatus ===
          GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED &&
        session.mealEligible
      ) {
        hasApprovedMeal =
          true;
      }
    },
  );

  return hasApprovedMeal;
}

function createGuardAttendanceSubmittedNotification(
  record,
  user,
) {
  return createAdminNotificationEvent({
    eventId:
      'notif_guard_attendance_submitted__' +
      record.id,

    message:
      record.guardName +
      ' mengajukan absen jaga pada ' +
      record.date +
      '. Perlu approval owner.',

    metadata: {
      attendanceId:
        record.id,

      date:
        record.date,

      guardName:
        record.guardName,

      guardPersonId:
        record.guardPersonId,

      guardUid:
        record.guardUid,
    },

    priority:
      'high',

    source:
      'guard-attendance',

    title:
      'Absen Penjaga Perlu Approval',

    type:
      NOTIFICATION_EVENT_TYPES.GUARD_ATTENDANCE_SUBMITTED,

    url:
      '/admin/guard-attendance',

    user,

    actorRole:
      'guard',
  });
}

export async function createGuardAttendanceCheckIn({
  guardPerson = {},
  mealAmount = 40000,
  note = '',
  user,
} = {}) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  if (
    !user?.uid
  ) {
    throw new Error(
      'User penjaga belum valid.',
    );
  }

  const date =
    getTodayIsoDate();

  const clockInAt =
    nowIso();

  const guardPersonId =
    cleanText(
      guardPerson.id ||
      user.uid,
    );

  const id =
    makeGuardAttendanceId({
      date,
      guardUid:
        user.uid,
    });

  const record =
    normalizeGuardAttendanceSession(
      {
        id,

        approvalStatus:
          GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,

        approvedAt:
          '',

        approvedByName:
          '',

        approvedByUid:
          '',

        closedAt:
          '',

        clockInAt,

        clockInByUid:
          user.uid,

        clockOutAt:
          '',

        clockOutByUid:
          '',

        createdAt:
          clockInAt,

        date,

        durationHours:
          0,

        guardEmail:
          cleanText(
            user.email,
          ),

        guardName:
          cleanText(
            guardPerson.name ||
              user.displayName,
            'Penjaga Studio',
          ),

        guardPersonId,

        guardUid:
          user.uid,

        mealAmount,

        mealEligible:
          false,

        mealBookkeepingEntryId:
          '',

        mealBookkeepingStatus:
          GUARD_MEAL_BOOKKEEPING_STATUSES.NOT_POSTED,

        mealPostedAt:
          '',

        mealPostedByUid:
          '',

        note,

        ownerActionRequired:
          true,

        rejectedAt:
          '',

        rejectedByName:
          '',

        rejectedByUid:
          '',

        rejectionReason:
          '',

        source:
          'guardAttendance',

        status:
          GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL,

        updatedAt:
          clockInAt,

        voidedAt:
          '',

        voidedByUid:
          '',

        voidReason:
          '',
      },
      id,
    );

  const documentRef =
    getGuardAttendanceDocumentRef(
      id,
    );

  if (
    !navigator.onLine
  ) {
    setDoc(
      documentRef,
      record,
    ).catch(
      (
        error,
      ) => {
        console.warn(
          '[guard-attendance] Offline check-in write gagal:',
          error,
        );
      },
    );

    createGuardAttendanceSubmittedNotification(
      record,
      user,
    ).catch(
      (
        error,
      ) => {
        console.warn(
          '[guard-attendance] Offline notification queue gagal:',
          error,
        );
      },
    );

    return record;
  }

  await setDoc(
    documentRef,
    record,
  );

  createGuardAttendanceSubmittedNotification(
    record,
    user,
  ).catch(
    (
      error,
    ) => {
      console.warn(
        '[guard-attendance] Notification event gagal dibuat:',
        error,
      );
    },
  );

  return record;
}

export async function closeGuardAttendanceSession(
  session,
  user,
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
    normalizeGuardAttendanceSession(
      session,
    );

  const patch =
    buildGuardAttendanceCheckOutPatch(
      record,
      user,
    );

  const documentRef =
    getGuardAttendanceDocumentRef(
      record.id,
    );

  if (
    !navigator.onLine
  ) {
    updateDoc(
      documentRef,
      patch,
    ).catch(
      (
        error,
      ) => {
        console.warn(
          '[guard-attendance] Offline check-out write gagal:',
          error,
        );
      },
    );

    return normalizeGuardAttendanceSession({
      ...record,
      ...patch,
    });
  }

  await updateDoc(
    documentRef,
    patch,
  );

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function approveGuardAttendanceSession(
  sessionOrId,
  ownerUser,
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  assertOwnerAttendanceActor(
    ownerUser,
  );

  const record =
    assertGuardAttendanceCanApprove(
      await resolveGuardAttendanceSession(
        sessionOrId,
      ),
    );

  const timestamp =
    nowIso();

  const nextStatus =
    record.clockOutAt
      ? GUARD_ATTENDANCE_STATUSES.CLOSED
      : GUARD_ATTENDANCE_STATUSES.ACTIVE;

  const alreadyHasMealForDay =
    await hasApprovedGuardMealForDay(
      record,
    );

  const patch = {
    approvalStatus:
      GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED,

    approvedAt:
      timestamp,

    approvedByName:
      cleanText(
        ownerUser?.displayName ||
          ownerUser?.email,
        'Owner',
      ),

    approvedByUid:
      cleanText(
        ownerUser?.uid,
      ),

    mealEligible:
      !alreadyHasMealForDay,

    ownerActionRequired:
      false,

    rejectedAt:
      '',

    rejectedByName:
      '',

    rejectedByUid:
      '',

    rejectionReason:
      '',

    status:
      nextStatus,

    updatedAt:
      timestamp,
  };

  await updateDoc(
    getGuardAttendanceDocumentRef(
      record.id,
    ),
    patch,
  );

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function rejectGuardAttendanceSession(
  sessionOrId,
  ownerUser,
  reason = '',
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  assertOwnerAttendanceActor(
    ownerUser,
  );

  const record =
    assertGuardAttendanceCanReject(
      await resolveGuardAttendanceSession(
        sessionOrId,
      ),
    );

  const timestamp =
    nowIso();

  const patch = {
    approvalStatus:
      GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED,

    mealEligible:
      false,

    ownerActionRequired:
      false,

    rejectedAt:
      timestamp,

    rejectedByName:
      cleanText(
        ownerUser?.displayName ||
          ownerUser?.email,
        'Owner',
      ),

    rejectedByUid:
      cleanText(
        ownerUser?.uid,
      ),

    rejectionReason:
      cleanText(
        reason,
        'Ditolak owner.',
      ),

    status:
      GUARD_ATTENDANCE_STATUSES.REJECTED,

    updatedAt:
      timestamp,
  };

  await updateDoc(
    getGuardAttendanceDocumentRef(
      record.id,
    ),
    patch,
  );

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function voidGuardAttendanceSession(
  sessionOrId,
  ownerUser,
  reason = '',
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  assertOwnerAttendanceActor(
    ownerUser,
  );

  const record =
    assertGuardAttendanceCanVoid(
      await resolveGuardAttendanceSession(
        sessionOrId,
      ),
    );

  const timestamp =
    nowIso();

  const patch = {
    mealEligible:
      false,

    ownerActionRequired:
      false,

    status:
      GUARD_ATTENDANCE_STATUSES.VOID,

    updatedAt:
      timestamp,

    voidReason:
      cleanText(
        reason,
        'Dibatalkan owner.',
      ),

    voidedAt:
      timestamp,

    voidedByUid:
      cleanText(
        ownerUser?.uid,
      ),
  };

  await updateDoc(
    getGuardAttendanceDocumentRef(
      record.id,
    ),
    patch,
  );

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export function subscribeGuardAttendanceSessions(
  options = {},
  callback,
  onError,
) {
  const callbackFirst =
    typeof options ===
    'function';

  const normalizedOptions =
    callbackFirst
      ? {}
      : (
          options &&
          typeof options ===
            'object'
            ? options
            : {}
        );

  const resolvedCallback =
    callbackFirst
      ? options
      : callback;

  const resolvedOnError =
    callbackFirst
      ? callback
      : onError;

  if (
    typeof resolvedCallback !==
    'function'
  ) {
    throw new Error(
      'Callback subscription guard attendance wajib berupa function.',
    );
  }

  const {
    approvalStatus = 'all',
    date = '',
    guardUid = '',
    status = 'all',
  } =
    normalizedOptions;
  if (!isFirebaseConfigured || !firestoreDb) {
    if (resolvedOnError) {
      resolvedOnError(
        new Error(
          'Firebase belum dikonfigurasi.',
        ),
      );
    }
    return () => {};
  }

  const queryConstraints = [];

  if (guardUid) queryConstraints.push(where('guardUid', '==', guardUid));
  if (date) queryConstraints.push(where('date', '==', date));
  if (status !== 'all') queryConstraints.push(where('status', '==', status));
  if (approvalStatus !== 'all') queryConstraints.push(where('approvalStatus', '==', approvalStatus));

  const sessionsQuery = query(
    collection(firestoreDb, GUARD_ATTENDANCE_COLLECTION),
    ...queryConstraints
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = [];

      snapshot.forEach((sessionDoc) => {
        sessions.push(normalizeGuardAttendanceSession({
          id: sessionDoc.id,
          ...sessionDoc.data(),
        }, sessionDoc.id));
      });

      const filtered = sessions
        .filter((session) => !date || session.date === date)
        .filter((session) => !guardUid || session.guardUid === guardUid)
        .filter((session) => status === 'all' || session.status === status)
        .filter((session) => approvalStatus === 'all' || session.approvalStatus === approvalStatus)
        .sort((first, second) => String(second.clockInAt || '').localeCompare(String(first.clockInAt || '')));

      resolvedCallback(
        filtered,
      );
    },
    (error) => {
      console.error('Gagal membaca guard attendance sessions:', error);
      if (resolvedOnError) {
        resolvedOnError(
          error,
        );
      }
    }
  );
}

export const guardAttendanceRepository = {
  approveGuardAttendanceSession,
  closeGuardAttendanceSession,
  createGuardAttendanceCheckIn,
  createGuardMealBookkeepingPayload,
  hasApprovedGuardAttendanceForDate,
  isGuardFeeLineEligibleByAttendance,
  normalizeGuardAttendanceSession,
  rejectGuardAttendanceSession,
  buildGuardAttendanceCheckOutPatch,
  buildGuardMealPostingPatch,
  makeGuardAttendanceId,
  postGuardMealToBookkeeping,
  subscribeGuardAttendanceSessions,
  voidGuardAttendanceSession,
};
