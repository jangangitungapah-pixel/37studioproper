import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  or,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  createAdminNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
} from './notificationEventRepository.js';

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

function normalizeClientPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;

  return digits;
}

// >>> STUDIO37 BOOKING NOTIFICATION HELPERS START
function getBookingNotificationUrl(booking) {
  const id = encodeURIComponent(String(booking?.id || ''));

  return id ? `/admin/schedule?bookingId=${id}` : '/admin/schedule';
}

async function safeCreateBookingRequestNotificationEvent({ booking, user }) {
  try {
    await createAdminNotificationEvent({
      bookingId: booking.id,
      message: `${booking.customer || 'Client'} mengirim permintaan booking ${booking.sessionLabel || 'studio'} untuk ${booking.date || 'tanggal belum dipilih'}.`,
      metadata: {
        bookingCode: booking.bookingCode || booking.bookingId || '',
        date: booking.date || '',
        durationHours: Number(booking.durationHours || 0),
        startHour: Number(booking.startHour || 0),
        total: Number(booking.total || 0),
      },
      priority: 'high',
      source: 'client-booking-request',
      title: 'Permintaan booking baru',
      type: NOTIFICATION_EVENT_TYPES.BOOKING_REQUEST_CREATED,
      url: getBookingNotificationUrl(booking),
      user,
    });
  } catch (error) {
    console.warn('[notifications] Failed to queue booking request event:', error);
  }
}
// <<< STUDIO37 BOOKING NOTIFICATION HELPERS END

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

const CLIENT_CALENDAR_SLOTS_COLLECTION = 'clientCalendarSlots';

function getClientCalendarSlotRef(bookingId) {
  return doc(firestoreDb, CLIENT_CALENDAR_SLOTS_COLLECTION, bookingId);
}

function getSafeBookingStatus(booking) {
  return String(booking?.paymentStatus || booking?.status || 'pending').trim().toLowerCase();
}

function shouldExposeClientCalendarSlot(booking) {
  const status = getSafeBookingStatus(booking);
  const requestStatus = String(booking?.bookingRequestStatus || '').trim().toLowerCase();
  const durationHours = Number(booking?.durationHours || booking?.duration || 0);
  const hiddenStatuses = ['void', 'cancelled', 'canceled', 'deleted'];
  const unconfirmedClientRequest =
    booking?.source === 'clientPortal' &&
    ['submitted', 'rejected', 'cancelled'].includes(requestStatus);

  return Boolean(
    booking?.id &&
    booking?.date &&
    booking?.startHour !== undefined &&
    booking?.startHour !== null &&
    Number.isFinite(durationHours) &&
    durationHours > 0 &&
    !hiddenStatuses.includes(status) &&
    !unconfirmedClientRequest
  );
}

function buildClientCalendarSlot(booking) {
  if (!shouldExposeClientCalendarSlot(booking)) return null;

  const rawStatus = getSafeBookingStatus(booking);
  const status = ['pending', 'dp', 'lunas'].includes(rawStatus) ? rawStatus : 'pending';
  const startHour = Number(booking.startHour);
  const durationHours = Math.max(1, Math.ceil(Number(booking.durationHours || booking.duration || 1) || 1));

  return {
    bookingId: booking.id,
    date: booking.date,
    durationHours,
    sessionLabel: 'Sesi Studio',
    startHour: Number.isFinite(startHour) ? startHour : 10,
    status,
    title: 'Terisi',
    updatedAt: booking.updatedAt || booking.createdAt || new Date().toISOString(),
  };
}

function clientSlotHasChanged(currentSlot, nextSlot) {
  if (!currentSlot) return true;

  const keys = ['bookingId', 'date', 'durationHours', 'sessionLabel', 'startHour', 'status', 'title', 'updatedAt'];

  return keys.some((key) => String(currentSlot[key] ?? '') !== String(nextSlot[key] ?? ''));
}

async function commitBatchOperations(operations) {
  if (!operations.length) return 0;

  let committed = 0;

  for (let index = 0; index < operations.length; index += 450) {
    const batch = writeBatch(firestoreDb);
    const slice = operations.slice(index, index + 450);

    slice.forEach((operation) => {
      if (operation.type === 'set') {
        batch.set(operation.ref, operation.data, { merge: true });
      } else if (operation.type === 'delete') {
        batch.delete(operation.ref);
      }
    });

    await batch.commit();
    committed += slice.length;
  }

  return committed;
}

export async function syncClientCalendarSlotsFromBookings(bookings = []) {
  if (!isFirebaseConfigured || !firestoreDb || !Array.isArray(bookings)) {
    return 0;
  }

  const slotsRef = collection(firestoreDb, CLIENT_CALENDAR_SLOTS_COLLECTION);
  const existingSnapshot = await getDocs(slotsRef);
  const existingSlots = new Map();

  existingSnapshot.forEach((slotDoc) => {
    existingSlots.set(slotDoc.id, slotDoc.data());
  });

  const intendedSlotIds = new Set();
  const operations = [];

  bookings.forEach((booking) => {
    if (!booking?.id) return;

    const slotRef = getClientCalendarSlotRef(booking.id);
    const slot = buildClientCalendarSlot(booking);

    if (!slot) {
      if (existingSlots.has(booking.id)) {
        operations.push({ type: 'delete', ref: slotRef });
      }
      return;
    }

    intendedSlotIds.add(booking.id);

    if (clientSlotHasChanged(existingSlots.get(booking.id), slot)) {
      operations.push({ type: 'set', ref: slotRef, data: slot });
    }
  });

  existingSlots.forEach((_slot, slotId) => {
    if (!intendedSlotIds.has(slotId)) {
      operations.push({
        type: 'delete',
        ref: getClientCalendarSlotRef(slotId),
      });
    }
  });

  return commitBatchOperations(operations);
}

export function subscribeClientCalendarSlots(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const slotsRef = collection(firestoreDb, CLIENT_CALENDAR_SLOTS_COLLECTION);
  const q = query(slotsRef, orderBy('date', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const slots = [];

      snapshot.forEach((slotDoc) => {
        slots.push({
          id: slotDoc.id,
          ...slotDoc.data(),
        });
      });

      slots.sort((first, second) => {
        if (first.date !== second.date) return String(first.date || '').localeCompare(String(second.date || ''));
        return Number(first.startHour || 0) - Number(second.startHour || 0);
      });

      callback(slots);
    },
    (error) => {
      console.error('Error fetching client calendar slots from Firestore:', error);
      if (onError) onError(error);
    }
  );
}

export function subscribeClientBookingsForUser(user, callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  if (!user) {
    callback([]);
    return () => {};
  }

  const email = String(user.email || '').trim();
  const emailLower = email.toLowerCase();
  const phoneRaw = String(user.phoneNumber || '').trim();
  const phoneNoPlus = phoneRaw.replace(/^\+/, '');
  const filters = [];

  if (user.uid) filters.push(where('clientUid', '==', user.uid));
  if (email) filters.push(where('email', '==', email));
  if (emailLower && emailLower !== email) filters.push(where('email', '==', emailLower));
  if (phoneRaw) filters.push(where('phone', '==', phoneRaw));
  if (phoneNoPlus) {
    filters.push(where('phone', '==', phoneNoPlus));
    filters.push(where('customerPhoneKey', '==', phoneNoPlus));
  }

  if (!filters.length) {
    callback([]);
    return () => {};
  }

  const bookingsRef = collection(firestoreDb, 'bookings');
  const q = filters.length === 1
    ? query(bookingsRef, filters[0])
    : query(bookingsRef, or(...filters));

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

      bookings.sort((first, second) => {
        const firstDate = String(first.date || first.createdAt || '');
        const secondDate = String(second.date || second.createdAt || '');

        return secondDate.localeCompare(firstDate);
      });

      callback(bookings);
    },
    (error) => {
      console.error('Error fetching client-owned bookings from Firestore:', error);
      if (onError) onError(error);
    }
  );
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

  const batch = writeBatch(firestoreDb);
  const publicSlot = buildClientCalendarSlot(cleanBooking);

  batch.set(docRef, cleanBooking);

  if (publicSlot) {
    batch.set(getClientCalendarSlotRef(bookingId), publicSlot, { merge: true });
  }

  await batch.commit();
  return cleanBooking;
}

export async function createClientBookingRequest(user, booking) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  if (!user?.uid) {
    throw new Error('Client harus login untuk mengirim permintaan booking.');
  }

  const bookingId = doc(collection(firestoreDb, 'bookings')).id;
  const now = new Date().toISOString();
  const phone = String(user.phoneNumber || booking.phone || '').trim();
  const total = Math.max(0, Number(booking.total) || 0);
  const cleanBooking = normalizeBookingBillingIdentity({
    id: bookingId,
    customer: String(booking.customer || user.displayName || 'Client').trim().slice(0, 120),
    phone,
    customerPhoneKey: normalizeClientPhone(phone),
    email: String(user.email || '').trim(),
    clientUid: user.uid,
    customerId: `auth_${user.uid}`,
    source: 'clientPortal',
    bookingRequestStatus: 'submitted',
    clientRequestUpdatedAt: now,
    packageId: String(booking.packageId || 'none'),
    packageLabel: String(booking.packageLabel || ''),
    pricingMode: String(booking.pricingMode || 'session'),
    sessionType: String(booking.sessionType || 'rehearsal'),
    sessionLabel: String(booking.sessionLabel || 'Sesi Studio'),
    recordingTypeId: String(booking.recordingTypeId || ''),
    recordingTypeLabel: String(booking.recordingTypeLabel || ''),
    title: String(booking.title || booking.sessionLabel || 'Permintaan Booking').slice(0, 160),
    date: String(booking.date || ''),
    startHour: Number(booking.startHour),
    startTimeLabel: String(booking.startTimeLabel || ''),
    durationHours: Number(booking.durationHours),
    paymentMethod: '',
    paymentHistory: [],
    paidAmount: 0,
    lastPaymentAt: '',
    lastPaymentMethod: '',
    paymentStatus: 'pending',
    status: 'pending',
    subtotal: Math.max(0, Number(booking.subtotal) || total),
    discountAmount: Math.max(0, Number(booking.discountAmount) || 0),
    appliedDiscounts: Array.isArray(booking.appliedDiscounts) ? booking.appliedDiscounts.slice(0, 50) : [],
    total,
    dpAmount: 0,
    invoiceAmount: total,
    createdAt: now,
    updatedAt: now,
  }, bookingId);

  await setDoc(doc(firestoreDb, 'bookings', bookingId), cleanBooking);
  await safeCreateBookingRequestNotificationEvent({ booking: cleanBooking, user });

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

  const batch = writeBatch(firestoreDb);
  const publicSlot = buildClientCalendarSlot(cleanBooking);

  batch.set(docRef, cleanBooking, { merge: true });

  if (publicSlot) {
    batch.set(getClientCalendarSlotRef(booking.id), publicSlot, { merge: true });
  } else {
    batch.delete(getClientCalendarSlotRef(booking.id));
  }

  await batch.commit();
  return cleanBooking;
}

export async function deleteManualBooking(bookingId) {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }

  const docRef = doc(firestoreDb, 'bookings', bookingId);
  const batch = writeBatch(firestoreDb);

  batch.delete(docRef);
  batch.delete(getClientCalendarSlotRef(bookingId));

  await batch.commit();
}

export async function migrateLocalBookingsToFirestore(localBookings) {
  if (!isFirebaseConfigured || !firestoreDb || !Array.isArray(localBookings) || localBookings.length === 0) {
    return;
  }

  try {
    const bookingsRef = collection(firestoreDb, 'bookings');
    const snapshot = await getDocs(bookingsRef);
    const existingIds = new Set();
    snapshot.forEach((docSnap) => {
      existingIds.add(docSnap.id);
    });

    const unsyncedBookings = localBookings.filter((booking) => {
      const bookingId = booking.id || booking.bookingCode;
      return bookingId && !existingIds.has(bookingId);
    });

    if (unsyncedBookings.length > 0) {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < unsyncedBookings.length; i += BATCH_LIMIT) {
        const batch = writeBatch(firestoreDb);
        const chunk = unsyncedBookings.slice(i, i + BATCH_LIMIT);

        chunk.forEach((booking) => {
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

        const publicSlot = buildClientCalendarSlot(cleanBooking);
        if (publicSlot) {
          batch.set(getClientCalendarSlotRef(bookingId), publicSlot, { merge: true });
        }
        });

        await batch.commit();
      }
      console.log('Successfully migrated ' + unsyncedBookings.length + ' local bookings to Firestore.');
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('37musicstudio.schedule.bookings.v1');
    }
  } catch (error) {
    console.error('Error during local bookings migration:', error);
  }
}

export const adminBookingRepository = {
  subscribeManualBookings,
  createManualBooking,
  createClientBookingRequest,
  updateManualBooking,
  deleteManualBooking,
  migrateLocalBookingsToFirestore,
  subscribeClientBookingsForUser,
  subscribeClientCalendarSlots,
  syncClientCalendarSlotsFromBookings,
};
