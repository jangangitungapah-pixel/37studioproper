/**
 * Canonical Admin Information Architecture.
 *
 * Phase 2A goals:
 * - centralize route metadata;
 * - introduce grouped navigation;
 * - move finance/operations/content modules to canonical URL namespaces;
 * - preserve old admin URLs through redirects;
 * - keep legacy permission compatibility during permission migrations;
 * - keep Notifications in the topbar instead of the sidebar.
 *
 * Request Inbox is introduced during Phase 3A Booking Command Center.
 * All Bookings is introduced during Phase 3D as the global booking index.
 */

export const ADMIN_NAV_GROUPS = Object.freeze({
  BOOKING: 'booking',
  FINANCE: 'finance',
  OPERATIONS: 'operations',
  CONTENT: 'content',
});

export const ADMIN_MOBILE_PRIMARY_KEYS = Object.freeze([
  'dashboard',
  'requests',
  'schedule',
  'billing',
]);

export const ADMIN_NAV_ITEMS = Object.freeze([
  Object.freeze({
    key: 'dashboard',
    label: 'Dashboard',
    mobileLabel: 'Home',
    path: '/admin/dashboard',
    iconKey: 'dashboard',
    title: 'Dashboard',
    permissionKey: 'dashboard',
    group: '',
    groupLabel: '',
    sidebar: true,
    mobile: true,
    legacyPaths: [],
  }),

  /**
   * Notifications remain routable because the topbar bell opens this page,
   * but it is intentionally removed from desktop/mobile navigation.
   */
  Object.freeze({
    key: 'notifications',
    label: 'Notifikasi',
    path: '/admin/notifications',
    iconKey: 'notifications',
    title: 'Notification Console',
    permissionKey: 'notifications',
    group: '',
    groupLabel: '',
    sidebar: false,
    mobile: false,
    legacyPaths: [],
  }),

  Object.freeze({
    key: 'requests',
    label: 'Requests',
    mobileLabel: 'Requests',
    path: '/admin/bookings/requests',
    iconKey: 'requests',
    title: 'Request Inbox',
    permissionKey: 'schedule',
    group: ADMIN_NAV_GROUPS.BOOKING,
    groupLabel: 'Booking',
    sidebar: true,
    mobile: true,
    legacyPaths: [],
  }),

  Object.freeze({
    key: 'schedule',
    label: 'Calendar',
    mobileLabel: 'Calendar',
    path: '/admin/bookings/calendar',
    iconKey: 'schedule',
    title: 'Booking Calendar',
    permissionKey: 'schedule',
    group: ADMIN_NAV_GROUPS.BOOKING,
    groupLabel: 'Booking',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/schedule',
    ],
  }),

  Object.freeze({
    key: 'bookings',
    label: 'All Bookings',
    mobileLabel: 'Bookings',
    path: '/admin/bookings',
    iconKey: 'bookings',
    title: 'All Bookings',
    permissionKey: 'schedule',
    group: ADMIN_NAV_GROUPS.BOOKING,
    groupLabel: 'Booking',
    sidebar: true,
    mobile: true,
    legacyPaths: [],
  }),
  Object.freeze({
    key: 'customers',
    label: 'Customers',
    path: '/admin/customers',
    iconKey: 'customers',
    title: 'Customers',
    permissionKey: 'customers',
    group: ADMIN_NAV_GROUPS.BOOKING,
    groupLabel: 'Booking',
    sidebar: true,
    mobile: true,
    legacyPaths: [],
  }),

  Object.freeze({
    key: 'billing',
    label: 'Invoices & Payments',
    mobileLabel: 'Finance',
    path: '/admin/finance/invoices',
    iconKey: 'billing',
    title: 'Invoices & Payments',
    permissionKey: 'billing',
    group: ADMIN_NAV_GROUPS.FINANCE,
    groupLabel: 'Finance',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/billing',
    ],
  }),

  Object.freeze({
    key: 'bookkeeping',
    label: 'Bookkeeping',
    path: '/admin/finance/bookkeeping',
    iconKey: 'bookkeeping',
    title: 'Bookkeeping',
    permissionKey: 'bookkeeping',
    group: ADMIN_NAV_GROUPS.FINANCE,
    groupLabel: 'Finance',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/bookkeeping',
    ],
  }),

  Object.freeze({
    key: 'operator-fee',
    label: 'Operator Fee',
    path: '/admin/finance/operator-fees',
    iconKey: 'operator-fee',
    title: 'Operator Fee',
    permissionKey: 'operator-fee',
    group: ADMIN_NAV_GROUPS.FINANCE,
    groupLabel: 'Finance',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/operator-fee',
    ],
  }),

  Object.freeze({
    key: 'inventory',
    label: 'Inventory',
    path: '/admin/operations/inventory',
    iconKey: 'inventory',
    title: 'Inventory',
    permissionKey: 'inventory',
    group: ADMIN_NAV_GROUPS.OPERATIONS,
    groupLabel: 'Operations',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/inventory',
    ],
  }),

  Object.freeze({
    key: 'guard-attendance',
    label: 'Guard Attendance',
    path: '/admin/operations/guard-attendance',
    iconKey: 'guard-attendance',
    title: 'Guard Attendance',
    permissionKey: 'guard-attendance',
    group: ADMIN_NAV_GROUPS.OPERATIONS,
    groupLabel: 'Operations',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/guard-attendance',
    ],
  }),

  Object.freeze({
    key: 'gallery',
    label: 'Gallery',
    path: '/admin/content/gallery',
    iconKey: 'gallery',
    title: 'Studio Gallery',
    permissionKey: 'gallery',
    group: ADMIN_NAV_GROUPS.CONTENT,
    groupLabel: 'Content',
    sidebar: true,
    mobile: true,
    legacyPaths: [
      '/admin/gallery',
    ],
  }),

  Object.freeze({
    key: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    iconKey: 'settings',
    title: 'Settings',
    permissionKey: 'settings',
    group: '',
    groupLabel: '',
    sidebar: true,
    mobile: true,
    legacyPaths: [],
  }),
]);

export const ADMIN_SECTION_REDIRECTS = Object.freeze({
  '/admin/finance': '/admin/finance/invoices',
  '/admin/operations': '/admin/operations/inventory',
  '/admin/content': '/admin/content/gallery',
});

function normalizeAdminPath(pathname) {
  const raw = String(
    pathname || '/admin',
  ).trim();

  if (!raw) return '/admin';

  if (raw === '/') return '/admin';

  return raw.length > 1
    ? raw.replace(/\/+$/, '')
    : raw;
}

export function resolveAdminNavigationPath(pathname) {
  const normalized =
    normalizeAdminPath(pathname);

  const sectionRedirect =
    ADMIN_SECTION_REDIRECTS[normalized];

  if (sectionRedirect) {
    return sectionRedirect;
  }

  for (const item of ADMIN_NAV_ITEMS) {
    if (
      item.legacyPaths.includes(
        normalized,
      )
    ) {
      return item.path;
    }
  }

  return normalized;
}

export function findAdminNavigationItem(pathname) {
  const canonicalPath =
    resolveAdminNavigationPath(pathname);

  return (
    ADMIN_NAV_ITEMS.find(
      (item) =>
        canonicalPath === item.path ||
        canonicalPath.startsWith(
          item.path + '/',
        ),
    ) ||
    null
  );
}

export function isAdminSidebarItem(item) {
  return item?.sidebar !== false;
}

export function isAdminMobileItem(item) {
  return item?.mobile !== false;
}
