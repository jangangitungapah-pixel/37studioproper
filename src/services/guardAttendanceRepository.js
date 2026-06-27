import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
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

export function makeGuardAttendanceId({ guardPersonId = '', guardUid = '', date = '' } = {}) {
  const safePersonId = cleanText(guardPersonId || guardUid, 'guard').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = cleanText(date, getTodayIsoDate()).replace(/[^0-9-]/g, '');

  return 'att__' + safePersonId + '__' + safeDate + '__' + Date.now().toString(36);
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
    clockOutAt: cleanText(source.clockOutAt),
    createdAt,
    date: cleanText(source.date, getTodayIsoDate()),
    durationHours: toNumber(source.durationHours),
    guardEmail: cleanText(source.guardEmail),
    guardName: cleanText(source.guardName, 'Penjaga Studio'),
    guardPersonId: cleanText(source.guardPersonId),
    guardUid: cleanText(source.guardUid),
    mealAmount: toNumber(source.mealAmount, 40000),
    mealEligible: source.mealEligible === true,
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

export function createGuardMealBookkeepingPayload(session) {
  const record = normalizeGuardAttendanceSession(session);
  const id = makeGuardMealBookkeepingId({
    date: record.date,
    guardPersonId: record.guardPersonId || record.guardUid,
  });

  return {
    id,
    amount: record.mealAmount,
    category: 'crew',
    date: record.date,
    note: 'Auto dari Absen Penjaga | Guard: ' + record.guardName,
    paymentMethod: 'cash',
    source: 'guardAttendanceMeal',
    sourceAttendanceDate: record.date,
    sourceGuardPersonId: record.guardPersonId,
    title: 'Uang Makan Penjaga - ' + record.guardName + ' - ' + record.date,
    type: 'expense',
  };
}

export async function createGuardAttendanceCheckIn({
  guardPerson = {},
  mealAmount = 40000,
  note = '',
  user,
} = {}) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!user?.uid) {
    throw new Error('User penjaga belum valid.');
  }

  const date = getTodayIsoDate();
  const clockInAt = nowIso();
  const guardPersonId = cleanText(guardPerson.id || user.uid);
  const id = makeGuardAttendanceId({
    date,
    guardPersonId,
    guardUid: user.uid,
  });

  const record = normalizeGuardAttendanceSession({
    id,
    approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
    approvedAt: '',
    approvedByName: '',
    approvedByUid: '',
    closedAt: '',
    clockInAt,
    clockOutAt: '',
    createdAt: clockInAt,
    date,
    durationHours: 0,
    guardEmail: cleanText(user.email),
    guardName: cleanText(guardPerson.name || user.displayName, 'Penjaga Studio'),
    guardPersonId,
    guardUid: user.uid,
    mealAmount,
    mealEligible: false,
    note,
    ownerActionRequired: true,
    rejectedAt: '',
    rejectedByName: '',
    rejectedByUid: '',
    rejectionReason: '',
    source: 'guardAttendance',
    status: GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL,
    updatedAt: clockInAt,
    voidedAt: '',
    voidedByUid: '',
    voidReason: '',
  }, id);

  await setDoc(doc(firestoreDb, GUARD_ATTENDANCE_COLLECTION, id), record);

  await createAdminNotificationEvent({
    message: record.guardName + ' mengajukan absen jaga pada ' + record.date + '. Perlu approval owner.',
    metadata: {
      attendanceId: id,
      date: record.date,
      guardName: record.guardName,
      guardPersonId: record.guardPersonId,
      guardUid: record.guardUid,
    },
    priority: 'high',
    source: 'guard-attendance',
    title: 'Absen Penjaga Perlu Approval',
    type: NOTIFICATION_EVENT_TYPES.GUARD_ATTENDANCE_SUBMITTED,
    url: '/admin/guard-attendance',
    user,
    actorRole: 'guard',
  }).catch((error) => {
    console.warn('[guard-attendance] Notification event gagal dibuat:', error);
  });

  return record;
}

export async function closeGuardAttendanceSession(session, user) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const record = normalizeGuardAttendanceSession(session);
  const timestamp = nowIso();
  const status = record.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
    ? GUARD_ATTENDANCE_STATUSES.CLOSED
    : record.status;

  const patch = {
    clockOutAt: timestamp,
    closedAt: timestamp,
    durationHours: getDurationHours(record.clockInAt, timestamp),
    status,
    updatedAt: timestamp,
  };

  if (user?.uid && user.uid !== record.guardUid) {
    throw new Error('Hanya penjaga terkait yang bisa menutup absen ini.');
  }

  await updateDoc(doc(firestoreDb, GUARD_ATTENDANCE_COLLECTION, record.id), patch);

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function approveGuardAttendanceSession(session, ownerUser, existingSessions = []) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const record = normalizeGuardAttendanceSession(session);
  const timestamp = nowIso();
  const nextStatus = record.clockOutAt ? GUARD_ATTENDANCE_STATUSES.CLOSED : GUARD_ATTENDANCE_STATUSES.ACTIVE;

  // Uang makan hanya diberikan SATU kali per penjaga per hari.
  // Jika sudah ada sesi approved lain untuk guard+tanggal yang sama, set mealEligible=false.
  const alreadyHasMealForDay = existingSessions.some((s) => {
    if (s.id === record.id) return false; // skip sesi yang sedang di-approve
    if (s.approvalStatus !== GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return false;
    if (s.date !== record.date) return false;

    const samePersonId = s.guardPersonId && s.guardPersonId === record.guardPersonId;
    const sameUid = s.guardUid && s.guardUid === record.guardUid;

    return (samePersonId || sameUid) && s.mealEligible;
  });

  const patch = {
    approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED,
    approvedAt: timestamp,
    approvedByName: cleanText(ownerUser?.displayName || ownerUser?.email, 'Owner'),
    approvedByUid: cleanText(ownerUser?.uid),
    mealEligible: !alreadyHasMealForDay,
    ownerActionRequired: false,
    rejectedAt: '',
    rejectedByName: '',
    rejectedByUid: '',
    rejectionReason: '',
    status: nextStatus,
    updatedAt: timestamp,
  };

  await updateDoc(doc(firestoreDb, GUARD_ATTENDANCE_COLLECTION, record.id), patch);

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function rejectGuardAttendanceSession(session, ownerUser, reason = '') {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const record = normalizeGuardAttendanceSession(session);
  const timestamp = nowIso();

  const patch = {
    approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED,
    mealEligible: false,
    ownerActionRequired: false,
    rejectedAt: timestamp,
    rejectedByName: cleanText(ownerUser?.displayName || ownerUser?.email, 'Owner'),
    rejectedByUid: cleanText(ownerUser?.uid),
    rejectionReason: cleanText(reason, 'Ditolak owner.'),
    status: GUARD_ATTENDANCE_STATUSES.REJECTED,
    updatedAt: timestamp,
  };

  await updateDoc(doc(firestoreDb, GUARD_ATTENDANCE_COLLECTION, record.id), patch);

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export async function voidGuardAttendanceSession(session, ownerUser, reason = '') {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const record = normalizeGuardAttendanceSession(session);
  const timestamp = nowIso();

  const patch = {
    mealEligible: false,
    ownerActionRequired: false,
    status: GUARD_ATTENDANCE_STATUSES.VOID,
    updatedAt: timestamp,
    voidReason: cleanText(reason, 'Dibatalkan owner.'),
    voidedAt: timestamp,
    voidedByUid: cleanText(ownerUser?.uid),
  };

  await updateDoc(doc(firestoreDb, GUARD_ATTENDANCE_COLLECTION, record.id), patch);

  return normalizeGuardAttendanceSession({
    ...record,
    ...patch,
  });
}

export function subscribeGuardAttendanceSessions({
  approvalStatus = 'all',
  date = '',
  guardUid = '',
  status = 'all',
} = {}, callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
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

      callback(filtered);
    },
    (error) => {
      console.error('Gagal membaca guard attendance sessions:', error);
      if (onError) onError(error);
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
  subscribeGuardAttendanceSessions,
  voidGuardAttendanceSession,
};
