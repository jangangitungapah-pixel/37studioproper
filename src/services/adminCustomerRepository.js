import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export function subscribeManualCustomers(options, callback, onError) {
  let opts = {};
  let cb = callback;
  let errCb = onError;

  if (typeof options === 'function') {
    errCb = callback;
    cb = options;
  } else if (options && typeof options === 'object') {
    opts = options;
  }

  if (!isFirebaseConfigured || !firestoreDb) {
    if (errCb) errCb(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const customersRef = collection(firestoreDb, 'customers');
  const constraints = [];

  constraints.push(orderBy('createdAt', 'desc'));

  if (opts.limitCount) {
    constraints.push(limit(opts.limitCount));
  }

  const q = query(customersRef, ...constraints);

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
      cb(customers);
    },
    (error) => {
      console.error('Error fetching customers from Firestore:', error);
      if (errCb) errCb(error);
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

function normalizeCustomerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;

  return digits;
}

export async function findCustomerByPhone(phone) {
  if (!isFirebaseConfigured || !firestoreDb) return null;

  const phoneKey = normalizeCustomerPhone(phone);
  if (!phoneKey) return null;

  const customersRef = collection(firestoreDb, 'customers');
  const snapshot = await getDocs(query(customersRef, where('phoneKey', '==', phoneKey)));
  const exactProfile = snapshot.docs.find((customerDoc) => customerDoc.data().authUid);
  const selected = exactProfile || snapshot.docs[0];

  return selected ? { id: selected.id, ...selected.data() } : null;
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
  findCustomerByPhone,
  migrateLocalCustomersToFirestore,
};


const ACTIVE_CUSTOMER_FOLLOW_UP_STATUSES = ['open', 'in_progress', 'snoozed'];

export function subscribeCustomerFollowUpTasks(callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb) {
    onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const taskCollection = collection(firestoreDb, 'customerFollowUpTasks');
  const activeQuery = query(
    taskCollection,
    where('status', 'in', ACTIVE_CUSTOMER_FOLLOW_UP_STATUSES),
    orderBy('dueAt', 'asc'),
    orderBy('dueTime', 'asc'),
    limit(200),
  );
  const completedQuery = query(
    taskCollection,
    where('status', '==', 'completed'),
    orderBy('completedAt', 'desc'),
    limit(50),
  );

  let activeTasks = [];
  let completedTasks = [];
  let activeReady = false;
  let completedReady = false;
  let subscriptionError = null;
  const fail = (error) => {
    if (subscriptionError) return;
    subscriptionError = error;
    onError(error);
  };
  const emit = () => {
    if (subscriptionError || !activeReady || !completedReady) return;
    callback([...activeTasks, ...completedTasks]);
  };

  const unsubscribeActive = onSnapshot(
    activeQuery,
    (snapshot) => {
      activeTasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      activeReady = true;
      emit();
    },
    fail,
  );
  const unsubscribeCompleted = onSnapshot(
    completedQuery,
    (snapshot) => {
      completedTasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      completedReady = true;
      emit();
    },
    fail,
  );

  return () => {
    unsubscribeActive();
    unsubscribeCompleted();
  };
}

export function subscribeCustomerFollowUpEvents(taskId, callback, onError = console.error) {
  if (!isFirebaseConfigured || !firestoreDb || !taskId) {
    onError(new Error('Histori follow-up tidak tersedia.'));
    return () => {};
  }
  const eventCollection = collection(firestoreDb, 'customerFollowUpEvents');
  const eventQuery = query(
    eventCollection,
    where('taskId', '==', taskId),
    orderBy('createdAt', 'desc'),
    limit(30),
  );
  return onSnapshot(
    eventQuery,
    (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}
