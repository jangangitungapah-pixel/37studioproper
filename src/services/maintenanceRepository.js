import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

function normalizeDocument(document, fallbackId = '') {
  const data = document && typeof document === 'object' ? document : {};
  return {
    ...data,
    id: String(data.id || fallbackId || '').trim(),
  };
}

function subscribeCollection(collectionName, orderField, callback, onError, maxResults = 200) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError?.(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }
  const reference = collection(firestoreDb, collectionName);
  const source = query(reference, orderBy(orderField, 'desc'), limit(maxResults));
  return onSnapshot(
    source,
    (snapshot) => {
      const rows = [];
      snapshot.forEach((document) => rows.push(normalizeDocument({
        id: document.id,
        ...document.data(),
      }, document.id)));
      callback(rows);
    },
    (error) => {
      console.error('Gagal memuat ' + collectionName + ':', error);
      onError?.(error);
    },
  );
}

export function subscribeMaintenanceWorkOrders(callback, onError, maxResults = 200) {
  return subscribeCollection('maintenanceWorkOrders', 'updatedAt', callback, onError, maxResults);
}

export function subscribeMaintenanceEvents(callback, onError, maxResults = 500) {
  return subscribeCollection('maintenanceEvents', 'createdAt', callback, onError, maxResults);
}

export const maintenanceRepository = {
  subscribeMaintenanceWorkOrders,
  subscribeMaintenanceEvents,
};
