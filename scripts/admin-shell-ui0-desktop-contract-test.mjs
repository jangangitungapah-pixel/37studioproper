import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  ADMIN_MOBILE_PRIMARY_KEYS,
} from '../src/config/adminNavigation.js';

assert.deepEqual(
  ADMIN_MOBILE_PRIMARY_KEYS,
  [
    'dashboard',
    'requests',
    'schedule',
    'billing',
  ],
  'UI-0A/B must preserve mobile primary IA.',
);

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminPageSource.includes(
    'admin-route-loading'
  ),
  true,
  'Admin shell must expose the new route loading state.',
);

assert.equal(
  adminPageSource.includes(
    'Memuat {activeItem.title}'
  ),
  true,
);

const sidebarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminSidebar.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'data-admin-shell-ui="ui-0b-desktop"',
    'admin-sidebar-brand-eyebrow',
    'admin-sidebar-account',
    'admin-account-avatar',
    'admin-account-logout',
    'admin-nav-icon',
    'aria-expanded={',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      required,
    ),
    true,
    'Desktop sidebar missing: ' +
      required,
  );
}

assert.equal(
  sidebarSource.includes(
    'AdminNotificationBadge'
  ),
  false,
  'Notifications must remain topbar-only.',
);

const topbarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminTopbar.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'data-admin-shell-ui="ui-0b-desktop"',
    'activeItem.groupLabel',
    '/admin/notifications',
    'admin-topbar-guard-shortcut',
    'admin-topbar-status-chip',
    'admin-topbar-logout',
    'aria-live="polite"',
  ]
) {
  assert.equal(
    topbarSource.includes(
      required,
    ),
    true,
    'Desktop topbar missing: ' +
      required,
  );
}

assert.equal(
  topbarSource.includes(
    'style={{'
  ),
  false,
  'AdminTopbar must not contain inline visual styling.',
);

const bottomNavSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminBottomNav.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    'admin-more-section-label',
    "event.key === 'Escape'",
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      required,
    ),
    true,
    'Mobile baseline changed unexpectedly: ' +
      required,
  );
}

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/admin-shell.css',
    ),
    'utf8',
  );

for (
  const required
  of [
    'UI-0A/B — Admin Shell Foundation + Desktop Overhaul',
    '--admin-sidebar-expanded:',
    '264px',
    '--admin-sidebar-collapsed:',
    '78px',
    '.admin-sidebar-account',
    '.admin-account-avatar',
    '.admin-route-loading',
    '.admin-topbar-guard-shortcut',
    '.admin-shell.is-sidebar-collapsed',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'Desktop shell CSS missing: ' +
      required,
  );
}

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'admin-shell-navigation-ux-test.mjs'
  ),
  true,
  'Existing Admin Shell contract must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'admin-shell-ui0-desktop-contract-test.mjs'
  ),
  true,
  'UI-0 desktop contract must be registered.',
);

process.stdout.write(
  '✅ Admin Shell UI-0A/B Desktop contract passed.\n',
);
