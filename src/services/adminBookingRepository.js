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

function hashText(value) {
  let hash = 0;
  const text = String(value || '');

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function normalizeBillingDate(value) {
  const raw = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '');

  const date = new Date(raw || Date.now());

  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  }

  return String(date.getFullYear()) + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
}

export function createBookingCode(booking, fallbackId = '') {
  const datePart = normalizeBillingDate(booking?.date || booking?.createdAt);
  const seed = [
    fallbackId,
    booking?.id,
    booking?.customer,
    booking?.phone,
    booking?.date,
    booking?.startHour,
    booking?.createdAt,
  ].filter(Boolean).join('|');
  const suffix = hashText(seed || Date.now()).toUpperCase().slice(0, 5).padEnd(5, '0');

  return 'BKG-' + datePart + '-' + suffix;
}

export function createInvoiceNumber(booking, fallbackId = '') {
  const bookingCode = booking?.bookingCode || createBookingCode(booking, fallbackId);

  return 'INV-' + bookingCode.replace(/^BKG-/, '');
}

function normalizeBookingBillingIdentity(booking, fallbackId = '') {
  const bookingCode = booking.bookingCode || booking.bookingId || createBookingCode(booking, fallbackId);
  const invoiceNumber = booking.invoiceNumber || createInvoiceNumber({ ...booking, bookingCode }, fallbackId);

  return {
    ...booking,
    bookingCode,
    bookingId: bookingCode,
    invoiceNumber,
  };
}

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
      snapshot.forEach((bookingDoc) => {
        const booking = {
          id: bookingDoc.id,
          ...bookingDoc.data(),
        };

        bookings.push(normalizeBookingBillingIdentity(booking, bookingDoc.id));
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
  const now = new Date().toISOString();

  const cleanBooking = normalizeBookingBillingIdentity(
    {
      ...booking,
      id: bookingId,
      createdAt: booking.createdAt || now,
      updatedAt: now,
    },
    bookingId
  );

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
  const cleanBooking = normalizeBookingBillingIdentity(
    {
      ...booking,
      updatedAt: new Date().toISOString(),
    },
    booking.id
  );

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

  if (snapshot.empty) {
    const batch = writeBatch(firestoreDb);

    localBookings.forEach((booking) => {
      const bookingId = booking.id || doc(bookingsRef).id;
      const docRef = doc(firestoreDb, 'bookings', bookingId);
      const cleanBooking = normalizeBookingBillingIdentity(
        {
          ...booking,
          id: bookingId,
          createdAt: booking.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        bookingId
      );

      batch.set(docRef, cleanBooking);
    });

    await batch.commit();
    console.log('Successfully migrated ' + localBookings.length + ' local bookings to Firestore.');
  }
}

export const adminBookingRepository = {
  subscribeManualBookings,
  createManualBooking,
  updateManualBooking,
  deleteManualBooking,
  migrateLocalBookingsToFirestore,
};
