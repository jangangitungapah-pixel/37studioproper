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
  'UI-0D must preserve canonical mobile primary navigation.',
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
    "from 'radix-ui'",
    'Dialog.Root',
    'modal={true}',
    'Dialog.Trigger',
    'Dialog.Portal',
    'Dialog.Overlay',
    'Dialog.Content',
    'Dialog.Title',
    'Dialog.Description',
    'Dialog.Close',
    'onOpenChange={',
    'data-admin-mobile-dock="ui-0d"',
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    'admin-mobile-more-sheet',
    'admin-more-section-label',
    'admin-mobile-account',
    'admin-mobile-account-avatar',
    'admin-mobile-logout',
    'mobilePrimaryNavItems',
    'mobileMoreNavItems',
    'isMoreNavActive',
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      required,
    ),
    true,
    'UI-0D mobile navigation missing: ' +
      required,
  );
}

assert.equal(
  bottomNavSource.includes(
    "event.key === 'Escape'"
  ),
  false,
  'Manual Escape listener must be replaced by Radix Dialog behavior.',
);

assert.equal(
  bottomNavSource.includes(
    'AdminNotificationBadge'
  ),
  false,
  'Notifications must remain topbar-only on mobile.',
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
    'data-admin-spatial-header="ui-0c"',
    'data-admin-mobile-command="ui-0d"',
    '/admin/notifications',
    'admin-topbar-status-chip',
    'admin-topbar-guard-shortcut',
    'admin-topbar-logout',
  ]
) {
  assert.equal(
    topbarSource.includes(
      required,
    ),
    true,
    'UI-0D Topbar missing: ' +
      required,
  );
}

assert.match(
  topbarSource,
  /goTo\(\s*['"]\/admin\/notifications['"]\s*,?\s*\)/,
  'Notification Console must remain reachable on mobile.',
);

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    '<AdminBottomNav',
    'mobilePrimaryNavItems={mobilePrimaryNavItems}',
    'mobileMoreNavItems={mobileMoreNavItems}',
    'isMoreNavActive={isMoreNavActive}',
    'user={authState.user}',
    'onLogout={handleLogout}',
  ]
) {
  assert.equal(
    adminPageSource.includes(
      required,
    ),
    true,
    'UI-0D AdminPage plumbing missing: ' +
      required,
  );
}

for (
  const accessInvariant
  of [
    'canAccessNavItem',
    'permittedNavItems',
    'isAdminMobileItem',
    'PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
    'ACCOUNT_ROLES.STUDIO_GUARD',
  ]
) {
  assert.equal(
    adminPageSource.includes(
      accessInvariant,
    ),
    true,
    'UI-0D must preserve access invariant: ' +
      accessInvariant,
  );
}

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/admin-shell.css',
    ),
    'utf8',
  );

const ui0dIndex =
  cssSource.lastIndexOf(
    'UI-0D v2 — Spatial Mobile Shell',
  );

assert.notEqual(
  ui0dIndex,
  -1,
  'UI-0D CSS marker must exist.',
);

const ui0dCss =
  cssSource.slice(
    ui0dIndex,
  );

for (
  const required
  of [
    "data-admin-mobile-command='ui-0d'",
    "data-admin-mobile-dock='ui-0d'",
    '.admin-mobile-nav-icon',
    '.admin-mobile-nav-label',
    '.admin-mobile-more-overlay',
    '.admin-mobile-more-sheet',
    '.admin-mobile-sheet-handle',
    '.admin-mobile-more-scroll',
    '.admin-mobile-account',
    '.admin-mobile-logout',
    'safe-area-inset-bottom',
    'safe-area-inset-top',
    'max-width: 767px',
    'max-width: 359px',
    'prefers-reduced-motion: reduce',
    '--studio-surface-floating',
    '--studio-accent-soft',
    '--studio-shadow-surface',
  ]
) {
  assert.equal(
    ui0dCss.includes(
      required,
    ),
    true,
    'UI-0D CSS missing: ' +
      required,
  );
}

assert.match(
  ui0dCss,
  /\.admin-topbar\[\s*data-admin-mobile-command='ui-0d'\s*\][\s\S]*?\.admin-topbar-logout\s*\{[\s\S]*?display:\s*none;/,
  'Mobile logout must move out of the command header.',
);

assert.match(
  ui0dCss,
  /\.admin-bottom-more-menu\.admin-mobile-more-sheet\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;[\s\S]*?max-height:/,
  'More navigation must behave as a spatial bottom sheet.',
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
    'data-admin-spatial-rail="ui-0b"',
    'layoutId="admin-nav-active-plate"',
    'admin-sidebar-account',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      required,
    ),
    true,
    'UI-0D must preserve desktop rail: ' +
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

for (
  const requiredContract
  of [
    'spatial-ui-foundation-contract-test.mjs',
    'admin-spatial-workspace-contract-test.mjs',
    'admin-spatial-navigation-rail-contract-test.mjs',
    'admin-spatial-command-header-contract-test.mjs',
    'admin-spatial-mobile-shell-contract-test.mjs',
  ]
) {
  assert.equal(
    packageJson
      .scripts
      .test
      .includes(
        requiredContract,
      ),
    true,
    'Missing shell contract: ' +
      requiredContract,
  );
}

process.stdout.write(
  '✅ Admin Spatial Mobile Shell UI-0D contract passed.\\n',
);
