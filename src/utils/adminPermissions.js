export const OWNER_EMAIL = 'marsicprod@gmail.com';

export const adminPermissionPages = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview utama studio, chart, dan ringkasan lintas halaman.',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Kalender booking dan pengelolaan jadwal studio.',
  },
  {
    key: 'customers',
    label: 'Customer',
    description: 'CRM customer, detail pelanggan, dan riwayat booking.',
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Invoice, pembayaran, DP, dan outstanding tagihan.',
  },
  {
    key: 'bookkeeping',
    label: 'Pembukuan',
    description: 'Cashflow, pemasukan manual, pengeluaran, dan laporan.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock, asset studio, movement log, dan maintenance.',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Pengaturan harga, invoice, account, dan approval admin.',
  },
];

export const defaultAdminPermissions = adminPermissionPages.reduce((result, page) => ({
  ...result,
  [page.key]: true,
}), {});

export function normalizeAdminPermissions(permissions, fallbackValue = true) {
  const source = permissions && typeof permissions === 'object' ? permissions : {};

  return adminPermissionPages.reduce((result, page) => ({
    ...result,
    [page.key]: typeof source[page.key] === 'boolean' ? source[page.key] : fallbackValue,
  }), {});
}

export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL;
}

export function isOwnerAdminUser(user) {
  return isOwnerEmail(user?.email);
}

export function hasAdminPagePermission(user, pageKey) {
  if (!user) return true;
  if (isOwnerAdminUser(user)) return true;

  const permissions = user.permissions;

  if (!permissions) return true;

  return normalizeAdminPermissions(permissions, true)[pageKey] !== false;
}

export function countEnabledAdminPermissions(permissions) {
  return Object.values(normalizeAdminPermissions(permissions, true)).filter(Boolean).length;
}
