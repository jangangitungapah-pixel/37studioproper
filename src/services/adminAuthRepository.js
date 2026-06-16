import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

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
            status: isOwnerEmail ? 'approved' : 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newDoc);
        }
      } catch (err) {
        console.error('Error in user doc check/create:', err);
      }

      // Listen to real-time status updates in user's Firestore document
      userDocUnsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          const userData = docSnap.exists() ? docSnap.data() : null;
          const isApproved = isOwnerEmail || (userData && userData.status === 'approved');

          callback({
            errorMessage: '',
            isAuthenticated: true,
            isReady: true,
            user: {
              ...serializeFirebaseUser(user),
              status: userData?.status || (isApproved ? 'approved' : 'pending'),
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

  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(firebaseAuth, provider);
  return serializeFirebaseUser(credential.user);
}

export async function sendPhoneOTP(phoneNumber, recaptchaVerifier) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  return await signInWithPhoneNumber(
    firebaseAuth,
    String(phoneNumber || '').trim(),
    recaptchaVerifier
  );
}

export async function signOutAdmin() {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return;
  }
  await signOut(firebaseAuth);
}

export const adminAuthRepository = {
  getAdminAuthErrorMessage,
  signInAdmin,
  signUpAdmin,
  signInWithGoogle,
  sendPhoneOTP,
  signOutAdmin,
  subscribeAdminAuth
};
