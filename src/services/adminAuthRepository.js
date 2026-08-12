import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  browserLocalPersistence,
  setPersistence,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { sendNewUserNotificationEmail } from './emailService.js';
import {
  defaultAdminPermissions,
  normalizeAdminPermissionsForRole,
  isOwnerEmail,
} from '../utils/adminPermissions.js';
import { ACCOUNT_SETTINGS_STORAGE_KEY } from '../utils/accountSettings.js';
import {
  createAccountAccessError,
  ensureAccountIdentity,
} from './accountRoleRepository.js';
import { ACCOUNT_ROLES, PORTAL_ACCESS, getPortalAccess } from '../utils/accountRoles.js';

function createUnauthenticatedState(errorMessage = '') {
  return {
    errorMessage,
    isAuthenticated: false,
    isReady: true,
    user: null
  };
}

function getFirebaseUserProviderIds(user) {
  return Array.from(
    new Set(
      (Array.isArray(user?.providerData) ? user.providerData : [])
        .map((provider) => String(provider?.providerId || '').trim())
        .filter(Boolean)
    )
  );
}

function serializeFirebaseUser(user) {
  if (!user) return null;

  const providerIds = getFirebaseUserProviderIds(user);

  return {
    displayName: user.displayName || user.phoneNumber || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    emailVerified: Boolean(user.emailVerified),
    provider: providerIds.join(','),
    providerIds,
    uid: user.uid
  };
}

function checkIsOwnerEmail(user) {
  if (!user) return false;
  const email = user.email || user.providerData?.find(p => p.email)?.email || '';
  return user.emailVerified === true && isOwnerEmail(email);
}

const GOOGLE_REDIRECT_PENDING_KEY = '37musicstudio.auth.googleRedirectPending.v1';

function safeSessionStorageSet(key, value) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Some browsers can block storage in strict/private contexts.
  }
}

function safeSessionStorageGet(key) {
  if (typeof window === 'undefined') return '';

  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSessionStorageRemove(key) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Some browsers can block storage in strict/private contexts.
  }
}

function markGoogleRedirectPending() {
  safeSessionStorageSet(GOOGLE_REDIRECT_PENDING_KEY, '1');
}

function clearGoogleRedirectPending() {
  safeSessionStorageRemove(GOOGLE_REDIRECT_PENDING_KEY);
}

export function hasGoogleRedirectPending() {
  return safeSessionStorageGet(GOOGLE_REDIRECT_PENDING_KEY) === '1';
}

async function ensureAuthPersistence() {
  if (!firebaseAuth) return;

  await setPersistence(firebaseAuth, browserLocalPersistence);
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  return provider;
}

function shouldFallbackToRedirect(error) {
  const code = error?.code || '';

  return code === 'auth/popup-blocked' ||
    code === 'auth/cancelled-popup-request';
}

export function getAdminAuthErrorMessage(error) {
  const code = error?.code || '';

  if (code === 'auth/invalid-email') {
    return 'Format email admin belum valid.';
  }
  if (code === 'auth/user-disabled') {
    return 'Akun admin ini sedang dinonaktifkan.';
  }
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Email/password belum cocok atau tidak terdaftar.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan login. Silakan tunggu beberapa saat.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Metode login ini belum diaktifkan di Firebase Console.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi ke Firebase gagal. Periksa koneksi internet Anda.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Domain web app belum diizinkan di Firebase Authentication Authorized domains.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup Google diblokir browser. Izinkan pop-up atau coba lagi.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Login Google dibatalkan sebelum selesai.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Email ini sudah terdaftar dengan metode login lain.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Email ini sudah digunakan oleh akun lain.';
  }
  if (code === 'auth/weak-password') {
    return 'Kata sandi terlalu lemah. Minimal 6 karakter.';
  }
  if (code === 'auth/invalid-verification-code') {
    return 'Kode OTP yang dimasukkan salah.';
  }
  if (code === 'auth/code-expired') {
    return 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang.';
  }
  if (code === `account/${PORTAL_ACCESS.WRONG_PORTAL_CLIENT}`) {
    return 'Akun ini terdaftar sebagai client dan tidak memiliki izin masuk ke Portal Admin.';
  }
  if (code === `account/${PORTAL_ACCESS.ADMIN_BLOCKED}`) {
    return 'Request akun admin ini telah ditolak atau tidak lagi aktif.';
  }
  if (String(code).startsWith('account/')) {
    return 'Role akun ini tidak sesuai untuk Portal Admin.';
  }

  return error?.message || 'Login Firebase gagal. Periksa koneksi dan kredensial Anda.';
}

export function getAdminPasswordErrorMessage(error) {
  const code = error?.code || '';

  if (code === 'account-password/current-password-required') {
    return 'Masukkan password saat ini untuk memverifikasi perubahan.';
  }
  if (code === 'account-password/email-required') {
    return 'Akun ini belum memiliki email yang dapat dipakai untuk login password.';
  }
  if (code === 'account-password/unsupported-provider') {
    return 'Akun ini belum memiliki provider Google atau Email/Password yang dapat dipakai untuk verifikasi.';
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Password saat ini salah. Periksa kembali lalu coba lagi.';
  }
  if (code === 'auth/weak-password') {
    return 'Password baru terlalu lemah. Gunakan minimal 6 karakter.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Sesi login sudah terlalu lama. Login ulang lalu coba ganti password lagi.';
  }
  if (code === 'auth/user-mismatch') {
    return 'Akun Google yang dipilih berbeda dari akun yang sedang login.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup verifikasi Google diblokir browser. Izinkan pop-up lalu coba lagi.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Verifikasi Google dibatalkan sebelum selesai.';
  }
  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use'
  ) {
    return 'Kredensial email/password ini sudah terhubung ke akun Firebase lain.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan keamanan. Tunggu beberapa saat lalu coba lagi.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi ke Firebase gagal saat memperbarui password.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Provider Email/Password belum diaktifkan di Firebase Authentication.';
  }

  return error?.message || 'Password akun belum berhasil diperbarui.';
}

async function ensureAdminAccount(user) {
  const result = await ensureAccountIdentity(user, 'admin');
  const access = getPortalAccess(result.identity, 'admin');

  if (result.created && result.identity.role === ACCOUNT_ROLES.ADMIN) {
    sendNewUserNotificationEmail(result.identity).catch((error) =>
      console.error('Failed to trigger email notification:', error)
    );
  }

  return { ...result, access };
}

function assertAdminPortalIntent(result) {
  if ([PORTAL_ACCESS.WRONG_PORTAL_CLIENT, PORTAL_ACCESS.ADMIN_BLOCKED, PORTAL_ACCESS.INVALID_ACCOUNT, PORTAL_ACCESS.MISSING_ACCOUNT].includes(result.access)) {
    throw createAccountAccessError(result.access, result.identity);
  }
  return result;
}

export function subscribeAdminAuth(callback) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    callback(createUnauthenticatedState('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  let userDocUnsubscribe = null;

  const authUnsubscribe = onAuthStateChanged(
    firebaseAuth,
    async (user) => {
      // Clean up previous user document subscription if user switches
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      if (!user) {
        callback({
          errorMessage: '',
          isAuthenticated: false,
          isReady: true,
          user: null
        });
        return;
      }

      const uid = user.uid;
      const userDocRef = doc(firestoreDb, 'users', uid);
      const isOwnerEmail = checkIsOwnerEmail(user);

      try {
        await ensureAdminAccount(user);
      } catch (err) {
        console.error('Error in user doc check/create:', err);
        callback({
          errorMessage: getAdminAuthErrorMessage(err),
          isAuthenticated: true,
          isReady: true,
          user: {
            ...serializeFirebaseUser(user),
            role: err?.identity?.role || '',
            status: err?.identity?.status || '',
            access: err?.access || PORTAL_ACCESS.INVALID_ACCOUNT,
            permissions: err?.identity
              ? normalizeAdminPermissionsForRole(err.identity.permissions, err.identity.role)
              : defaultAdminPermissions,
            isApproved: false,
            isOwner: false,
            guardId: err?.identity?.guardId || null,
          }
        });
        return;
      }

      // Listen to real-time status updates in user's Firestore document
      userDocUnsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          const userData = docSnap.exists() ? docSnap.data() : null;
          const isOwner = userData?.role === 'owner';
          const isAdminPortalRole = isOwner ||
            userData?.role === ACCOUNT_ROLES.ADMIN ||
            userData?.role === ACCOUNT_ROLES.STUDIO_GUARD;
          const isApproved = isOwner || (isAdminPortalRole && userData?.status === 'approved');
          const access = getPortalAccess(userData, 'admin');

          if (userData?.preferences && typeof window !== 'undefined') {
            try {
              const storageKey = ACCOUNT_SETTINGS_STORAGE_KEY + '.' + uid;
              window.localStorage.setItem(storageKey, JSON.stringify(userData.preferences));
            } catch (e) {
              console.warn('Gagal menyimpan preferensi dari Firestore ke local storage:', e);
            }
          }

          callback({
            errorMessage: '',
            isAuthenticated: true,
            isReady: true,
            user: {
              ...serializeFirebaseUser(user),
              status: userData?.status || 'pending',
              role: userData?.role || 'admin',
              isOwner,
              permissions: normalizeAdminPermissionsForRole(userData?.permissions, userData?.role),
              isApproved,
              access,
              guardId: userData?.guardId || null,
            }
          });
        },
        (err) => {
          console.error('Error listening to user document:', err);
          callback({
            errorMessage: 'Gagal menyinkronkan status persetujuan dari Firestore.',
            isAuthenticated: true,
            isReady: true,
            user: {
              ...serializeFirebaseUser(user),
              status: 'pending',
                role: 'admin',
                permissions: defaultAdminPermissions,
                isApproved: false,
                access: PORTAL_ACCESS.INVALID_ACCOUNT,
            }
          });
        }
      );
    },
    (error) => {
      callback(createUnauthenticatedState(getAdminAuthErrorMessage(error)));
    }
  );

  return () => {
    authUnsubscribe();
    if (userDocUnsubscribe) {
      userDocUnsubscribe();
    }
  };
}

export async function signInAdmin({ email, password }) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  await ensureAuthPersistence();

  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    String(email || '').trim(),
    String(password || '')
  );

  assertAdminPortalIntent(await ensureAdminAccount(credential.user));

  return serializeFirebaseUser(credential.user);
}

export async function signUpAdmin({ email, password }) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  await ensureAuthPersistence();

  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    String(email || '').trim(),
    String(password || '')
  );

  assertAdminPortalIntent(await ensureAdminAccount(credential.user));

  return serializeFirebaseUser(credential.user);
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  await ensureAuthPersistence();

  const provider = createGoogleProvider();

  try {
    const credential = await signInWithPopup(firebaseAuth, provider);
    clearGoogleRedirectPending();

    assertAdminPortalIntent(await ensureAdminAccount(credential.user));

    return serializeFirebaseUser(credential.user);
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      markGoogleRedirectPending();
      await signInWithRedirect(firebaseAuth, provider);

      return null;
    }

    throw error;
  }
}

export async function handleRedirectResult() {
  if (!isFirebaseConfigured || !firebaseAuth) return null;

  await ensureAuthPersistence();

  try {
    const credential = await getRedirectResult(firebaseAuth);
    clearGoogleRedirectPending();

    if (credential) {
      assertAdminPortalIntent(await ensureAdminAccount(credential.user));
    }

    return credential ? serializeFirebaseUser(credential.user) : null;
  } catch (error) {
    clearGoogleRedirectPending();
    throw error;
  }
}

export async function sendPhoneOTP(phoneNumber, recaptchaVerifier) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  await ensureAuthPersistence();

  return await signInWithPhoneNumber(
    firebaseAuth,
    String(phoneNumber || '').trim(),
    recaptchaVerifier
  );
}

export async function ensureCurrentAdminAccess() {
  if (!firebaseAuth?.currentUser) {
    throw new Error('Akun Firebase belum login.');
  }

  const result = await ensureAdminAccount(firebaseAuth.currentUser);
  assertAdminPortalIntent(result);
  return result;
}

/**
 * Re-establishes a recent Firebase session before a protected admin operation.
 * The password only lives in the caller's in-memory form state and is never
 * written to storage. Google-capable accounts use the provider popup whenever
 * a password was not supplied.
 */
export async function reauthenticateCurrentAdmin({ password = '' } = {}) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const currentUser = firebaseAuth.currentUser;
  const cleanPassword = String(password || '');
  const cleanEmail = String(currentUser?.email || '').trim();
  const providerIds = getFirebaseUserProviderIds(currentUser);

  if (!currentUser) {
    throw new Error('Akun belum login.');
  }

  try {
    let verification = '';

    if (cleanPassword) {
      if (!cleanEmail) {
        const error = new Error('Email akun belum tersedia.');
        error.code = 'account-password/email-required';
        throw error;
      }

      await reauthenticateWithCredential(
        currentUser,
        EmailAuthProvider.credential(cleanEmail, cleanPassword),
      );
      verification = 'password';
    } else if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(currentUser, createGoogleProvider());
      verification = 'google';
    } else if (providerIds.includes('password')) {
      const error = new Error('Password saat ini wajib diisi.');
      error.code = 'account-password/current-password-required';
      throw error;
    } else {
      const error = new Error('Provider akun belum mendukung verifikasi ulang.');
      error.code = 'account-password/unsupported-provider';
      throw error;
    }

    const token = await currentUser.getIdToken(true);

    return {
      token,
      user: serializeFirebaseUser(currentUser),
      verification,
    };
  } catch (error) {
    if (String(error?.code || '').startsWith('account-password/')) {
      throw error;
    }

    const normalizedError = new Error(getAdminPasswordErrorMessage(error));
    normalizedError.code = error?.code || 'account-password/reauthentication-failed';
    throw normalizedError;
  }
}

export async function updateAdminProfile({ displayName }) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const currentUser = firebaseAuth.currentUser;
  const cleanDisplayName = String(displayName || '').trim();

  if (!currentUser) {
    throw new Error('Admin belum login.');
  }

  if (!cleanDisplayName) {
    throw new Error('Nama tampilan wajib diisi.');
  }

  await updateProfile(currentUser, {
    displayName: cleanDisplayName,
  });

  try {
    await setDoc(
      doc(firestoreDb, 'users', currentUser.uid),
      {
        displayName: cleanDisplayName,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Display name Firebase Auth tersimpan, tetapi Firestore profile belum tersinkron:', error);
  }

  return {
    ...serializeFirebaseUser(firebaseAuth.currentUser),
    displayName: cleanDisplayName,
  };
}

export async function changeAdminPassword({
  currentPassword = '',
  newPassword = '',
} = {}) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const currentUser = firebaseAuth.currentUser;
  const cleanEmail = String(currentUser?.email || '').trim();
  const cleanCurrentPassword = String(currentPassword || '');
  const cleanNewPassword = String(newPassword || '');
  const providerIds = getFirebaseUserProviderIds(currentUser);
  const hasGoogleProvider = providerIds.includes('google.com');
  const hasPasswordProvider = providerIds.includes('password');

  if (!currentUser) {
    throw new Error('Akun belum login.');
  }

  if (!cleanEmail) {
    const error = new Error('Email akun belum tersedia.');
    error.code = 'account-password/email-required';
    throw error;
  }

  if (cleanNewPassword.length < 6) {
    const error = new Error('Password baru minimal 6 karakter.');
    error.code = 'auth/weak-password';
    throw error;
  }

  try {
    /*
     * If a password provider already exists and the user supplied the
     * current password, use it as the recent-login proof. This also lets
     * Google+password accounts avoid a popup when they know the old password.
     */
    if (hasPasswordProvider && cleanCurrentPassword) {
      const currentCredential = EmailAuthProvider.credential(
        cleanEmail,
        cleanCurrentPassword
      );

      await reauthenticateWithCredential(
        currentUser,
        currentCredential
      );

      await updatePassword(
        currentUser,
        cleanNewPassword
      );

      return {
        mode: 'updated',
        verification: 'password',
        user: serializeFirebaseUser(currentUser),
      };
    }

    /*
     * Google-linked accounts can use Google as the recent-login proof.
     * Google-only accounts then link email/password to the same Firebase UID.
     */
    if (hasGoogleProvider) {
      await reauthenticateWithPopup(
        currentUser,
        createGoogleProvider()
      );

      if (hasPasswordProvider) {
        await updatePassword(currentUser, cleanNewPassword);

        return {
          mode: 'updated',
          verification: 'google',
          user: serializeFirebaseUser(currentUser),
        };
      }

      const passwordCredential = EmailAuthProvider.credential(
        cleanEmail,
        cleanNewPassword
      );

      try {
        const linkedCredential = await linkWithCredential(
          currentUser,
          passwordCredential
        );

        return {
          mode: 'linked',
          verification: 'google',
          user: serializeFirebaseUser(linkedCredential.user),
        };
      } catch (linkError) {
        /*
         * A stale provider snapshot can report Google-only even though
         * password is already linked. After successful Google re-auth,
         * updating the password is safe in that specific case.
         */
        if (linkError?.code === 'auth/provider-already-linked') {
          await updatePassword(currentUser, cleanNewPassword);

          return {
            mode: 'updated',
            verification: 'google',
            user: serializeFirebaseUser(currentUser),
          };
        }

        throw linkError;
      }
    }

    if (hasPasswordProvider) {
      const error = new Error('Password saat ini wajib diisi.');
      error.code = 'account-password/current-password-required';
      throw error;
    }

    const error = new Error('Provider akun belum mendukung perubahan password.');
    error.code = 'account-password/unsupported-provider';
    throw error;
  } catch (error) {
    if (String(error?.code || '').startsWith('account-password/')) {
      throw error;
    }

    const normalizedError = new Error(
      getAdminPasswordErrorMessage(error)
    );

    normalizedError.code = error?.code || 'account-password/update-failed';
    throw normalizedError;
  }
}

export async function sendAdminPasswordReset(email) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const cleanEmail = String(email || '').trim();

  if (!cleanEmail) {
    throw new Error('Email akun belum tersedia.');
  }

  await sendPasswordResetEmail(firebaseAuth, cleanEmail);

  return true;
}

export async function signOutAdmin() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return;
  }
  await signOut(firebaseAuth);
}

export const adminAuthRepository = {
  getAdminAuthErrorMessage,
  getAdminPasswordErrorMessage,
  changeAdminPassword,
  hasGoogleRedirectPending,
  signInAdmin,
  signUpAdmin,
  signInWithGoogle,
  handleRedirectResult,
  sendPhoneOTP,
  ensureCurrentAdminAccess,
  reauthenticateCurrentAdmin,
  sendAdminPasswordReset,
  signOutAdmin,
  updateAdminProfile,
  subscribeAdminAuth
};
