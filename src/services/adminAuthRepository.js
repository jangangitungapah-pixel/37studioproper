import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { sendNewUserNotificationEmail } from './emailService.js';
import { defaultAdminPermissions, normalizeAdminPermissions } from '../utils/adminPermissions.js';
import { ACCOUNT_SETTINGS_STORAGE_KEY } from '../utils/accountSettings.js';

function createUnauthenticatedState(errorMessage = '') {
  return {
    errorMessage,
    isAuthenticated: false,
    isReady: true,
    user: null
  };
}

function serializeFirebaseUser(user) {
  if (!user) return null;
  return {
    displayName: user.displayName || user.phoneNumber || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    emailVerified: Boolean(user.emailVerified),
    uid: user.uid
  };
}

function checkIsOwnerEmail(user) {
  if (!user) return false;
  const email = user.email || user.providerData?.find(p => p.email)?.email || '';
  return String(email).trim().toLowerCase() === 'marsicprod@gmail.com';
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

  return error?.message || 'Login Firebase gagal. Periksa koneksi dan kredensial Anda.';
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

      // Check or create Firestore document for the user
      const uid = user.uid;
      const userDocRef = doc(firestoreDb, 'users', uid);
      const isOwnerEmail = checkIsOwnerEmail(user);

      try {
        const userSnap = await getDoc(userDocRef);
        
        if (!userSnap.exists()) {
          const newDoc = {
            uid: uid,
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
            displayName: user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'User',
            provider: user.providerData[0]?.providerId || 'unknown',
            permissions: defaultAdminPermissions,
            role: isOwnerEmail ? 'owner' : 'admin',
            status: isOwnerEmail ? 'approved' : 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newDoc);
          if (!isOwnerEmail) {
            sendNewUserNotificationEmail(newDoc).catch((err) =>
              console.error('Failed to trigger email notification:', err)
            );
          }
        }
      } catch (err) {
        console.error('Error in user doc check/create:', err);
      }

      // Listen to real-time status updates in user's Firestore document
      userDocUnsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          const userData = docSnap.exists() ? docSnap.data() : null;
          const hasExplicitRole = Boolean(userData?.role);
          const isOwner = userData?.role === 'owner' || (!hasExplicitRole && isOwnerEmail);
          const isApproved = isOwner || (userData && userData.status === 'approved');

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
              status: userData?.status || (isApproved ? 'approved' : 'pending'),
              role: userData?.role || (isOwner ? 'owner' : 'admin'),
              isOwner,
              permissions: normalizeAdminPermissions(userData?.permissions),
              isApproved
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
              status: isOwnerEmail ? 'approved' : 'pending',
                role: isOwnerEmail ? 'owner' : 'admin',
                permissions: defaultAdminPermissions,
              isApproved: isOwnerEmail
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
  hasGoogleRedirectPending,
  signInAdmin,
  signUpAdmin,
  signInWithGoogle,
  handleRedirectResult,
  sendPhoneOTP,
  sendAdminPasswordReset,
  signOutAdmin,
  updateAdminProfile,
  subscribeAdminAuth
};
