import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';

export const NOTIFICATION_SUBSCRIPTIONS_COLLECTION = 'notificationSubscriptions';
export const NOTIFICATION_SUBSCRIPTION_DEVICES_COLLECTION = 'notificationSubscriptionDevices';

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDocumentIdPart(value, fallback = 'unknown') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);

  return cleaned || fallback;
}

export function createNotificationDeviceId(uid, subscriptionId) {
  return [
    cleanDocumentIdPart(uid, 'user'),
    cleanDocumentIdPart(subscriptionId, 'subscription'),
  ].join('__');
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

  if (record.subscriptionId) {
    const deviceId = createNotificationDeviceId(record.uid, record.subscriptionId);
    const deviceRecord = {
      ...record,
      deviceId,
      id: deviceId,
      isActive: isNotificationSubscriptionActive(record),
      lastSeenAt: record.updatedAt,
    };

    await setDoc(
      doc(firestoreDb, NOTIFICATION_SUBSCRIPTION_DEVICES_COLLECTION, deviceId),
      deviceRecord,
      { merge: true },
    );

    return {
      ...record,
      activeDeviceId: deviceId,
    };
  }

  return record;
}

export async function fetchNotificationSubscription(uid) {
  if (!firestoreDb || !uid) return null;

  const subscriptionRef = doc(
    firestoreDb,
    NOTIFICATION_SUBSCRIPTIONS_COLLECTION,
    uid,
  );

  const [legacySnapshot, deviceSnapshot] = await Promise.all([
    getDoc(subscriptionRef),
    getDocs(query(
      collection(firestoreDb, NOTIFICATION_SUBSCRIPTION_DEVICES_COLLECTION),
      where('uid', '==', uid),
    )),
  ]);

  const legacyRecord = legacySnapshot.exists()
    ? { id: legacySnapshot.id, ...legacySnapshot.data() }
    : null;

  const devices = deviceSnapshot.docs
    .map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }))
    .sort((first, second) => String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')));

  const activeDevices = devices.filter(isNotificationSubscriptionActive);

  return {
    ...(legacyRecord || {}),
    activeDeviceCount: activeDevices.length,
    activeDevices,
    devices,
    id: uid,
    latestDevice: activeDevices[0] || devices[0] || null,
    uid,
  };
}

export const notificationSubscriptionRepository = {
  buildNotificationSubscriptionRecord,
  createNotificationDeviceId,
  fetchNotificationSubscription,
  isNotificationSubscriptionActive,
  normalizeNotificationPermission,
  syncNotificationSubscription,
};
