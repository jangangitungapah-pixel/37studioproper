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
      description: 'Tracking rekaman',
      price: 150000,
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

function normalizeSession(item, index) {
  const fallback = DEFAULT_PRICING_SETTINGS.sessions[index] || DEFAULT_PRICING_SETTINGS.sessions[0];

  return {
    id: cleanText(item?.id, fallback?.id || makeSettingItemId('session')),
    name: cleanText(item?.name, fallback?.name || 'Session'),
    description: cleanText(item?.description, fallback?.description || 'Session studio'),
    price: toNumber(item?.price, fallback?.price || 0),
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
    durationHours: toNumber(item?.durationHours, 1),
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

export function getPricingSettings() {
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
}

export function savePricingSettings(settings) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    PRICING_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizePricingSettings(settings))
  );
}

export function getSessionOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).sessions.map((item) => ({
    key: item.id,
    label: item.name,
    description: item.description,
    rate: item.price,
    price: item.price,
  }));
}

export function getRecordingTypeOptions(settings = getPricingSettings()) {
  return normalizePricingSettings(settings).recordingTypes.map((item) => ({
    key: item.id,
    label: item.name,
    description: item.durationHours + ' jam • ' + formatRupiah(item.price),
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
