import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
  writeBatch
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
    updatedAt: new Date().toISOString()
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
    updatedAt: new Date().toISOString()
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

  const customersRef = collection(firestoreDb, 'customers');
  const snapshot = await getDocs(customersRef);
  
  // Only migrate if Firestore collection is currently empty
  if (snapshot.empty) {
    const batch = writeBatch(firestoreDb);
    localCustomers.forEach((customer) => {
      const customerId = customer.id || doc(customersRef).id;
      const docRef = doc(firestoreDb, 'customers', customerId);
      batch.set(docRef, {
        ...customer,
        id: customerId,
        createdAt: customer.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
    console.log(`Successfully migrated ${localCustomers.length} local customers to Firestore.`);
  }
}

export const adminCustomerRepository = {
  subscribeManualCustomers,
  createManualCustomer,
  updateManualCustomer,
  deleteManualCustomer,
  migrateLocalCustomersToFirestore
};
