import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export const NOTIFICATION_EVENTS_COLLECTION = 'notificationEvents';

const DEFAULT_NOTIFICATION_WORKER_URL = 'https://studio37-onesignal-notification-worker.studio37.workers.dev';
const notificationEnv = import.meta.env || {};
const NOTIFICATION_WORKER_URL = notificationEnv.VITE_NOTIFICATION_WORKER_URL || DEFAULT_NOTIFICATION_WORKER_URL;

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_MESSAGE_CREATED: 'booking_message_created',
  BOOKING_REJECTED: 'booking_rejected',
  BOOKING_REQUEST_CREATED: 'booking_request_created',
  GUARD_ATTENDANCE_SUBMITTED: 'guard_attendance_submitted',
  PAYMENT_PROOF_APPROVED: 'payment_proof_approved',
  PAYMENT_PROOF_REJECTED: 'payment_proof_rejected',
  PAYMENT_PROOF_SUBMITTED: 'payment_proof_submitted',
});

export const NOTIFICATION_EVENT_STATUSES = Object.freeze({
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENT: 'sent',
});

export const notificationEventStatusOptions = [
  { key: 'all', label: 'Semua' },
  { key: NOTIFICATION_EVENT_STATUSES.PENDING, label: 'Pending' },
  { key: NOTIFICATION_EVENT_STATUSES.PROCESSING, label: 'Processing' },
  { key: NOTIFICATION_EVENT_STATUSES.SENT, label: 'Sent' },
  { key: NOTIFICATION_EVENT_STATUSES.FAILED, label: 'Failed' },
  { key: NOTIFICATION_EVENT_STATUSES.CANCELLED, label: 'Cancelled' },
];

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function createNotificationEventId(type = 'event') {
  const safeType = cleanString(type, 80).replace(/[^a-z0-9_-]/gi, '_').toLowerCase() || 'event';
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `notif_${safeType}_${Date.now()}_${randomPart}`;
}

function normalizeActorRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'guard' || role === 'studio_guard') return 'guard';
  if (role === 'system') return 'system';

  return 'client';
}

function normalizeTargetRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'client') return 'client';

  return 'none';
}

function normalizeTargetMode(mode) {
  return mode === 'user' ? 'user' : 'role';
}

function normalizePriority(priority) {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';

  return 'normal';
}

function normalizeEventType(type) {
  const normalized = cleanString(type, 120);

  return Object.values(NOTIFICATION_EVENT_TYPES).includes(normalized)
    ? normalized
    : cleanString(type || 'custom_event', 120);
}

function normalizeEventStatus(status) {
  return Object.values(NOTIFICATION_EVENT_STATUSES).includes(status)
    ? status
    : NOTIFICATION_EVENT_STATUSES.PENDING;
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

export function getNotificationEventStatusLabel(status) {
  return notificationEventStatusOptions.find((item) => item.key === status)?.label || 'Pending';
}

export function normalizeNotificationEvent(event) {
  const source = event && typeof event === 'object' ? event : {};

  return {
    actorEmail: cleanString(source.actorEmail, 254),
    actorRole: normalizeActorRole(source.actorRole),
    actorUid: cleanString(source.actorUid, 128),
    attempts: Math.max(0, Number(source.attempts) || 0),
    bookingId: cleanString(source.bookingId, 160),
    channel: cleanString(source.channel || 'push', 40),
    createdAt: cleanString(source.createdAt, 40),
    errorMessage: cleanString(source.errorMessage, 1000),
    id: cleanString(source.id, 240),
    message: cleanString(source.message, 600),
    metadata: normalizeMetadata(source.metadata),
    paymentProofId: cleanString(source.paymentProofId, 160),
    priority: normalizePriority(source.priority),
    provider: cleanString(source.provider || 'onesignal', 80),
    sentAt: cleanString(source.sentAt, 40),
    source: cleanString(source.source, 80),
    status: normalizeEventStatus(source.status),
    targetMode: normalizeTargetMode(source.targetMode),
    targetRole: normalizeTargetRole(source.targetRole),
    targetUid: cleanString(source.targetUid, 128),
    title: cleanString(source.title, 180),
    type: normalizeEventType(source.type),
    updatedAt: cleanString(source.updatedAt, 40),
    url: cleanString(source.url, 700),
  };
}

export function buildNotificationEventRecord({
  actorRole = 'client',
  bookingId = '',
  errorMessage = '',
  eventId = '',
  message = '',
  metadata = {},
  paymentProofId = '',
  priority = 'normal',
  source = 'web-app',
  targetMode = 'role',
  targetRole = 'admin',
  targetUid = '',
  title = '',
  type,
  url = '',
  user,
} = {}) {
  const timestamp = nowIso();
  const id = eventId || createNotificationEventId(type);

  return normalizeNotificationEvent({
    actorEmail: cleanString(user?.email, 254),
    actorRole: normalizeActorRole(actorRole),
    actorUid: cleanString(user?.uid, 128),
    attempts: 0,
    bookingId: cleanString(bookingId, 160),
    channel: 'push',
    createdAt: timestamp,
    errorMessage: cleanString(errorMessage, 1000),
    id,
    message: cleanString(message, 600),
    metadata,
    paymentProofId: cleanString(paymentProofId, 160),
    priority: normalizePriority(priority),
    provider: 'onesignal',
    sentAt: '',
    source: cleanString(source, 80),
    status: NOTIFICATION_EVENT_STATUSES.PENDING,
    targetMode: normalizeTargetMode(targetMode),
    targetRole: normalizeTargetRole(targetRole),
    targetUid: cleanString(targetUid, 128),
    title: cleanString(title, 180),
    type: normalizeEventType(type),
    updatedAt: timestamp,
    url: cleanString(url, 700),
  });
}

export async function dispatchNotificationEventNow(record, user) {
  if (!record?.id || typeof fetch !== 'function') return null;

  const workerUrl = String(NOTIFICATION_WORKER_URL || '').trim().replace(/\/$/, '');
  if (!workerUrl) return null;

  const authUser = user || firebaseAuth?.currentUser;
  if (typeof authUser?.getIdToken !== 'function') return null;

  const token = await authUser.getIdToken();

  const response = await fetch(`${workerUrl}/dispatch`, {
    body: JSON.stringify({
      eventId: record.id,
    }),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Realtime dispatch gagal: ${response.status}`);
  }

  return payload;
}


async function dispatchWithRetry(record, user, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }

    try {
      return await dispatchNotificationEventNow(record, user);
    } catch (err) {
      lastError = err;
      console.warn(`[notification-dispatch] Attempt ${attempt + 1} failed:`, err?.message || err);
    }
  }

  throw lastError;
}

export async function createNotificationEvent(input = {}) {
  if (!firestoreDb || !input?.user?.uid) return null;

  const record = buildNotificationEventRecord(input);
  const eventRef = doc(collection(firestoreDb, NOTIFICATION_EVENTS_COLLECTION), record.id);

  await setDoc(eventRef, record);

  dispatchWithRetry(record, input.user).catch((error) => {
    console.warn('[notification-dispatch] All retry attempts failed, cron fallback will retry:', error);
  });

  return record;
}


export function createAdminNotificationEvent(input = {}) {
  return createNotificationEvent({
    ...input,
    actorRole: input.actorRole || 'client',
    targetMode: 'role',
    targetRole: 'admin',
    targetUid: '',
  });
}

export function createClientNotificationEvent(input = {}) {
  return createNotificationEvent({
    ...input,
    actorRole: input.actorRole || 'admin',
    targetMode: 'user',
    targetRole: 'client',
  });
}

export function subscribeNotificationEvents({ status = 'all' } = {}, callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const eventsRef = collection(firestoreDb, NOTIFICATION_EVENTS_COLLECTION);
  const normalizedStatus = status === 'all' ? 'all' : normalizeEventStatus(status);
  const eventsQuery = normalizedStatus === 'all'
    ? query(eventsRef)
    : query(eventsRef, where('status', '==', normalizedStatus));

  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      const events = [];

      snapshot.forEach((eventDoc) => {
        events.push(normalizeNotificationEvent({
          id: eventDoc.id,
          ...eventDoc.data(),
        }));
      });

      events.sort((first, second) =>
        String(second.createdAt || '').localeCompare(String(first.createdAt || ''))
      );

      callback(events);
    },
    (error) => {
      console.error('Gagal membaca notification events:', error);
      if (onError) onError(error);
    }
  );
}

export async function retryNotificationEvent(event) {
  if (!firestoreDb || !event?.id) return null;

  const now = nowIso();

  await updateDoc(doc(firestoreDb, NOTIFICATION_EVENTS_COLLECTION, event.id), {
    attempts: 0,
    errorMessage: '',
    sentAt: '',
    status: NOTIFICATION_EVENT_STATUSES.PENDING,
    updatedAt: now,
  });

  return {
    ...normalizeNotificationEvent(event),
    attempts: 0,
    errorMessage: '',
    sentAt: '',
    status: NOTIFICATION_EVENT_STATUSES.PENDING,
    updatedAt: now,
  };
}

export async function cancelNotificationEvent(event) {
  if (!firestoreDb || !event?.id) return null;

  const now = nowIso();

  await updateDoc(doc(firestoreDb, NOTIFICATION_EVENTS_COLLECTION, event.id), {
    errorMessage: 'Cancelled from admin notification console.',
    status: NOTIFICATION_EVENT_STATUSES.CANCELLED,
    updatedAt: now,
  });

  return {
    ...normalizeNotificationEvent(event),
    errorMessage: 'Cancelled from admin notification console.',
    status: NOTIFICATION_EVENT_STATUSES.CANCELLED,
    updatedAt: now,
  };
}

export const notificationEventRepository = {
  buildNotificationEventRecord,
  cancelNotificationEvent,
  createAdminNotificationEvent,
  createClientNotificationEvent,
  createNotificationEvent,
  dispatchNotificationEventNow,
  getNotificationEventStatusLabel,
  normalizeNotificationEvent,
  retryNotificationEvent,
  subscribeNotificationEvents,
};
