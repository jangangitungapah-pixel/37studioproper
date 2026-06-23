import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { useState, useEffect } from 'react';

export const PRICING_SETTINGS_STORAGE_KEY = '37musicstudio.pricing.settings.v1';

export const DEFAULT_PRICING_SETTINGS = {
  sessions: [
    {
      id: 'rehearsal',
      name: 'Rehearsal',
      description: 'Latihan studio reguler',
      price: 100000,
      locked: true,
    },
    {
      id: 'recording',
      name: 'Recording',
      description: 'Harga dan durasi mengikuti Recording Type',
      price: 0,
      locked: true,
    },
    {
      id: 'mixing',
      name: 'Mixing',
      description: 'Mixing audio',
      price: 250000,
      locked: true,
    },
    {
      id: 'mastering',
      name: 'Mastering',
      description: 'Final mastering',
      price: 300000,
      locked: true,
    },
  ],
  discounts: [],
  recordingTypes: [],
  packages: [],
};

export function makeSettingItemId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return prefix + '-' + crypto.randomUUID();
  }

  return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

export function isRecordingSessionId(sessionId) {
  return String(sessionId || '').trim().toLowerCase() === 'recording';
}

function normalizeSession(item, index) {
  const fallback = DEFAULT_PRICING_SETTINGS.sessions[index] || DEFAULT_PRICING_SETTINGS.sessions[0];
  const id = cleanText(item?.id, fallback?.id || makeSettingItemId('session'));
  const isRecording = isRecordingSessionId(id);

  return {
    id,
    name: cleanText(item?.name, fallback?.name || 'Session'),
    description: isRecording
      ? cleanText(item?.description, 'Harga dan durasi mengikuti Recording Type')
      : cleanText(item?.description, fallback?.description || 'Session studio'),
    price: isRecording ? 0 : toNumber(item?.price, fallback?.price || 0),
    locked: Boolean(item?.locked),
  };
}

function normalizeDiscount(item) {
  return {
    id: cleanText(item?.id, makeSettingItemId('discount')),
    nominal: toNumber(item?.nominal),
    durationHours: toNumber(item?.durationHours),
    sessionId: cleanText(item?.sessionId, 'rehearsal'),
  };
}

function normalizeRecordingType(item) {
  return {
    id: cleanText(item?.id, makeSettingItemId('recording')),
    name: cleanText(item?.name, 'Recording Type'),
    durationHours: toNumber(item?.durationHours),
    price: toNumber(item?.price),
  };
}

function normalizePackage(item) {
  return {
    id: cleanText(item?.id, makeSettingItemId('package')),
    name: cleanText(item?.name, 'Paket Studio'),
    detail: cleanText(item?.detail, 'Detail paket belum diisi'),
    durationHours: toNumber(item?.durationHours, 1),
    price: toNumber(item?.price),
  };
}

export function normalizePricingSettings(settings) {
  const source = settings && typeof settings === 'object' ? settings : DEFAULT_PRICING_SETTINGS;
  const sessionsSource = Array.isArray(source.sessions) && source.sessions.length
    ? source.sessions
    : DEFAULT_PRICING_SETTINGS.sessions;

  return {
    sessions: sessionsSource.map(normalizeSession),
    discounts: Array.isArray(source.discounts) ? source.discounts.map(normalizeDiscount) : [],
    recordingTypes: Array.isArray(source.recordingTypes) ? source.recordingTypes.map(normalizeRecordingType) : [],
    packages: Array.isArray(source.packages) ? source.packages.map(normalizePackage) : [],
  };
}

let cachedPricingSettings = (() => {
  if (typeof window === 'undefined') {
    return normalizePricingSettings(DEFAULT_PRICING_SETTINGS);
  }

  try {
    const raw = window.localStorage.getItem(PRICING_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT_PRICING_SETTINGS;

    return normalizePricingSettings(parsed);
  } catch {
    return normalizePricingSettings(DEFAULT_PRICING_SETTINGS);
  }
})();

export function getPricingSettings() {
  return cachedPricingSettings;
}

export async function savePricingSettings(settings) {
  const normalized = normalizePricingSettings(settings);
  cachedPricingSettings = normalized;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        PRICING_SETTINGS_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
          // Browser storage / verifier cleanup can fail in restricted contexts.
        }
  }

  if (isFirebaseConfigured && firestoreDb) {
    try {
      const docRef = doc(firestoreDb, 'settings', 'pricing');
      await setDoc(docRef, normalized);
    } catch (err) {
      console.error('Failed to save pricing settings to Firestore:', err);
    }
  }
}

let listeners = [];
let isSubscribed = false;

export function subscribePricingSettings(callback) {
  listeners.push(callback);

  // Trigger immediately with current cached value
  callback(cachedPricingSettings);

  if (!isSubscribed && isFirebaseConfigured && firestoreDb) {
    isSubscribed = true;
    const docRef = doc(firestoreDb, 'settings', 'pricing');

    onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const remote = normalizePricingSettings(docSnap.data());
          cachedPricingSettings = remote;

          // Backup to localStorage
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(PRICING_SETTINGS_STORAGE_KEY, JSON.stringify(remote));
            } catch {
          // Browser storage / verifier cleanup can fail in restricted contexts.
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
          savePricingSettings(cachedPricingSettings);
        }
      },
      (err) => {
        console.error('Error in onSnapshot for pricing settings:', err);
      }
    );
  }

  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

export function usePricingSettings() {
  const [settings, setSettings] = useState(cachedPricingSettings);

  useEffect(() => {
    return subscribePricingSettings(setSettings);
  }, []);

  return settings;
}

export function getSessionOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).sessions.map((item) => {
    const isRecording = isRecordingSessionId(item.id);

    return {
      key: item.id,
      label: item.name,
      description: isRecording ? 'Pilih Recording Type untuk harga dan durasi' : item.description,
      priceMode: isRecording ? 'recording-type' : 'hourly',
      rate: isRecording ? 0 : item.price,
      price: isRecording ? 0 : item.price,
    };
  });
}

export function getRecordingTypeOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).recordingTypes.map((item) => ({
    key: item.id,
    label: item.name,
    description: (item.durationHours ? item.durationHours + ' jam' : 'Tanpa durasi studio') + ' • ' + formatRupiah(item.price),
    durationHours: item.durationHours,
    price: item.price,
  }));
}

export function getPackageOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).packages.map((item) => ({
    key: item.id,
    label: item.name,
    description: item.durationHours + ' jam • ' + formatRupiah(item.price),
    detail: item.detail,
    durationHours: item.durationHours,
    price: item.price,
  }));
}

export function getDiscountOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).discounts.map((item) => ({
    key: item.id,
    label: formatRupiah(item.nominal),
    description: item.durationHours + ' jam • ' + item.sessionId,
    nominal: item.nominal,
    durationHours: item.durationHours,
    sessionId: item.sessionId,
  }));
}

function findByKey(items, key) {
  return items.find((item) => item.key === key) || items[0] || null;
}

function findPackage(settings, packageId) {
  if (!packageId || packageId === 'none') return null;

  return normalizePricingSettings(settings).packages.find((item) => item.id === packageId) || null;
}

function getApplicableDiscounts(settings, sessionId, durationHours, subtotal) {
  if (!sessionId || !durationHours || !subtotal) return [];

  return normalizePricingSettings(settings).discounts
    .filter((discount) => {
      const sameSession = discount.sessionId === sessionId;
      const meetsDuration = Number(durationHours) >= Number(discount.durationHours);
      const hasNominal = Number(discount.nominal) > 0;

      return sameSession && meetsDuration && hasNominal;
    })
    .sort((first, second) => {
      if (second.nominal !== first.nominal) return second.nominal - first.nominal;
      return second.durationHours - first.durationHours;
    });
}

function pickBestDiscount(settings, sessionId, durationHours, subtotal) {
  const applicableDiscounts = getApplicableDiscounts(settings, sessionId, durationHours, subtotal);
  const bestDiscount = applicableDiscounts[0] || null;

  if (!bestDiscount) {
    return {
      discountAmount: 0,
      appliedDiscounts: [],
    };
  }

  const discountAmount = Math.min(Number(bestDiscount.nominal) || 0, Math.max(0, Number(subtotal) || 0));

  return {
    discountAmount,
    appliedDiscounts: [
      {
        id: bestDiscount.id,
        nominal: discountAmount,
        originalNominal: bestDiscount.nominal,
        durationHours: bestDiscount.durationHours,
        sessionId: bestDiscount.sessionId,
      },
    ],
  };
}

function getPaymentBreakdown(paymentStatus, dpAmount, finalTotal) {
  const safeTotal = Math.max(0, Number(finalTotal) || 0);
  const safeDp = Math.min(Math.max(0, Number(dpAmount) || 0), safeTotal);

  if (paymentStatus === 'lunas') {
    return {
      paidAmount: safeTotal,
      dpAmount: safeTotal,
      invoiceAmount: 0,
    };
  }

  if (paymentStatus === 'dp') {
    return {
      paidAmount: safeDp,
      dpAmount: safeDp,
      invoiceAmount: Math.max(0, safeTotal - safeDp),
    };
  }

  return {
    paidAmount: 0,
    dpAmount: 0,
    invoiceAmount: safeTotal,
  };
}

export function resolveBookingPricing({
  customDurationHours = 0,
  durationHours = 0,
  packageId = 'none',
  paymentStatus = 'pending',
  dpAmount = 0,
  pricingSettings = getPricingSettings(),
  recordingTypeId = 'none',
  sessionId = 'rehearsal',
} = {}) {
  const settings = normalizePricingSettings(pricingSettings);
  const sessionOptions = getSessionOptions(settings);
  const recordingTypeOptions = getRecordingTypeOptions(settings);
  const packageItem = findPackage(settings, packageId);

  if (packageItem) {
    const subtotal = Number(packageItem.price) || 0;
    const finalTotal = subtotal;
    const payment = getPaymentBreakdown(paymentStatus, dpAmount, finalTotal);

    return {
      mode: 'package',
      packageItem: {
        key: packageItem.id,
        label: packageItem.name,
        description: packageItem.detail,
        durationHours: packageItem.durationHours,
        price: packageItem.price,
      },
      session: {
        key: 'package',
        label: packageItem.name,
        description: packageItem.detail,
        rate: packageItem.price,
        price: packageItem.price,
      },
      recordingType: null,
      durationHours: Number(packageItem.durationHours) || 0,
      subtotal,
      discountAmount: 0,
      appliedDiscounts: [],
      total: finalTotal,
      finalTotal,
      ...payment,
    };
  }

  const selectedSession = findByKey(sessionOptions, sessionId) || {
    key: 'rehearsal',
    label: 'Rehearsal',
    description: 'Latihan studio reguler',
    rate: 0,
    price: 0,
  };

  const selectedRecordingType =
    selectedSession.key === 'recording' && recordingTypeId !== 'none'
      ? findByKey(recordingTypeOptions, recordingTypeId)
      : null;

  const resolvedDuration = selectedRecordingType
    ? Number(selectedRecordingType.durationHours) || 0
    : Number(customDurationHours) || Number(durationHours) || 0;

  const subtotal = selectedRecordingType
    ? Number(selectedRecordingType.price) || 0
    : (Number(selectedSession.rate) || 0) * resolvedDuration;

  const discount = pickBestDiscount(settings, selectedSession.key, resolvedDuration, subtotal);
  const finalTotal = Math.max(0, subtotal - discount.discountAmount);
  const payment = getPaymentBreakdown(paymentStatus, dpAmount, finalTotal);

  return {
    mode: selectedRecordingType ? 'recording-type' : 'session',
    packageItem: null,
    session: selectedSession,
    recordingType: selectedRecordingType,
    durationHours: resolvedDuration,
    subtotal,
    discountAmount: discount.discountAmount,
    appliedDiscounts: discount.appliedDiscounts,
    total: finalTotal,
    finalTotal,
    ...payment,
  };
}
