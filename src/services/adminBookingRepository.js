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

export function subscribeManualBookings(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const bookingsRef = collection(firestoreDb, 'bookings');
  const q = query(bookingsRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const bookings = [];
      snapshot.forEach((doc) => {
        bookings.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(bookings);
    },
    (error) => {
      console.error('Error fetching bookings from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

export async function createManualBooking(booking) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const bookingId = booking.id || doc(collection(firestoreDb, 'bookings')).id;
  const docRef = doc(firestoreDb, 'bookings', bookingId);
  
  const cleanBooking = {
    ...booking,
    id: bookingId,
    createdAt: booking.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(docRef, cleanBooking);
  return cleanBooking;
}

export async function updateManualBooking(booking) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!booking.id) {
    throw new Error('Booking ID tidak boleh kosong.');
  }

  const docRef = doc(firestoreDb, 'bookings', booking.id);
  const cleanBooking = {
    ...booking,
    updatedAt: new Date().toISOString()
  };

  await setDoc(docRef, cleanBooking, { merge: true });
  return cleanBooking;
}

export async function deleteManualBooking(bookingId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const docRef = doc(firestoreDb, 'bookings', bookingId);
  await deleteDoc(docRef);
}

export async function migrateLocalBookingsToFirestore(localBookings) {
  if (!isFirebaseConfigured || !firestoreDb || !Array.isArray(localBookings) || localBookings.length === 0) {
    return;
  }

  const bookingsRef = collection(firestoreDb, 'bookings');
  const snapshot = await getDocs(bookingsRef);
  
  // Only migrate if Firestore collection is currently empty
  if (snapshot.empty) {
    const batch = writeBatch(firestoreDb);
    localBookings.forEach((booking) => {
      const bookingId = booking.id || doc(bookingsRef).id;
      const docRef = doc(firestoreDb, 'bookings', bookingId);
      batch.set(docRef, {
        ...booking,
        id: bookingId,
        createdAt: booking.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
    console.log(`Successfully migrated ${localBookings.length} local bookings to Firestore.`);
  }
}

export const adminBookingRepository = {
  subscribeManualBookings,
  createManualBooking,
  updateManualBooking,
  deleteManualBooking,
  migrateLocalBookingsToFirestore
};
