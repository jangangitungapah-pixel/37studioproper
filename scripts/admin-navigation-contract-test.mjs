import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ADMIN_MOBILE_PRIMARY_KEYS,
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  findAdminNavigationItem,
  isAdminMobileItem,
  isAdminSidebarItem,
  resolveAdminNavigationPath,
} from '../src/config/adminNavigation.js';

/**
 * Canonical top-level IA.
 */
assert.deepEqual(
  ADMIN_NAV_GROUPS,
  {
    BOOKING: 'booking',
    FINANCE: 'finance',
    OPERATIONS: 'operations',
    CONTENT: 'content',
  },
);

const itemByKey = new Map(
  ADMIN_NAV_ITEMS.map(
    (item) => [
      item.key,
      item,
    ],
  ),
);

assert.equal(
  itemByKey.get('dashboard')?.path,
  '/admin/dashboard',
);

assert.equal(
  itemByKey.get('requests')?.path,
  '/admin/bookings/requests',
);

assert.equal(
  itemByKey.get('schedule')?.path,
  '/admin/bookings/calendar',
);

assert.equal(
  itemByKey.get('bookings')?.path,
  '/admin/bookings',
);

assert.equal(
  itemByKey.get('billing')?.path,
  '/admin/finance/invoices',
);

assert.equal(
  itemByKey.get('bookkeeping')?.path,
  '/admin/finance/bookkeeping',
);

assert.equal(
  itemByKey.get('operator-fee')?.path,
  '/admin/finance/operator-fees',
);

assert.equal(
  itemByKey.get('inventory')?.path,
  '/admin/operations/inventory',
);

assert.equal(
  itemByKey.get('guard-attendance')?.path,
  '/admin/operations/guard-attendance',
);

assert.equal(
  itemByKey.get('gallery')?.path,
  '/admin/content/gallery',
);

/**
 * Permission keys must remain backward compatible.
 */
assert.equal(
  itemByKey.get('requests')?.permissionKey,
  'schedule',
);

assert.equal(
  itemByKey.get('schedule')?.permissionKey,
  'schedule',
);

assert.equal(
  itemByKey.get('bookings')?.permissionKey,
  'schedule',
);

assert.equal(
  itemByKey.get('billing')?.permissionKey,
  'billing',
);

assert.equal(
  itemByKey.get('inventory')?.permissionKey,
  'inventory',
);

assert.equal(
  itemByKey.get('guard-attendance')?.permissionKey,
  'guard-attendance',
);

/**
 * Notifications become topbar-only.
 */
assert.equal(
  isAdminSidebarItem(
    itemByKey.get('notifications'),
  ),
  false,
);

assert.equal(
  isAdminMobileItem(
    itemByKey.get('notifications'),
  ),
  false,
);

assert.equal(
  itemByKey.get('notifications')?.path,
  '/admin/notifications',
);

/**
 * Phase 3A mobile command navigation:
 * Home / Requests / Calendar / Finance.
 */
assert.deepEqual(
  ADMIN_MOBILE_PRIMARY_KEYS,
  [
    'dashboard',
    'requests',
    'schedule',
    'billing',
  ],
);

/**
 * Legacy route compatibility.
 */
assert.equal(
  resolveAdminNavigationPath(
    '/admin/schedule',
  ),
  '/admin/bookings/calendar',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/billing',
  ),
  '/admin/finance/invoices',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/bookkeeping',
  ),
  '/admin/finance/bookkeeping',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/operator-fee',
  ),
  '/admin/finance/operator-fees',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/inventory',
  ),
  '/admin/operations/inventory',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/guard-attendance',
  ),
  '/admin/operations/guard-attendance',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/gallery',
  ),
  '/admin/content/gallery',
);

/**
 * Section root aliases.
 */
assert.equal(
  resolveAdminNavigationPath(
    '/admin/bookings',
  ),
  '/admin/bookings',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/finance',
  ),
  '/admin/finance/invoices',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/operations',
  ),
  '/admin/operations/inventory',
);

assert.equal(
  resolveAdminNavigationPath(
    '/admin/content',
  ),
  '/admin/content/gallery',
);

/**
 * Route lookup must work for both canonical and legacy URLs.
 */
assert.equal(
  findAdminNavigationItem(
    '/admin/schedule',
  )?.key,
  'schedule',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings/calendar',
  )?.key,
  'schedule',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings/requests',
  )?.key,
  'requests',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/bookings',
  )?.key,
  'bookings',
);

assert.equal(
  findAdminNavigationItem(
    '/admin/finance/invoices',
  )?.key,
  'billing',
);

/**
 * Request Inbox and All Bookings now exist as real Booking destinations.
 */
assert.equal(
  ADMIN_NAV_ITEMS.some(
    (item) =>
      item.path ===
      '/admin/bookings/requests',
  ),
  true,
);

assert.equal(
  itemByKey.get('requests')?.groupLabel,
  'Booking',
);

assert.equal(
  isAdminSidebarItem(
    itemByKey.get('requests'),
  ),
  true,
);

assert.equal(
  isAdminMobileItem(
    itemByKey.get('requests'),
  ),
  true,
);

assert.equal(
  ADMIN_NAV_ITEMS.some(
    (item) =>
      item.path ===
      '/admin/bookings',
  ),
  true,
);

assert.equal(
  itemByKey.get('bookings')?.groupLabel,
  'Booking',
);

assert.equal(
  isAdminSidebarItem(
    itemByKey.get('bookings'),
  ),
  true,
);

assert.equal(
  isAdminMobileItem(
    itemByKey.get('bookings'),
  ),
  true,
);

/**
 * Static shell architecture guard.
 */
const adminPageSource = readFileSync(
  resolve(
    'src/pages/AdminPage.jsx',
  ),
  'utf8',
);

assert.equal(
  adminPageSource.includes(
    'ADMIN_NAV_ITEMS',
  ),
  true,
  'AdminPage must use centralized navigation contract.',
);

assert.equal(
  adminPageSource.includes(
    'resolveAdminNavigationPath',
  ),
  true,
  'AdminPage must preserve legacy URL compatibility.',
);

assert.equal(
  adminPageSource.includes(
    "path: '/admin/billing'",
  ),
  false,
  'Legacy billing path must not remain as primary nav definition.',
);

assert.equal(
  adminPageSource.includes(
    "path: '/admin/schedule'",
  ),
  false,
  'Legacy schedule path must not remain as primary nav definition.',
);

const sidebarSource = readFileSync(
  resolve(
    'src/components/admin/AdminSidebar.jsx',
  ),
  'utf8',
);

assert.equal(
  sidebarSource.includes(
    'admin-nav-section-label',
  ),
  true,
  'AdminSidebar must render grouped IA sections.',
);

const topbarSource = readFileSync(
  resolve(
    'src/components/admin/AdminTopbar.jsx',
  ),
  'utf8',
);

assert.equal(
  topbarSource.includes(
    "goTo('/admin/notifications')",
  ),
  true,
  'Notifications must remain accessible from topbar bell.',
);

process.stdout.write(
  '✅ Admin navigation architecture contract passed.\n',
);
