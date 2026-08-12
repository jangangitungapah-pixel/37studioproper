import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { getBookingRequestStatus } from '../domain/booking/bookingSelectors.js';
import {
  buildBookingDecisionKey,
  buildBookingDecisionPatch,
  validateBookingDecision,
} from '../domain/booking/bookingDecision.js';
import {
  createAdminNotificationEvent,
  createClientNotificationEvent,
  NOTIFICATION_EVENT_TYPES,
} from './notificationEventRepository.js';

const MESSAGE_COLLECTION = 'bookingMessages';

export const bookingRequestStatusOptions = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Menunggu konfirmasi', tone: 'pending' },
  confirmed: { label: 'Dikonfirmasi admin', tone: 'confirmed' },
  rejected: { label: 'Tidak dapat dikonfirmasi', tone: 'rejected' },
  cancellation_requested: { label: 'Meminta pembatalan', tone: 'attention' },
  cancelled: { label: 'Dibatalkan', tone: 'cancelled' },
};

export function getBookingRequestStatusMeta(booking) {
  const rawStatus =
    booking?.requestStatus ??
    booking?.bookingRequestStatus;

  if (!String(rawStatus || '').trim()) return null;

  const status = getBookingRequestStatus(booking);

  return bookingRequestStatusOptions[status] || { label: status, tone: 'pending' };
}

function requireFirestore() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

function cleanText(value, maxLength = 600) {
  return String(value || '').trim().slice(0, maxLength);
}

function makeMessagePayload({ booking, createdAt, messageId, role, text, type, user }) {
  const now = createdAt || new Date().toISOString();

  return {
    id: messageId,
    bookingId: booking.id,
    clientUid: booking.clientUid,
    senderUid: user.uid,
    senderRole: role,
    senderName: cleanText(user.displayName || (role === 'admin' ? 'Admin Studio' : booking.customer || 'Client'), 120),
    text: cleanText(text),
    type,
    createdAt: now,
    readByAdmin: role === 'admin',
    readByClient: role === 'client',
  };
}

function makeBookingMessageSummary(message) {
  return {
    lastMessageId: message.id,
    lastMessageAt: message.createdAt,
    lastMessagePreview: message.text.slice(0, 180),
    lastMessageSenderRole: message.senderRole,
    lastMessageReadByAdmin: message.readByAdmin,
    lastMessageReadByClient: message.readByClient,
  };
}

// >>> STUDIO37 COMMUNICATION NOTIFICATION HELPERS START
function getAdminBookingNotificationUrl(booking) {
  const id = encodeURIComponent(String(booking?.id || ''));

  return id ? `/admin/schedule?bookingId=${id}` : '/admin/schedule';
}

function getClientBookingNotificationUrl(booking) {
  const id = encodeURIComponent(String(booking?.id || ''));

  return id ? `/client/portal?bookingId=${id}` : '/client/portal';
}

function getBookingDisplayCode(booking) {
  return booking?.bookingCode || booking?.bookingId || booking?.id || 'booking';
}

async function safeCreateBookingMessageNotificationEvent({ booking, message, role, user }) {
  try {
    if (role === 'admin') {
      await createClientNotificationEvent({
        bookingId: booking.id,
        message: message.text,
        metadata: {
          bookingCode: getBookingDisplayCode(booking),
          messageId: message.id,
          messageType: message.type,
          senderRole: role,
        },
        priority: message.type === 'status' ? 'high' : 'normal',
        source: 'booking-message',
        targetUid: booking.clientUid,
        title: message.type === 'status' ? 'Update status booking' : 'Pesan baru dari admin',
        type: NOTIFICATION_EVENT_TYPES.BOOKING_MESSAGE_CREATED,
        url: getClientBookingNotificationUrl(booking),
        user,
      });
      return;
    }

    await createAdminNotificationEvent({
      bookingId: booking.id,
      message: message.text,
      metadata: {
        bookingCode: getBookingDisplayCode(booking),
        clientUid: booking.clientUid || '',
        messageId: message.id,
        messageType: message.type,
        senderRole: role,
      },
      priority: message.type === 'cancellation' ? 'high' : 'normal',
      source: 'booking-message',
      title: message.type === 'cancellation' ? 'Permintaan pembatalan booking' : 'Pesan baru dari client',
      type: NOTIFICATION_EVENT_TYPES.BOOKING_MESSAGE_CREATED,
      url: getAdminBookingNotificationUrl(booking),
      user,
    });
  } catch (error) {
    console.warn('[notifications] Failed to queue booking message event:', error);
  }
}

async function safeCreateBookingStatusNotificationEvent({ booking, decisionKey, message, status, user }) {
  try {
    const isConfirmed = status === 'confirmed';
    const isRejected = status === 'rejected' || status === 'cancelled';

    await createClientNotificationEvent({
      bookingId: booking.id,
      eventId: `notification-${decisionKey}`,
      message: message.text,
      metadata: {
        bookingCode: getBookingDisplayCode(booking),
        decisionKey,
        messageId: message.id,
        status,
      },
      priority: 'high',
      source: 'booking-request-decision',
      targetUid: booking.clientUid,
      title: isConfirmed ? 'Booking dikonfirmasi' : isRejected ? 'Booking tidak dikonfirmasi' : 'Status booking diperbarui',
      type: isConfirmed
        ? NOTIFICATION_EVENT_TYPES.BOOKING_CONFIRMED
        : isRejected
          ? NOTIFICATION_EVENT_TYPES.BOOKING_REJECTED
          : NOTIFICATION_EVENT_TYPES.BOOKING_MESSAGE_CREATED,
      url: getClientBookingNotificationUrl(booking),
      user,
    });
  } catch (error) {
    console.warn('[notifications] Failed to queue booking status event:', error);
  }
}
// <<< STUDIO37 COMMUNICATION NOTIFICATION HELPERS END

export function subscribeBookingMessages({ booking, role, user }, callback, onError) {
  requireFirestore();

  if (!booking?.id || !user?.uid) {
    callback([]);
    return () => {};
  }

  const messagesRef = collection(firestoreDb, MESSAGE_COLLECTION);
  const filters = [where('bookingId', '==', booking.id)];

  if (role === 'client') {
    filters.push(where('clientUid', '==', user.uid));
  }

  return onSnapshot(
    query(messagesRef, ...filters),
    (snapshot) => {
      const messages = snapshot.docs
        .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }))
        .sort((first, second) => String(first.createdAt || '').localeCompare(String(second.createdAt || '')));

      callback(messages);
    },
    (error) => {
      console.error('Gagal memuat komunikasi booking:', error);
      if (onError) onError(error);
    }
  );
}

export async function sendBookingMessage({ booking, role, text, type = 'message', user }) {
  requireFirestore();

  const cleanMessage = cleanText(text);
  if (!booking?.id || !booking?.clientUid || !user?.uid || !cleanMessage) {
    throw new Error('Data pesan booking belum lengkap.');
  }

  const messageRef = doc(collection(firestoreDb, MESSAGE_COLLECTION));
  const message = makeMessagePayload({ booking, messageId: messageRef.id, role, text: cleanMessage, type, user });
  const batch = writeBatch(firestoreDb);

  batch.set(messageRef, message);
  batch.update(doc(firestoreDb, 'bookings', booking.id), makeBookingMessageSummary(message));
  await batch.commit();

  await safeCreateBookingMessageNotificationEvent({ booking, message, role, user });

  return message;
}

export async function markBookingMessagesRead({ booking, messages, role }) {
  requireFirestore();

  const unreadField = role === 'admin' ? 'readByAdmin' : 'readByClient';
  const unreadMessages = (messages || []).filter((message) => message[unreadField] === false);
  const lastMessageNeedsUpdate = role === 'admin'
    ? booking?.lastMessageSenderRole === 'client' && booking?.lastMessageReadByAdmin === false
    : booking?.lastMessageSenderRole === 'admin' && booking?.lastMessageReadByClient === false;

  if (!unreadMessages.length && !lastMessageNeedsUpdate) return;

  const batch = writeBatch(firestoreDb);
  unreadMessages.slice(0, 100).forEach((message) => {
    batch.update(doc(firestoreDb, MESSAGE_COLLECTION, message.id), { [unreadField]: true });
  });

  if (lastMessageNeedsUpdate) {
    batch.update(doc(firestoreDb, 'bookings', booking.id), {
      [role === 'admin' ? 'lastMessageReadByAdmin' : 'lastMessageReadByClient']: true,
    });
  }

  await batch.commit();
}

export async function requestBookingCancellation({ booking, note, user }) {
  requireFirestore();

  const cleanNote = cleanText(note || 'Client meminta pembatalan booking.');
  const messageRef = doc(collection(firestoreDb, MESSAGE_COLLECTION));
  const message = makeMessagePayload({
    booking,
    messageId: messageRef.id,
    role: 'client',
    text: cleanNote,
    type: 'cancellation',
    user,
  });
  const batch = writeBatch(firestoreDb);

  batch.set(messageRef, message);
  batch.update(doc(firestoreDb, 'bookings', booking.id), {
    ...makeBookingMessageSummary(message),
    bookingRequestStatus: 'cancellation_requested',
    requestStatus: 'cancellation_requested',
    clientRequestNote: cleanNote,
    clientRequestUpdatedAt: message.createdAt,
  });
  await batch.commit();

  await safeCreateBookingMessageNotificationEvent({ booking, message, role: 'client', user });

  return message;
}

function throwBookingDecisionIssue(issue) {
  const error = new Error(
    issue?.message ||
    'Request booking tidak dapat diproses.',
  );

  error.code = issue?.code || 'booking-decision-failed';
  error.conflict = issue?.conflict || null;
  throw error;
}

async function resolveDecisionBookings({
  booking,
  currentBookings,
  status,
}) {
  if (Array.isArray(currentBookings)) {
    return currentBookings;
  }

  if (status !== 'confirmed' || !booking?.date) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(firestoreDb, 'bookings'),
      where('date', '==', booking.date),
    ),
  );

  return snapshot.docs.map((bookingDoc) => ({
    id: bookingDoc.id,
    ...bookingDoc.data(),
  }));
}

export async function updateBookingRequestStatus({
  booking,
  currentBookings,
  note,
  status,
  user,
}) {
  requireFirestore();

  const statusMeta = bookingRequestStatusOptions[status];
  if (!statusMeta || !booking?.id || !booking?.clientUid || !user?.uid) {
    throw new Error('Status request booking tidak valid.');
  }

  const cleanNote = cleanText(
    note ||
    `Status booking diperbarui: ${statusMeta.label}.`,
  );
  const decisionBookings = await resolveDecisionBookings({
    booking,
    currentBookings,
    status,
  });
  const initialIssue = validateBookingDecision({
    booking,
    currentBookings: decisionBookings,
    reason: note,
    status,
  });

  if (!initialIssue.ok) {
    throwBookingDecisionIssue(initialIssue);
  }

  const decisionKey = buildBookingDecisionKey({
    booking,
    status,
  });
  const createdAt = new Date().toISOString();
  const messageId = `request-${decisionKey}`;
  const messageRef = doc(
    firestoreDb,
    MESSAGE_COLLECTION,
    messageId,
  );
  const message = makeMessagePayload({
    booking,
    createdAt,
    messageId,
    role: 'admin',
    text: cleanNote,
    type: 'status',
    user,
  });
  const bookingRef = doc(
    firestoreDb,
    'bookings',
    booking.id,
  );
  let alreadyApplied = false;

  await runTransaction(
    firestoreDb,
    async (transaction) => {
      const liveSnapshot =
        await transaction.get(bookingRef);

      if (!liveSnapshot.exists()) {
        throwBookingDecisionIssue({
          code: 'booking-not-found',
          message: 'Booking sudah tidak tersedia.',
        });
      }

      const liveBooking = {
        id: liveSnapshot.id,
        ...liveSnapshot.data(),
      };

      if (
        liveBooking.lastRequestDecisionKey ===
        decisionKey
      ) {
        alreadyApplied = true;
        return;
      }

      const liveIssue = validateBookingDecision({
        booking: liveBooking,
        currentBookings: decisionBookings,
        reason: note,
        status,
      });

      if (!liveIssue.ok) {
        throwBookingDecisionIssue(liveIssue);
      }

      transaction.set(messageRef, message);
      transaction.update(bookingRef, {
        ...makeBookingMessageSummary(message),
        ...buildBookingDecisionPatch({
          actor: user,
          decisionKey,
          note: cleanNote,
          status,
          timestamp: createdAt,
        }),
        // Compatibility alias retained while legacy readers still migrate.
        bookingRequestStatus: status,
      });
    },
  );

  if (!alreadyApplied) {
    await safeCreateBookingStatusNotificationEvent({
      booking,
      decisionKey,
      message,
      status,
      user,
    });
  }

  return {
    alreadyApplied,
    decisionKey,
    message,
    status,
  };
}

export const bookingCommunicationRepository = {
  markBookingMessagesRead,
  requestBookingCancellation,
  sendBookingMessage,
  subscribeBookingMessages,
  updateBookingRequestStatus,
};
