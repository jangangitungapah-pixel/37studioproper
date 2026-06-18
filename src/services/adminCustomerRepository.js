import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export function subscribeManualCustomers(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const customersRef = collection(firestoreDb, 'customers');
  const q = query(customersRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const customers = [];
      snapshot.forEach((doc) => {
        customers.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(customers);
    },
    (error) => {
      console.error('Error fetching customers from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

export async function createManualCustomer(customer) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const customerId = customer.id || doc(collection(firestoreDb, 'customers')).id;
  const docRef = doc(firestoreDb, 'customers', customerId);
  
  const cleanCustomer = {
    ...customer,
    id: customerId,
    createdAt: customer.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, cleanCustomer);
  return cleanCustomer;
}

export async function updateManualCustomer(customer) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!customer.id) {
    throw new Error('Customer ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, 'customers', customer.id);
  const cleanCustomer = {
    ...customer,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, cleanCustomer, { merge: true });
  return cleanCustomer;
}

export async function deleteManualCustomer(customerId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const docRef = doc(firestoreDb, 'customers', customerId);
  await deleteDoc(docRef);
}

export async function migrateLocalCustomersToFirestore(localCustomers) {
  if (!isFirebaseConfigured || !firestoreDb || !Array.isArray(localCustomers) || localCustomers.length === 0) {
    return;
  }

  try {
    const customersRef = collection(firestoreDb, 'customers');
    const snapshot = await getDocs(customersRef);
    const existingIds = new Set();
    snapshot.forEach((docSnap) => {
      existingIds.add(docSnap.id);
    });

    const unsyncedCustomers = localCustomers.filter((customer) => {
      return customer.id && !existingIds.has(customer.id);
    });

    if (unsyncedCustomers.length > 0) {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < unsyncedCustomers.length; i += BATCH_LIMIT) {
        const batch = writeBatch(firestoreDb);
        const chunk = unsyncedCustomers.slice(i, i + BATCH_LIMIT);

        chunk.forEach((customer) => {
          const customerId = customer.id || doc(customersRef).id;
          const docRef = doc(firestoreDb, 'customers', customerId);
          batch.set(docRef, {
            ...customer,
            id: customerId,
            createdAt: customer.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        await batch.commit();
      }
      console.log(`Successfully migrated ${unsyncedCustomers.length} local customers to Firestore.`);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('37musicstudio.customers.manual.v1');
    }
  } catch (error) {
    console.error('Error during local customers migration:', error);
  }
}

export const adminCustomerRepository = {
  subscribeManualCustomers,
  createManualCustomer,
  updateManualCustomer,
  deleteManualCustomer,
  migrateLocalCustomersToFirestore,
};
