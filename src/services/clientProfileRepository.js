import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  if (digits.startsWith('8')) digits = '62' + digits;

  return digits;
}

export async function syncClientCustomerProfile(user) {
  if (!isFirebaseConfigured || !firestoreDb || !user?.uid) return null;

  const profileId = 'auth_' + user.uid;
  const profileRef = doc(firestoreDb, 'customers', profileId);
  const existingSnapshot = await getDoc(profileRef);
  const existing = existingSnapshot.exists() ? existingSnapshot.data() : {};
  const now = new Date().toISOString();
  const phone = String(user.phoneNumber || existing.phone || '').trim();
  const email = String(user.email || existing.email || '').trim().toLowerCase();
  const displayName = String(
    user.displayName ||
    existing.name ||
    email.split('@')[0] ||
    phone ||
    'Client'
  ).trim();

  const profile = {
    id: profileId,
    authUid: user.uid,
    name: displayName,
    phone,
    phoneKey: normalizePhone(phone),
    email,
    instagram: String(existing.instagram || ''),
    notes: String(existing.notes || ''),
    followUpStatus: String(existing.followUpStatus || 'normal'),
    source: 'clientPortal',
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };

  await setDoc(profileRef, profile, { merge: true });
  return profile;
}

export const clientProfileRepository = {
  syncClientCustomerProfile,
};
