import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

const MESSAGE_COLLECTION = 'bookingMessages';

export const bookingRequestStatusOptions = {
  submitted: { label: 'Menunggu konfirmasi', tone: 'pending' },
  confirmed: { label: 'Dikonfirmasi admin', tone: 'confirmed' },
  rejected: { label: 'Tidak dapat dikonfirmasi', tone: 'rejected' },
  cancellation_requested: { label: 'Meminta pembatalan', tone: 'attention' },
  cancelled: { label: 'Dibatalkan', tone: 'cancelled' },
};

export function getBookingRequestStatusMeta(booking) {
  const status = String(booking?.bookingRequestStatus || '').trim();

  if (!status) return null;
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

function makeMessagePayload({ booking, messageId, role, text, type, user }) {
  const now = new Date().toISOString();

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
    clientRequestNote: cleanNote,
    clientRequestUpdatedAt: message.createdAt,
  });
  await batch.commit();

  return message;
}

export async function updateBookingRequestStatus({ booking, note, status, user }) {
  requireFirestore();

  const statusMeta = bookingRequestStatusOptions[status];
  if (!statusMeta || !booking?.id || !booking?.clientUid || !user?.uid) {
    throw new Error('Status request booking tidak valid.');
  }

  const cleanNote = cleanText(note || `Status booking diperbarui: ${statusMeta.label}.`);
  const messageRef = doc(collection(firestoreDb, MESSAGE_COLLECTION));
  const message = makeMessagePayload({
    booking,
    messageId: messageRef.id,
    role: 'admin',
    text: cleanNote,
    type: 'status',
    user,
  });
  const bookingUpdate = {
    ...makeBookingMessageSummary(message),
    bookingRequestStatus: status,
    adminResponseNote: cleanNote,
    adminResponseAt: message.createdAt,
    updatedAt: message.createdAt,
  };

  if (status === 'rejected' || status === 'cancelled') {
    bookingUpdate.paymentStatus = 'cancelled';
    bookingUpdate.status = 'cancelled';
  } else if (status === 'confirmed' && ['cancelled', 'canceled'].includes(String(booking.status || '').toLowerCase())) {
    bookingUpdate.paymentStatus = 'pending';
    bookingUpdate.status = 'pending';
  }

  const batch = writeBatch(firestoreDb);
  batch.set(messageRef, message);
  batch.update(doc(firestoreDb, 'bookings', booking.id), bookingUpdate);
  await batch.commit();

  return { message, status };
}

export const bookingCommunicationRepository = {
  markBookingMessagesRead,
  requestBookingCancellation,
  sendBookingMessage,
  subscribeBookingMessages,
  updateBookingRequestStatus,
};
