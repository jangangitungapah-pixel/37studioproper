import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { isOwnerEmail } from '../utils/adminPermissions.js';
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  PORTAL_ACCESS,
  canConvertAdminRequestToClient,
  createAdminPermissions,
  getPortalAccess,
} from '../utils/accountRoles.js';

function requireAccountServices() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

function getProviderId(user) {
  return user?.providerData?.find((provider) => provider?.providerId)?.providerId || 'firebase';
}

function getDisplayName(user) {
  const emailName = String(user?.email || '').split('@')[0];
  return String(user?.displayName || emailName || user?.phoneNumber || 'Pengguna').trim().slice(0, 120);
}

function isBootstrapOwner(user) {
  return Boolean(user?.emailVerified) && isOwnerEmail(user?.email);
}

function buildIdentityDocument(user, intent) {
  const now = new Date().toISOString();
  const owner = isBootstrapOwner(user);
  const role = owner
    ? ACCOUNT_ROLES.OWNER
    : intent === 'admin'
      ? ACCOUNT_ROLES.ADMIN
      : ACCOUNT_ROLES.CLIENT;
  const status = owner
    ? ACCOUNT_STATUSES.APPROVED
    : role === ACCOUNT_ROLES.ADMIN
      ? ACCOUNT_STATUSES.PENDING
      : ACCOUNT_STATUSES.ACTIVE;

  return {
    uid: user.uid,
    email: String(user.email || '').trim().slice(0, 254),
    phoneNumber: String(user.phoneNumber || '').trim().slice(0, 32),
    displayName: getDisplayName(user),
    provider: getProviderId(user).slice(0, 80),
    permissions: createAdminPermissions(role !== ACCOUNT_ROLES.CLIENT),
    role,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAccountAccessError(access, identity) {
  const error = new Error('Akun tidak memiliki akses ke portal ini.');
  error.code = `account/${access}`;
  error.access = access;
  error.identity = identity || null;
  return error;
}

export async function getAccountIdentity(user) {
  requireAccountServices();
  if (!user?.uid) return null;

  const snapshot = await getDoc(doc(firestoreDb, 'users', user.uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function ensureAccountIdentity(user, intent = 'client') {
  requireAccountServices();
  if (!user?.uid) throw new Error('User Firebase belum tersedia.');

  const userRef = doc(firestoreDb, 'users', user.uid);

  return runTransaction(firestoreDb, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (snapshot.exists()) {
      return {
        created: false,
        identity: { id: snapshot.id, ...snapshot.data() },
      };
    }

    const identity = buildIdentityDocument(user, intent);
    transaction.set(userRef, identity);
    return {
      created: true,
      identity: { id: user.uid, ...identity },
    };
  });
}

export async function resolvePortalAccount(user, portal) {
  const result = await ensureAccountIdentity(user, portal === 'admin' ? 'admin' : 'client');
  return {
    ...result,
    access: getPortalAccess(result.identity, portal),
  };
}

export async function cancelAdminRequestAndBecomeClient(user) {
  requireAccountServices();
  if (!user?.uid) throw new Error('User Firebase belum tersedia.');

  const userRef = doc(firestoreDb, 'users', user.uid);

  return runTransaction(firestoreDb, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) {
      throw createAccountAccessError(PORTAL_ACCESS.MISSING_ACCOUNT, null);
    }

    const identity = { id: snapshot.id, ...snapshot.data() };
    if (!canConvertAdminRequestToClient(identity)) {
      throw createAccountAccessError(getPortalAccess(identity, 'client'), identity);
    }

    const now = new Date().toISOString();
    const updates = {
      role: ACCOUNT_ROLES.CLIENT,
      status: ACCOUNT_STATUSES.ACTIVE,
      permissions: createAdminPermissions(false),
      adminRequestCancelledAt: now,
      updatedAt: now,
    };
    transaction.update(userRef, updates);

    return {
      ...identity,
      ...updates,
    };
  });
}

export function subscribeAccountIdentity(user, onNext, onError = console.error) {
  requireAccountServices();
  if (!user?.uid) {
    onNext(null);
    return () => {};
  }

  return onSnapshot(
    doc(firestoreDb, 'users', user.uid),
    (snapshot) => onNext(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export const accountRoleRepository = {
  cancelAdminRequestAndBecomeClient,
  ensureAccountIdentity,
  getAccountIdentity,
  resolvePortalAccount,
  subscribeAccountIdentity,
};
