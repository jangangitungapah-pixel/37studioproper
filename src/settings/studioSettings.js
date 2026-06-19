import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export const STUDIO_SETTINGS_STORAGE_KEY = '37musicstudio.studio.settings.v1';

export const defaultStudioSettings = {
  studioName: '37 Music Studio',
  studioAddress: '',
  studioPhone: '',
  bankName: 'Bank BCA',
  bankAccountNumber: '3728902822',
  bankAccountHolder: '37 MUSIC STUDIO',
  qrisLabel: 'Scan di kasir studio',
  qrisNote: 'Mendukung GoPay, OVO, ShopeePay',
  paymentTerms: [
    'DP minimal sebesar Rp 50.000 diperlukan untuk mengunci slot jika melakukan booking jarak jauh.',
    'Pelunasan dapat dilakukan langsung di studio sebelum latihan dimulai.',
    'Pembatalan sesi < 24 jam menyebabkan DP hangus.',
  ],
  updatedAt: '',
};

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function cleanTerms(value) {
  const source = Array.isArray(value) && value.length
    ? value
    : defaultStudioSettings.paymentTerms;

  const terms = source
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 12);

  return terms.length ? terms : defaultStudioSettings.paymentTerms;
}

export function normalizeStudioSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};

  return {
    ...defaultStudioSettings,
    ...source,
    studioName: cleanText(source.studioName, defaultStudioSettings.studioName),
    studioAddress: cleanText(source.studioAddress),
    studioPhone: cleanText(source.studioPhone),
    bankName: cleanText(source.bankName, defaultStudioSettings.bankName),
    bankAccountNumber: cleanText(source.bankAccountNumber, defaultStudioSettings.bankAccountNumber),
    bankAccountHolder: cleanText(source.bankAccountHolder, defaultStudioSettings.bankAccountHolder),
    qrisLabel: cleanText(source.qrisLabel, defaultStudioSettings.qrisLabel),
    qrisNote: cleanText(source.qrisNote, defaultStudioSettings.qrisNote),
    paymentTerms: cleanTerms(source.paymentTerms),
    updatedAt: cleanText(source.updatedAt),
  };
}

let cachedStudioSettings = (() => {
  if (typeof window === 'undefined') return normalizeStudioSettings(defaultStudioSettings);

  try {
    const raw = window.localStorage.getItem(STUDIO_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return normalizeStudioSettings(parsed);
  } catch (error) {
    console.error('Gagal membaca studio settings lokal:', error);
    return normalizeStudioSettings(defaultStudioSettings);
  }
})();

function cacheStudioSettings(settings) {
  cachedStudioSettings = normalizeStudioSettings(settings);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(cachedStudioSettings));
    } catch (error) {
      console.error('Gagal menyimpan studio settings lokal:', error);
    }
  }

  return cachedStudioSettings;
}

export function readStudioSettings() {
  return cachedStudioSettings;
}

export async function saveStudioSettings(settings) {
  const cleanSettings = cacheStudioSettings(settings);

  if (isFirebaseConfigured && firestoreDb) {
    const docRef = doc(firestoreDb, 'settings', 'studio');
    await setDoc(docRef, cleanSettings);
  }

  notifyStudioSettingsListeners(cleanSettings);

  return cleanSettings;
}

export function writeStudioSettings(settings) {
  const cleanSettings = cacheStudioSettings(settings);

  if (isFirebaseConfigured && firestoreDb) {
    const docRef = doc(firestoreDb, 'settings', 'studio');
    setDoc(docRef, cleanSettings).catch((error) => {
      console.error('Failed to background save studio settings to Firestore:', error);
    });
  }

  notifyStudioSettingsListeners(cleanSettings);

  return cleanSettings;
}

let listeners = [];
let isSubscribed = false;

function notifyStudioSettingsListeners(settings) {
  listeners.forEach((callback) => {
    try {
      callback(settings);
    } catch (error) {
      console.error('Studio settings listener callback error:', error);
    }
  });
}

export function subscribeStudioSettings(callback) {
  listeners.push(callback);
  callback(cachedStudioSettings);

  if (!isSubscribed && isFirebaseConfigured && firestoreDb) {
    isSubscribed = true;
    const docRef = doc(firestoreDb, 'settings', 'studio');

    onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          callback(cachedStudioSettings);
          return;
        }

        const remote = cacheStudioSettings(docSnap.data());
        notifyStudioSettingsListeners(remote);
      },
      (error) => {
        console.error('Error in onSnapshot for studio settings:', error);
      }
    );
  }

  return () => {
    listeners = listeners.filter((item) => item !== callback);
  };
}

export function useStudioSettings() {
  const [settings, setSettings] = useState(cachedStudioSettings);

  useEffect(() => {
    return subscribeStudioSettings(setSettings);
  }, []);

  return settings;
}

export function formatBankAccountNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) return '-';

  return digits.replace(/(.{4})/g, '$1 - ').replace(/ - $/, '');
}

export function normalizeStudioPhoneForWhatsApp(value) {
  let cleaned = String(value || '').replace(/\D/g, '');

  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
  if (cleaned.startsWith('8')) cleaned = '62' + cleaned;

  return cleaned;
}

export function getStudioPaymentTerms(settings = cachedStudioSettings) {
  return normalizeStudioSettings(settings).paymentTerms;
}

export function mergeStudioSettingsIntoInvoiceSettings(invoiceSettings, studioSettings) {
  const studio = normalizeStudioSettings(studioSettings);

  return {
    ...invoiceSettings,
    studioName: studio.studioName || invoiceSettings?.studioName || defaultStudioSettings.studioName,
    phone: studio.studioPhone || invoiceSettings?.phone || '',
    address: studio.studioAddress || invoiceSettings?.address || '',
  };
}
