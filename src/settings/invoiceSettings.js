import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { useState, useEffect } from 'react';

export const INVOICE_SETTINGS_STORAGE_KEY = '37musicstudio.billing.invoice-settings.v1';

export const defaultInvoiceSettings = {
  studioName: '37 Music Studio',
  subtitle: 'Invoice Digital',
  phone: '',
  address: '',
  footer: 'Terima kasih sudah booking.',
  paperSize: '80mm',
  updatedAt: '',
};

export const paperSizeOptions = [
  { key: '80mm', label: 'Thermal 80mm', description: 'Ukuran struk umum' },
  { key: '58mm', label: 'Thermal 58mm', description: 'Ukuran struk kecil' },
];

export function normalizeInvoiceSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};

  return {
    ...defaultInvoiceSettings,
    ...source,
    studioName: String(source.studioName || defaultInvoiceSettings.studioName).trim() || defaultInvoiceSettings.studioName,
    subtitle: String(source.subtitle || defaultInvoiceSettings.subtitle).trim() || defaultInvoiceSettings.subtitle,
    phone: String(source.phone || '').trim(),
    address: String(source.address || '').trim(),
    footer: String(source.footer || defaultInvoiceSettings.footer).trim() || defaultInvoiceSettings.footer,
    paperSize: paperSizeOptions.some((item) => item.key === source.paperSize)
      ? source.paperSize
      : defaultInvoiceSettings.paperSize,
    updatedAt: source.updatedAt || '',
  };
}

let cachedInvoiceSettings = (() => {
  if (typeof window === 'undefined') return normalizeInvoiceSettings(defaultInvoiceSettings);

  try {
    const raw = window.localStorage.getItem(INVOICE_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return normalizeInvoiceSettings(parsed);
  } catch (error) {
    console.error('Gagal membaca invoice settings lokal:', error);
    return normalizeInvoiceSettings(defaultInvoiceSettings);
  }
})();

export function readInvoiceSettings() {
  return cachedInvoiceSettings;
}

export async function saveInvoiceSettings(settings) {
  const cleanSettings = normalizeInvoiceSettings(settings);
  cachedInvoiceSettings = cleanSettings;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(INVOICE_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));
    } catch (error) {
      console.error('Gagal menyimpan invoice settings lokal:', error);
    }
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'settings', 'invoice');
      await setDoc(docRef, cleanSettings);
    } catch (err) {
      console.error('Failed to save invoice settings to Firestore:', err);
    }
  }

  return cleanSettings;
}

export function writeInvoiceSettings(settings) {
  const cleanSettings = normalizeInvoiceSettings(settings);
  cachedInvoiceSettings = cleanSettings;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(INVOICE_SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings));
    } catch (error) {
      console.error('Gagal menyimpan invoice settings lokal:', error);
    }
  }

  if (isFirebaseConfigured && firestoreDb) {
    const docRef = doc(firestoreDb, 'settings', 'invoice');
    setDoc(docRef, cleanSettings).catch((err) => {
      console.error('Failed to background save invoice settings to Firestore:', err);
    });
  }

  return cleanSettings;
}

let listeners = [];
let isSubscribed = false;

export function subscribeInvoiceSettings(callback) {
  listeners.push(callback);

  // Trigger immediately with current cached value
  callback(cachedInvoiceSettings);

  if (!isSubscribed && isFirebaseConfigured && firestoreDb) {
    isSubscribed = true;
    const docRef = doc(firestoreDb, 'settings', 'invoice');

    onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remote = normalizeInvoiceSettings(docSnap.data());
          cachedInvoiceSettings = remote;

          // Backup to localStorage
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(INVOICE_SETTINGS_STORAGE_KEY, JSON.stringify(remote));
            } catch {
              // Ignore
            }
          }

          // Notify all subscribers
          listeners.forEach((cb) => {
            try {
              cb(remote);
            } catch (err) {
              console.error('Listener callback error:', err);
            }
          });
        } else {
          // Document does not exist in Firestore yet, initialize it
          saveInvoiceSettings(cachedInvoiceSettings);
        }
      },
      (err) => {
        console.error('Error in onSnapshot for invoice settings:', err);
      }
    );
  }

  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

export function useInvoiceSettings() {
  const [settings, setSettings] = useState(cachedInvoiceSettings);

  useEffect(() => {
    return subscribeInvoiceSettings(setSettings);
  }, []);

  return settings;
}
