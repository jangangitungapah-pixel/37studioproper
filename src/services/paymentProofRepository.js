import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { buildBookingPaymentPatch, buildPaymentFromProof } from '../utils/bookingPaymentUtils.js';

export const PAYMENT_PROOFS_COLLECTION = 'paymentProofs';

export const paymentProofCategoryOptions = [
  { key: 'dp', label: 'DP' },
  { key: 'pelunasan', label: 'Pelunasan' },
];

export const paymentProofMethodOptions = [
  { key: 'transfer', label: 'Transfer Bank' },
  { key: 'qris', label: 'QRIS' },
];

export const paymentProofStatusOptions = [
  { key: 'pending', label: 'Menunggu Review' },
  { key: 'approved', label: 'Berhasil' },
  { key: 'rejected', label: 'Ditolak' },
];

function assertFirebaseReady() {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error('Firebase belum dikonfigurasi.');
  }
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeCategory(value) {
  return value === 'pelunasan' ? 'pelunasan' : 'dp';
}

function normalizeMethod(value) {
  return value === 'qris' ? 'qris' : 'transfer';
}

function createPaymentProofId() {
  return 'proof_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getBookingDisplayCode(booking) {
  return booking?.bookingCode || booking?.bookingId || booking?.id || '';
}

function getInvoiceDisplayNumber(booking) {
  return booking?.invoiceNumber || '';
}

export function getPaymentProofStatusLabel(status) {
  return paymentProofStatusOptions.find((item) => item.key === status)?.label || 'Menunggu Review';
}

export function normalizePaymentProof(proof) {
  const source = proof && typeof proof === 'object' ? proof : {};

  return {
    adminNote: cleanText(source.adminNote),
    amount: Math.max(0, Number(source.amount) || 0),
    bookingCode: cleanText(source.bookingCode),
    bookingId: cleanText(source.bookingId),
    category: normalizeCategory(source.category),
    clientNote: cleanText(source.clientNote),
    clientUid: cleanText(source.clientUid),
    createdAt: cleanText(source.createdAt),
    customer: cleanText(source.customer),
    id: cleanText(source.id),
    invoiceNumber: cleanText(source.invoiceNumber),
    method: normalizeMethod(source.method),
    proofFileName: cleanText(source.proofFileName),
    proofMimeType: cleanText(source.proofMimeType),
    proofPublicId: cleanText(source.proofPublicId),
    proofUrl: cleanText(source.proofUrl),
    reviewedAt: cleanText(source.reviewedAt),
    reviewedByName: cleanText(source.reviewedByName),
    reviewedByUid: cleanText(source.reviewedByUid),
    status: ['pending', 'approved', 'rejected'].includes(source.status) ? source.status : 'pending',
    updatedAt: cleanText(source.updatedAt),
  };
}

export function buildPaymentProofPayload({ booking, clientUser, file, form, uploadResult }) {
  if (!booking?.id) {
    throw new Error('Booking tidak valid untuk upload bukti pembayaran.');
  }

  if (!clientUser?.uid) {
    throw new Error('Client wajib login untuk upload bukti pembayaran.');
  }

  if (!uploadResult?.secureUrl) {
    throw new Error('Upload bukti pembayaran belum berhasil.');
  }

  const now = new Date().toISOString();
  const proofId = createPaymentProofId();
  const amount = Math.max(0, Number(form?.amount) || 0);

  if (!amount) {
    throw new Error('Nominal pembayaran wajib lebih dari 0.');
  }

  return normalizePaymentProof({
    adminNote: '',
    amount,
    bookingCode: getBookingDisplayCode(booking),
    bookingId: booking.id,
    category: normalizeCategory(form?.category),
    clientNote: form?.clientNote,
    clientUid: clientUser.uid,
    createdAt: now,
    customer: booking.customer || clientUser.displayName || clientUser.email || 'Client',
    id: proofId,
    invoiceNumber: getInvoiceDisplayNumber(booking),
    method: normalizeMethod(form?.method),
    proofFileName: file?.name || '',
    proofMimeType: file?.type || '',
    proofPublicId: uploadResult.publicId || '',
    proofUrl: uploadResult.secureUrl,
    reviewedAt: '',
    reviewedByName: '',
    reviewedByUid: '',
    status: 'pending',
    updatedAt: now,
  });
}

export async function submitPaymentProof(payload) {
  assertFirebaseReady();

  const proof = normalizePaymentProof(payload);

  if (!proof.id || !proof.bookingId || !proof.clientUid || !proof.proofUrl || !proof.amount) {
    throw new Error('Data bukti pembayaran belum lengkap.');
  }

  const proofRef = doc(firestoreDb, PAYMENT_PROOFS_COLLECTION, proof.id);
  await setDoc(proofRef, proof);

  return proof;
}

export function subscribeClientPaymentProofs(clientUser, callback, onError) {
  if (!clientUser?.uid) {
    callback([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const proofsRef = collection(firestoreDb, PAYMENT_PROOFS_COLLECTION);
  const q = query(proofsRef, where('clientUid', '==', clientUser.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const proofs = [];

      snapshot.forEach((proofDoc) => {
        proofs.push(normalizePaymentProof({
          id: proofDoc.id,
          ...proofDoc.data(),
        }));
      });

      proofs.sort((first, second) =>
        String(second.createdAt || '').localeCompare(String(first.createdAt || ''))
      );

      callback(proofs);
    },
    (error) => {
      console.error('Gagal membaca bukti pembayaran client:', error);
      if (onError) onError(error);
    }
  );
}

export function subscribePaymentProofsForBooking(bookingId, callback, onError) {
  if (!bookingId) {
    callback([]);
    return () => {};
  }

  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const proofsRef = collection(firestoreDb, PAYMENT_PROOFS_COLLECTION);
  const q = query(proofsRef, where('bookingId', '==', bookingId));

  return onSnapshot(
    q,
    (snapshot) => {
      const proofs = [];

      snapshot.forEach((proofDoc) => {
        proofs.push(normalizePaymentProof({
          id: proofDoc.id,
          ...proofDoc.data(),
        }));
      });

      proofs.sort((first, second) =>
        String(second.createdAt || '').localeCompare(String(first.createdAt || ''))
      );

      callback(proofs);
    },
    (error) => {
      console.error('Gagal membaca bukti pembayaran booking:', error);
      if (onError) onError(error);
    }
  );
}

export function subscribePendingPaymentProofs(callback, onError) {
  if (!isFirebaseConfigured || !firestoreDb) {
    if (onError) onError(new Error('Firebase belum dikonfigurasi.'));
    return () => {};
  }

  const proofsRef = collection(firestoreDb, PAYMENT_PROOFS_COLLECTION);
  const q = query(proofsRef, where('status', '==', 'pending'));

  return onSnapshot(
    q,
    (snapshot) => {
      const proofs = [];

      snapshot.forEach((proofDoc) => {
        proofs.push(normalizePaymentProof({
          id: proofDoc.id,
          ...proofDoc.data(),
        }));
      });

      proofs.sort((first, second) =>
        String(second.createdAt || '').localeCompare(String(first.createdAt || ''))
      );

      callback(proofs);
    },
    (error) => {
      console.error('Gagal membaca payment proof pending:', error);
      if (onError) onError(error);
    }
  );
}

export async function rejectPaymentProof(proof, reviewer, adminNote = '') {
  assertFirebaseReady();

  const cleanProof = normalizePaymentProof(proof);
  const now = new Date().toISOString();

  if (!cleanProof.id) {
    throw new Error('Bukti pembayaran tidak valid.');
  }

  await updateDoc(doc(firestoreDb, PAYMENT_PROOFS_COLLECTION, cleanProof.id), {
    adminNote: cleanText(adminNote),
    reviewedAt: now,
    reviewedByName: cleanText(reviewer?.displayName || reviewer?.email || 'Admin'),
    reviewedByUid: cleanText(reviewer?.uid),
    status: 'rejected',
    updatedAt: now,
  });

  return {
    ...cleanProof,
    adminNote: cleanText(adminNote),
    reviewedAt: now,
    reviewedByName: cleanText(reviewer?.displayName || reviewer?.email || 'Admin'),
    reviewedByUid: cleanText(reviewer?.uid),
    status: 'rejected',
    updatedAt: now,
  };
}

export async function approvePaymentProofAndRecordPayment({ booking, proof, reviewer, adminNote = '' }) {
  assertFirebaseReady();

  const cleanProof = normalizePaymentProof(proof);
  const now = new Date().toISOString();

  if (!booking?.id || !cleanProof.id) {
    throw new Error('Booking atau bukti pembayaran tidak valid.');
  }

  if (cleanProof.status !== 'pending') {
    throw new Error('Bukti pembayaran sudah pernah direview.');
  }

  const payment = buildPaymentFromProof(cleanProof, {
    createdAt: now,
    date: now.slice(0, 10),
    note: adminNote || cleanProof.clientNote || 'Bukti pembayaran client disetujui admin',
  });

  const nextBooking = buildBookingPaymentPatch(booking, payment);
  const batch = writeBatch(firestoreDb);

  batch.update(doc(firestoreDb, 'bookings', booking.id), nextBooking);
  batch.update(doc(firestoreDb, PAYMENT_PROOFS_COLLECTION, cleanProof.id), {
    adminNote: cleanText(adminNote),
    reviewedAt: now,
    reviewedByName: cleanText(reviewer?.displayName || reviewer?.email || 'Admin'),
    reviewedByUid: cleanText(reviewer?.uid),
    status: 'approved',
    updatedAt: now,
  });

  await batch.commit();

  return {
    booking: nextBooking,
    payment,
    proof: {
      ...cleanProof,
      adminNote: cleanText(adminNote),
      reviewedAt: now,
      reviewedByName: cleanText(reviewer?.displayName || reviewer?.email || 'Admin'),
      reviewedByUid: cleanText(reviewer?.uid),
      status: 'approved',
      updatedAt: now,
    },
  };
}

export const paymentProofRepository = {
  approvePaymentProofAndRecordPayment,
  buildPaymentProofPayload,
  getPaymentProofStatusLabel,
  rejectPaymentProof,
  submitPaymentProof,
  subscribeClientPaymentProofs,
  subscribePaymentProofsForBooking,
  subscribePendingPaymentProofs,
};
