import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ADMIN_MOBILE_PRIMARY_KEYS,
  ADMIN_NAV_ITEMS,
  isAdminMobileItem,
} from '../src/config/adminNavigation.js';

const itemByKey = new Map(
  ADMIN_NAV_ITEMS.map(
    (item) => [
      item.key,
      item,
    ],
  ),
);

/**
 * Phase 2A architecture must remain intact.
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

assert.equal(
  itemByKey.get('schedule')?.groupLabel,
  'Booking',
);

assert.equal(
  itemByKey.get('billing')?.groupLabel,
  'Finance',
);

assert.equal(
  itemByKey.get('inventory')?.groupLabel,
  'Operations',
);

assert.equal(
  itemByKey.get('gallery')?.groupLabel,
  'Content',
);

/**
 * Notification Console is now a topbar-only destination.
 */
assert.equal(
  isAdminMobileItem(
    itemByKey.get('notifications'),
  ),
  false,
);

const adminPageSource = readFileSync(
  resolve(
    'src/pages/AdminPage.jsx',
  ),
  'utf8',
);

assert.equal(
  adminPageSource.includes(
    'shouldShowMoreNotificationBadge',
  ),
  false,
  'Dead notification More-menu state must stay removed.',
);

assert.equal(
  adminPageSource.includes(
    'getNotificationBadgeCount',
  ),
  false,
  'Dead notification count helper must stay removed.',
);

/**
 * Desktop sidebar should not carry unreachable notification UI anymore.
 */
const sidebarSource = readFileSync(
  resolve(
    'src/components/admin/AdminSidebar.jsx',
  ),
  'utf8',
);

assert.equal(
  sidebarSource.includes(
    'AdminNotificationBadge',
  ),
  false,
  'Sidebar must not carry Notification badge plumbing.',
);

assert.equal(
  sidebarSource.includes(
    'admin-nav-section-label',
  ),
  true,
  'Desktop grouped navigation must remain present.',
);

/**
 * Topbar exposes current IA context and owns Notification access.
 */
const topbarSource = readFileSync(
  resolve(
    'src/components/admin/AdminTopbar.jsx',
  ),
  'utf8',
);

assert.equal(
  topbarSource.includes(
    'admin-topbar-context',
  ),
  true,
  'Topbar must expose navigation context.',
);

assert.equal(
  topbarSource.includes(
    'activeItem.groupLabel',
  ),
  true,
  'Topbar context must derive from canonical navigation metadata.',
);

assert.equal(
  topbarSource.includes(
    "goTo('/admin/notifications')",
  ),
  true,
  'Notification Console must remain reachable from the topbar.',
);

/**
 * Mobile More must mirror grouped information architecture.
 */
const bottomNavSource = readFileSync(
  resolve(
    'src/components/admin/AdminBottomNav.jsx',
  ),
  'utf8',
);

assert.equal(
  bottomNavSource.includes(
    'groupMobileMoreItems',
  ),
  true,
  'Mobile More menu must group secondary routes.',
);

assert.equal(
  bottomNavSource.includes(
    'admin-more-section-label',
  ),
  true,
  'Mobile More menu must expose section labels.',
);

assert.equal(
  bottomNavSource.includes(
    'admin-bottom-more-backdrop',
  ),
  true,
  'Mobile More menu must provide a dismissible backdrop.',
);

assert.equal(
  bottomNavSource.includes(
    "event.key === 'Escape'",
  ),
  true,
  'Mobile More menu must support Escape dismissal.',
);

assert.equal(
  bottomNavSource.includes(
    'AdminNotificationBadge',
  ),
  false,
  'Mobile nav must not carry topbar-only Notification plumbing.',
);

assert.equal(
  bottomNavSource.includes(
    'isMoreNavActive ||',
  ),
  true,
  'More control must remain active while its menu is open.',
);

/**
 * Ensure secondary mobile navigation actually contains the expected groups.
 */
const mobileMoreItems =
  ADMIN_NAV_ITEMS.filter(
    (item) =>
      isAdminMobileItem(item) &&
      !ADMIN_MOBILE_PRIMARY_KEYS.includes(
        item.key,
      ),
  );

assert.equal(
  mobileMoreItems.some(
    (item) =>
      item.groupLabel === 'Booking',
  ),
  true,
);

assert.equal(
  mobileMoreItems.some(
    (item) =>
      item.groupLabel === 'Finance',
  ),
  true,
);

assert.equal(
  mobileMoreItems.some(
    (item) =>
      item.groupLabel === 'Operations',
  ),
  true,
);

assert.equal(
  mobileMoreItems.some(
    (item) =>
      item.groupLabel === 'Content',
  ),
  true,
);

assert.equal(
  mobileMoreItems.some(
    (item) =>
      item.key === 'settings',
  ),
  true,
);

/**
 * CSS shell interaction contract.
 */
const shellCssSource = readFileSync(
  resolve(
    'src/styles/modules/admin-shell.css',
  ),
  'utf8',
);

assert.equal(
  shellCssSource.includes(
    '.admin-topbar-context',
  ),
  true,
);

assert.equal(
  shellCssSource.includes(
    '.admin-bottom-more-backdrop',
  ),
  true,
);

assert.equal(
  shellCssSource.includes(
    '.admin-more-grid',
  ),
  true,
);

assert.equal(
  shellCssSource.includes(
    '.admin-nav-section:has(.admin-nav-item.is-active)',
  ),
  true,
);

process.stdout.write(
  '✅ Admin shell navigation UX contract passed.\n',
);
