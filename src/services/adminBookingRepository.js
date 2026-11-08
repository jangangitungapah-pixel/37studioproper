import {
  collection,
  doc,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import {
  createClientBookingRequestOperation,
  createManualBooking as createManualBookingOperation,
  updateManualBooking as updateManualBookingOperation,
} from './bookingOperationsRepository.js';
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

export function subscribeClientCalendarSlots(options, callback, onError) {
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

  const constraints = [];
  if (opts.startDate) constraints.push(where('date', '>=', opts.startDate));
  if (opts.endDate) constraints.push(where('date', '<=', opts.endDate));
  constraints.push(orderBy('date', 'asc'));
  constraints.push(limit(Math.min(500, Math.max(1, Number(opts.limitCount) || 500))));

  const q = query(collection(firestoreDb, 'clientCalendarSlots'), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const slots = [];
      snapshot.forEach((slotDoc) => slots.push({ id: slotDoc.id, ...slotDoc.data() }));
      slots.sort((first, second) => {
        if (first.date !== second.date) return String(first.date || '').localeCompare(String(second.date || ''));
        return Number(first.startHour || 0) - Number(second.startHour || 0);
      });
      cb(slots);
    },
    (error) => {
      console.error('Error fetching client calendar slots from Firestore:', error);
      if (errCb) errCb(error);
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
  const q = query(
    bookingsRef,
    ...(filters.length === 1 ? [filters[0]] : [or(...filters)]),
    limit(250),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const bookings = [];
      snapshot.forEach((bookingDoc) => {
        const booking = { id: bookingDoc.id, ...bookingDoc.data() };
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

export function subscribeManualBookings(options, callback, onError) {
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

  const bookingsRef = collection(firestoreDb, 'bookings');
  const constraints = [];

  if (opts.startDate) {
    constraints.push(where('date', '>=', opts.startDate));
  }
  if (opts.endDate) {
    constraints.push(where('date', '<=', opts.endDate));
  }

  constraints.push(orderBy('date', 'desc'));

  constraints.push(limit(Math.min(1000, Math.max(1, Number(opts.limitCount) || 500))));

  const q = query(bookingsRef, ...constraints);

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
      cb(bookings);
    },
    (error) => {
      console.error('Error fetching bookings from Firestore:', error);
      if (errCb) errCb(error);
    }
  );
}

export async function createManualBooking(booking) {
  const result = await createManualBookingOperation(booking);
  return result.booking;
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

  const result = await createClientBookingRequestOperation({ user, booking: cleanBooking });
  if (!result.duplicate) {
    await safeCreateBookingRequestNotificationEvent({ booking: result.booking, user });
  }

  return result.booking;
}

export async function updateManualBooking(booking) {
  if (!booking?.id) throw new Error('Booking ID tidak boleh kosong.');
  const result = await updateManualBookingOperation(booking);
  return normalizeBookingBillingIdentity(result, booking.id);
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

export const adminBookingRepository = {
  subscribeManualBookings,
  createManualBooking,
  createClientBookingRequest,
  updateManualBooking,
  deleteManualBooking,
  subscribeClientBookingsForUser,
  subscribeClientCalendarSlots,
};
