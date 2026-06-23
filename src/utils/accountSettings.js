export const ACCOUNT_SETTINGS_STORAGE_KEY = '37musicstudio.account.settings.v1';

export const defaultAccountPreferences = {
  accountNote: '',
  defaultLandingKey: 'dashboard',
  notificationLevel: 'important',
  preferredContact: 'email',
};

export const accountLandingOptions = [
  { key: 'dashboard', label: 'Dashboard', description: 'Ringkasan utama setelah login' },
  { key: 'schedule', label: 'Schedule', description: 'Langsung ke kalender booking' },
  { key: 'billing', label: 'Billing', description: 'Langsung ke invoice dan pembayaran' },
  { key: 'bookkeeping', label: 'Pembukuan', description: 'Langsung ke cashflow studio' },
  { key: 'operator-fee', label: 'Operator Fee', description: 'Langsung ke review fee crew' },
  { key: 'guard-attendance', label: 'Absen Penjaga', description: 'Langsung ke approval absen penjaga' },
  { key: 'inventory', label: 'Inventory', description: 'Langsung ke stock dan asset' },
  { key: 'settings', label: 'Settings', description: 'Langsung ke pengaturan admin' },
];

export const accountContactOptions = [
  { key: 'email', label: 'Email', description: 'Prioritaskan email akun' },
  { key: 'phone', label: 'Nomor HP', description: 'Prioritaskan nomor HP akun' },
  { key: 'none', label: 'Tidak Ditentukan', description: 'Belum memilih kontak utama' },
];

export const accountNotificationOptions = [
  { key: 'important', label: 'Penting Saja', description: 'Hanya info penting dan akses akun' },
  { key: 'standard', label: 'Standar', description: 'Info penting dan reminder operasional' },
  { key: 'proactive', label: 'Proaktif', description: 'Info penting, reminder, dan rekomendasi' },
];

const landingPathMap = {
  billing: '/admin/billing',
  bookkeeping: '/admin/bookkeeping',
  dashboard: '/admin/dashboard',
  'guard-attendance': '/admin/guard-attendance',
  inventory: '/admin/inventory',
  'operator-fee': '/admin/operator-fee',
  schedule: '/admin/schedule',
  settings: '/admin/settings',
};

function getStorageKey(uid) {
  const accountKey = String(uid || 'default').trim() || 'default';

  return ACCOUNT_SETTINGS_STORAGE_KEY + '.' + accountKey;
}

export function normalizeAccountPreferences(preferences = {}) {
  const source = preferences && typeof preferences === 'object' ? preferences : {};
  const landingKeys = accountLandingOptions.map((item) => item.key);
  const contactKeys = accountContactOptions.map((item) => item.key);
  const notificationKeys = accountNotificationOptions.map((item) => item.key);

  return {
    accountNote: String(source.accountNote || '').slice(0, 240),
    defaultLandingKey: landingKeys.includes(source.defaultLandingKey) ? source.defaultLandingKey : defaultAccountPreferences.defaultLandingKey,
    notificationLevel: notificationKeys.includes(source.notificationLevel) ? source.notificationLevel : defaultAccountPreferences.notificationLevel,
    preferredContact: contactKeys.includes(source.preferredContact) ? source.preferredContact : defaultAccountPreferences.preferredContact,
  };
}

export function readAccountPreferences(uid) {
  if (typeof window === 'undefined') return defaultAccountPreferences;

  try {
    const raw = window.localStorage.getItem(getStorageKey(uid));
    const parsed = raw ? JSON.parse(raw) : defaultAccountPreferences;

    return normalizeAccountPreferences(parsed);
  } catch {
    return defaultAccountPreferences;
  }
}

export function writeAccountPreferences(uid, preferences) {
  const nextPreferences = normalizeAccountPreferences(preferences);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getStorageKey(uid), JSON.stringify(nextPreferences));
  }

  return nextPreferences;
}

export function resetAccountPreferences(uid) {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(getStorageKey(uid));
  }

  return defaultAccountPreferences;
}

export function getAccountDefaultLandingPath(uid) {
  const preferences = readAccountPreferences(uid);

  return landingPathMap[preferences.defaultLandingKey] || landingPathMap.dashboard;
}
