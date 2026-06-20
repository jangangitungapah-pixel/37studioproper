import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';

export const NOTIFICATION_SUBSCRIPTIONS_COLLECTION = 'notificationSubscriptions';

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

export function normalizeNotificationPermission(permission) {
  if (permission === true) return 'granted';
  if (permission === false) return 'default';

  const normalized = cleanString(permission, 40).toLowerCase();

  if (['default', 'granted', 'denied', 'unsupported'].includes(normalized)) {
    return normalized;
  }

  return 'unknown';
}

function getUserAgent() {
  if (typeof navigator === 'undefined') return '';

  return cleanString(navigator.userAgent, 600);
}

export function buildNotificationSubscriptionRecord({
  existingCreatedAt = '',
  reason = 'snapshot',
  role = 'client',
  state = {},
  user,
}) {
  const timestamp = nowIso();
  const normalizedRole = role === 'admin' ? 'admin' : 'client';

  return {
    createdAt: existingCreatedAt || timestamp,
    email: cleanString(user?.email, 254),
    lastSyncReason: cleanString(reason, 80),
    oneSignalId: cleanString(state.oneSignalId, 160),
    optedIn: Boolean(state.optedIn),
    permission: normalizeNotificationPermission(state.permission),
    platform: 'web',
    role: normalizedRole,
    source: 'onesignal-web',
    subscriptionId: cleanString(state.subscriptionId, 160),
    uid: cleanString(user?.uid, 128),
    updatedAt: timestamp,
    userAgent: getUserAgent(),
  };
}

export function isNotificationSubscriptionActive(recordOrState) {
  if (!recordOrState) return false;

  return Boolean(
    recordOrState.optedIn &&
      recordOrState.subscriptionId &&
      normalizeNotificationPermission(recordOrState.permission) === 'granted',
  );
}

export async function syncNotificationSubscription({
  reason = 'snapshot',
  role = 'client',
  state = {},
  user,
} = {}) {
  if (!firestoreDb || !user?.uid) return null;

  const subscriptionRef = doc(
    firestoreDb,
    NOTIFICATION_SUBSCRIPTIONS_COLLECTION,
    user.uid,
  );

  let existingCreatedAt = '';

  try {
    const existingSnapshot = await getDoc(subscriptionRef);
    if (existingSnapshot.exists()) {
      existingCreatedAt = existingSnapshot.data()?.createdAt || '';
    }
  } catch (error) {
    console.warn('[notification-subscriptions] Failed to read existing subscription:', error);
  }

  const record = buildNotificationSubscriptionRecord({
    existingCreatedAt,
    reason,
    role,
    state,
    user,
  });

  await setDoc(subscriptionRef, record, { merge: true });

  return record;
}

export const notificationSubscriptionRepository = {
  buildNotificationSubscriptionRecord,
  isNotificationSubscriptionActive,
  normalizeNotificationPermission,
  syncNotificationSubscription,
};
