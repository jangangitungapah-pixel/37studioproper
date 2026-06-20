import { collection, doc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';

export const NOTIFICATION_EVENTS_COLLECTION = 'notificationEvents';

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_MESSAGE_CREATED: 'booking_message_created',
  BOOKING_REJECTED: 'booking_rejected',
  BOOKING_REQUEST_CREATED: 'booking_request_created',
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

  return {
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
  };
}

export async function createNotificationEvent(input = {}) {
  if (!firestoreDb || !input?.user?.uid) return null;

  const record = buildNotificationEventRecord(input);
  const eventRef = doc(collection(firestoreDb, NOTIFICATION_EVENTS_COLLECTION), record.id);

  await setDoc(eventRef, record);

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

export const notificationEventRepository = {
  buildNotificationEventRecord,
  createAdminNotificationEvent,
  createClientNotificationEvent,
  createNotificationEvent,
};
