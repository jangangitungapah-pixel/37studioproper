import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

const firebaseEnv = import.meta.env || {};

export const firebaseConfig = {
  apiKey: firebaseEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: firebaseEnv.VITE_FIREBASE_APP_ID || '',
  measurementId: firebaseEnv.VITE_FIREBASE_MEASUREMENT_ID || ''
};

export const isFirebaseConfigured = requiredEnvKeys.every((key) => Boolean(firebaseEnv[key]));

export const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
let db = null;
if (firebaseApp) {
  try {
    db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    console.warn('Firestore initialization with persistent cache failed, falling back to getFirestore:', error);
    db = getFirestore(firebaseApp);
  }
}
export const firestoreDb = db;


