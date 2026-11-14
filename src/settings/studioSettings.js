import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';

export const STUDIO_SETTINGS_STORAGE_KEY = '37musicstudio.studio.settings.v1';

export const LANDING_HERO_DEFAULT_URL = '/images/studio_hero_banner.png';
export const LANDING_EXTRA_MEDIA_LIMIT = 12;

export const LANDING_MEDIA_FOCUS_PRESETS = [
  { key: '50% 48%', label: 'Tengah (Seimbang)' },
  { key: '50% 22%', label: 'Fokus Atas' },
  { key: '50% 78%', label: 'Fokus Bawah' },
  { key: '16% 52%', label: 'Sisi Kiri' },
  { key: '84% 52%', label: 'Sisi Kanan' },
];

export const LANDING_MEDIA_SPOT_DEFAULTS = [
  {
    slotKey: 'spot1',
    shortLabel: '01',
    slotLabel: 'Pratinjau 01 (Utama)',
    slotDescription: 'Kartu besar kiri di section Pratinjau Ruang.',
    badge: 'Meja Kontrol & Monitoring',
    title: 'Ruang kerja untuk mendengar detail lagu dengan jelas',
    caption: 'Tampilan area kontrol 37 Music Studio saat persiapan sesi.',
    objectPosition: '50% 48%',
    transformOrigin: '50% 48%',
    scale: 1.02,
    featured: true,
  },
  {
    slotKey: 'spot2',
    shortLabel: '02',
    slotLabel: 'Pratinjau 02 (Kanan Atas)',
    slotDescription: 'Kartu kanan atas di section Pratinjau Ruang.',
    badge: 'Sudut Akustik & Santai',
    title: 'Atmosfer hangat untuk diskusi aransemen',
    caption: 'Area sofa dan panel akustik kayu di dalam ruang studio.',
    objectPosition: '6% 72%',
    transformOrigin: '10% 72%',
    scale: 1.38,
    featured: false,
  },
  {
    slotKey: 'spot3',
    shortLabel: '03',
    slotLabel: 'Pratinjau 03 (Kanan Bawah)',
    slotDescription: 'Kartu kanan bawah di section Pratinjau Ruang.',
    badge: 'Area Instrumen & Eksplorasi',
    title: 'Sudut penulisan lagu dan pemanasan sebelum take',
    caption: 'Sudut instrumen yang terlihat pada foto studio utama.',
    objectPosition: '94% 64%',
    transformOrigin: '92% 64%',
    scale: 1.38,
    featured: false,
  },
];

export const defaultLandingMedia = {
  hero: {
    galleryId: '',
    url: '',
    alt: '',
    objectPosition: '50% 48%',
  },
  spots: LANDING_MEDIA_SPOT_DEFAULTS.map((spot) => ({
    slotKey: spot.slotKey,
    galleryId: '',
    url: '',
    badge: '',
    title: '',
    caption: '',
    objectPosition: '',
  })),
  galleryExtras: [],
  updatedAt: '',
};

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
  landingMedia: defaultLandingMedia,
  updatedAt: '',
};

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function cleanMediaUrl(value) {
  const url = cleanText(value);
  if (!url) return '';
  if (url.startsWith('/')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url;
    }
  } catch {
    return '';
  }

  return '';
}

function cleanObjectPosition(value, fallback = '') {
  const raw = cleanText(value);
  if (!raw) return fallback;
  const isValid = /^(\d{1,3}%|\d+px|center|left|right|top|bottom)(\s+(\d{1,3}%|\d+px|center|left|right|top|bottom))?$/i.test(raw);
  return isValid ? raw : fallback;
}

export function normalizeLandingMedia(value) {
  const source = value && typeof value === 'object' ? value : {};
  const heroSource = source.hero && typeof source.hero === 'object' ? source.hero : {};
  const rawSpots = Array.isArray(source.spots) ? source.spots : [];
  const rawExtras = Array.isArray(source.galleryExtras) ? source.galleryExtras : [];

  const heroUrl = cleanMediaUrl(heroSource.url);
  const hero = {
    galleryId: heroUrl ? cleanText(heroSource.galleryId) : '',
    url: heroUrl,
    alt: heroUrl ? cleanText(heroSource.alt) : '',
    objectPosition: cleanObjectPosition(heroSource.objectPosition, defaultLandingMedia.hero.objectPosition),
  };

  const spots = LANDING_MEDIA_SPOT_DEFAULTS.map((slotDefault) => {
    const matched = rawSpots.find((item) => item && item.slotKey === slotDefault.slotKey) || {};
    const url = cleanMediaUrl(matched.url);

    return {
      slotKey: slotDefault.slotKey,
      galleryId: url ? cleanText(matched.galleryId) : '',
      url,
      badge: cleanText(matched.badge),
      title: cleanText(matched.title),
      caption: cleanText(matched.caption),
      objectPosition: url
        ? cleanObjectPosition(matched.objectPosition, '50% 50%')
        : cleanObjectPosition(matched.objectPosition, ''),
    };
  });

  const seenExtraKeys = new Set();
  const galleryExtras = [];

  for (const item of rawExtras) {
    if (!item || typeof item !== 'object') continue;
    const url = cleanMediaUrl(item.url);
    if (!url) continue;

    const galleryId = cleanText(item.galleryId);
    const dedupeKey = galleryId || url;
    if (seenExtraKeys.has(dedupeKey)) continue;
    seenExtraKeys.add(dedupeKey);

    galleryExtras.push({
      galleryId,
      url,
      title: cleanText(item.title),
      caption: cleanText(item.caption),
      category: cleanText(item.category),
      objectPosition: cleanObjectPosition(item.objectPosition, '50% 50%'),
    });

    if (galleryExtras.length >= LANDING_EXTRA_MEDIA_LIMIT) break;
  }

  return {
    hero,
    spots,
    galleryExtras,
    updatedAt: cleanText(source.updatedAt),
  };
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
    landingMedia: normalizeLandingMedia(source.landingMedia),
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

/**
 * Resolve hero photo configuration with static studio fallback.
 */
export function resolveLandingHeroMedia(studioSettings = cachedStudioSettings) {
  const normalized = normalizeStudioSettings(studioSettings).landingMedia;
  const isCustom = Boolean(normalized.hero.url);

  return {
    url: isCustom ? normalized.hero.url : LANDING_HERO_DEFAULT_URL,
    isCustom,
    galleryId: normalized.hero.galleryId,
    alt: normalized.hero.alt,
    objectPosition: normalized.hero.objectPosition || '50% 48%',
  };
}

/**
 * Resolve the 3 editorial showcase frames with per-slot overrides or default zoom framing.
 */
export function resolveLandingAtmosphereSpots(studioSettings = cachedStudioSettings) {
  const normalized = normalizeStudioSettings(studioSettings).landingMedia;

  return LANDING_MEDIA_SPOT_DEFAULTS.map((slotDefault) => {
    const customSpot = normalized.spots.find((item) => item.slotKey === slotDefault.slotKey) || {};
    const isCustom = Boolean(customSpot.url);

    return {
      id: slotDefault.slotKey,
      slotKey: slotDefault.slotKey,
      shortLabel: slotDefault.shortLabel,
      slotLabel: slotDefault.slotLabel,
      slotDescription: slotDefault.slotDescription,
      galleryId: customSpot.galleryId || '',
      url: isCustom ? customSpot.url : LANDING_HERO_DEFAULT_URL,
      isCustom,
      badge: cleanText(customSpot.badge, slotDefault.badge),
      title: cleanText(customSpot.title, slotDefault.title),
      caption: cleanText(customSpot.caption, slotDefault.caption),
      objectPosition: isCustom
        ? (customSpot.objectPosition || '50% 50%')
        : (customSpot.objectPosition || slotDefault.objectPosition),
      transformOrigin: isCustom ? 'center' : slotDefault.transformOrigin,
      scale: isCustom ? 1 : slotDefault.scale,
      featured: slotDefault.featured,
    };
  });
}

/**
 * Resolve optional extra curated gallery photos for the landing showcase.
 */
export function resolveLandingExtraGalleryItems(studioSettings = cachedStudioSettings) {
  return normalizeStudioSettings(studioSettings).landingMedia.galleryExtras;
}

function matchesGalleryPhoto(entry, photo) {
  if (!entry || !photo) return false;
  if (entry.galleryId && photo.id && entry.galleryId === photo.id) return true;
  if (entry.url && photo.url && entry.url === photo.url) return true;
  return false;
}

/**
 * Return current landing slot assignments for a single gallery item.
 */
export function getPhotoLandingAssignments(photo, studioSettings = cachedStudioSettings) {
  const media = normalizeStudioSettings(studioSettings).landingMedia;
  const hero = Boolean(media.hero.url && matchesGalleryPhoto(media.hero, photo));
  const spots = media.spots
    .filter((spot) => spot.url && matchesGalleryPhoto(spot, photo))
    .map((spot) => spot.slotKey);
  const isExtra = media.galleryExtras.some((item) => matchesGalleryPhoto(item, photo));

  const badges = [];
  if (hero) badges.push('Hero');
  if (spots.includes('spot1')) badges.push('01');
  if (spots.includes('spot2')) badges.push('02');
  if (spots.includes('spot3')) badges.push('03');
  if (isExtra) badges.push('Galeri');

  return {
    hero,
    spots,
    isExtra,
    badges,
    isActive: badges.length > 0,
  };
}

/**
 * Count how many of the 4 editorial slots use custom admin-selected media.
 */
export function countCustomLandingSlots(studioSettings = cachedStudioSettings) {
  const media = normalizeStudioSettings(studioSettings).landingMedia;
  const customSpots = media.spots.filter((spot) => Boolean(spot.url)).length;
  return (media.hero.url ? 1 : 0) + customSpots;
}

/**
 * Remove any deleted/trashed gallery items from active landing media slots.
 */
export function detachDeletedGalleryPhotosFromLandingMedia(currentLandingMedia, deletedPhotos = []) {
  const media = normalizeLandingMedia(currentLandingMedia);
  const list = Array.isArray(deletedPhotos) ? deletedPhotos : [];
  if (!list.length) return { nextLandingMedia: media, detachedCount: 0 };

  let detachedCount = 0;

  const isMatched = (entry) => list.some((photo) => matchesGalleryPhoto(entry, photo));

  const nextHero = media.hero.url && isMatched(media.hero)
    ? (detachedCount += 1, { ...defaultLandingMedia.hero })
    : media.hero;

  const nextSpots = media.spots.map((spot) => {
    if (spot.url && isMatched(spot)) {
      detachedCount += 1;
      return {
        slotKey: spot.slotKey,
        galleryId: '',
        url: '',
        badge: '',
        title: '',
        caption: '',
        objectPosition: '',
      };
    }
    return spot;
  });

  const nextExtras = media.galleryExtras.filter((item) => {
    if (isMatched(item)) {
      detachedCount += 1;
      return false;
    }
    return true;
  });

  return {
    nextLandingMedia: normalizeLandingMedia({
      hero: nextHero,
      spots: nextSpots,
      galleryExtras: nextExtras,
      updatedAt: detachedCount ? new Date().toISOString() : media.updatedAt,
    }),
    detachedCount,
  };
}
