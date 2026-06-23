export const OWNER_EMAIL = 'marsicprod@gmail.com';
export const STUDIO_GUARD_ROLE = 'studio_guard';
export const guardPortalPermissionKeys = ['schedule', 'customers', 'billing', 'inventory'];

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
    key: 'operator-fee',
    label: 'Operator Fee',
    description: 'Review fee operator recording dan fee penjaga dari booking.',
  },
  {
    key: 'guard-attendance',
    label: 'Absen Penjaga',
    description: 'Approval absen penjaga studio untuk aktivasi fee dan uang makan.',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock, asset studio, movement log, dan maintenance.',
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Pengelolaan galeri foto studio.',
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

export const defaultGuardPortalPermissions = adminPermissionPages.reduce((result, page) => ({
  ...result,
  [page.key]: guardPortalPermissionKeys.includes(page.key),
}), {});

export function normalizeAdminPermissions(permissions, fallbackValue = true) {
  const source = permissions && typeof permissions === 'object' ? permissions : {};

  return adminPermissionPages.reduce((result, page) => ({
    ...result,
    [page.key]: typeof source[page.key] === 'boolean' ? source[page.key] : fallbackValue,
  }), {});
}

export function normalizeAdminPermissionsForRole(permissions, role) {
  const normalized = normalizeAdminPermissions(
    permissions,
    role === STUDIO_GUARD_ROLE ? false : true,
  );

  if (role !== STUDIO_GUARD_ROLE) return normalized;

  return adminPermissionPages.reduce((result, page) => ({
    ...result,
    [page.key]: guardPortalPermissionKeys.includes(page.key) && normalized[page.key] === true,
  }), {});
}

export function getAssignablePermissionPages(user) {
  if (user?.role === STUDIO_GUARD_ROLE) {
    return adminPermissionPages.filter((page) => guardPortalPermissionKeys.includes(page.key));
  }

  return adminPermissionPages;
}

export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL;
}

export function isOwnerAdminUser(user) {
  if (!user) return false;
  if (user.role === 'owner' || user.isOwner) return true;
  if (user.role) return false;

  return isOwnerEmail(user.email);
}

export function isStudioGuardUser(user) {
  return Boolean(user && user.role === STUDIO_GUARD_ROLE && user.status === 'approved');
}

export function hasAdminPagePermission(user, pageKey) {
  if (!user) return true;
  if (isOwnerAdminUser(user)) return true;

  const permissions = normalizeAdminPermissionsForRole(user.permissions, user.role);

  if (isStudioGuardUser(user)) {
    return permissions[pageKey] === true;
  }

  return permissions[pageKey] !== false;
}

export function countEnabledAdminPermissions(permissions, role = '') {
  return Object.values(normalizeAdminPermissionsForRole(permissions, role)).filter(Boolean).length;
}
