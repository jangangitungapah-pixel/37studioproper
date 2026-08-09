import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

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
    "from 'motion/react'",
    "from '../ui/StudioTooltip.jsx'",
    'data-admin-shell-ui="ui-0b-desktop"',
    'data-admin-spatial-rail="ui-0b"',
    'data-collapsed={',
    'groupSidebarItems',
    'admin-sidebar-brand-eyebrow',
    'admin-sidebar-logo-halo',
    'admin-nav-section-label',
    'admin-nav-section-items',
    'admin-nav-active-plate',
    'layoutId="admin-nav-active-plate"',
    'admin-nav-active-dot',
    'admin-sidebar-account',
    'admin-account-avatar',
    'admin-account-copy',
    'admin-account-logout',
    'aria-expanded={',
    'aria-current={',
    'StudioTooltip',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      required,
    ),
    true,
    'UI-0B sidebar missing: ' +
      required,
  );
}

assert.equal(
  sidebarSource.includes(
    'AdminNotificationBadge'
  ),
  false,
  'Notification UI must remain outside desktop rail.',
);

assert.equal(
  sidebarSource.includes(
    'permittedNavItems'
  ),
  true,
  'Permission-filtered navigation input must remain intact.',
);

assert.equal(
  sidebarSource.includes(
    'goTo('
  ),
  true,
  'Navigation action must remain intact.',
);

assert.equal(
  sidebarSource.includes(
    'onLogout'
  ),
  true,
  'Account logout must remain intact.',
);

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
    'UI-0B v2 — Spatial Desktop Navigation Rail',
    '--admin-sidebar-expanded:',
    '258px',
    '--admin-sidebar-collapsed:',
    '78px',
    "data-admin-spatial-rail='ui-0b'",
    '.admin-sidebar-logo-halo',
    '.admin-nav-section-items',
    '.admin-nav-active-plate',
    '.admin-nav-active-dot',
    '.admin-sidebar-account',
    '.admin-account-avatar',
    '.admin-account-logout',
    'TRUE COLLAPSED ICON RAIL',
    '.admin-shell.is-sidebar-collapsed',
    'prefers-reduced-motion: reduce',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-0B CSS missing: ' +
      required,
  );
}

/**
 * UI-0B.1 collapsed rail compactness regression.
 *
 * Older desktop shell CSS still contains the pre-spatial
 * collapsed positioning rules. UI-0B must explicitly reset
 * those values in its later cascade.
 */
const ui0bCssIndex =
  cssSource.lastIndexOf(
    'UI-0B v2 — Spatial Desktop Navigation Rail',
  );

assert.notEqual(
  ui0bCssIndex,
  -1,
  'UI-0B CSS marker must exist.',
);

const ui0bCssSource =
  cssSource.slice(
    ui0bCssIndex,
  );

/**
 * UI-0B.2 persistent rail regression.
 *
 * The navigation grid item must stretch to the height of the
 * workspace. Otherwise the sticky rail is bounded by a
 * viewport-height parent and scrolls away on long pages.
 */
assert.match(
  ui0bCssSource,
  /\.admin-navigation-zone\s*\{[\s\S]*?position:\s*relative;[\s\S]*?align-self:\s*stretch;[\s\S]*?z-index:\s*4;[\s\S]*?\}/,
  'Navigation zone must stretch with long workspace content.',
);

assert.match(
  ui0bCssSource,
  /\.admin-navigation-zone\s+\.admin-sidebar\[\s*data-admin-spatial-rail='ui-0b'\s*\]\s*\{[\s\S]*?position:\s*sticky;/,
  'Desktop navigation rail must remain sticky inside the stretched navigation zone.',
);

assert.match(
  ui0bCssSource,
  /\.admin-shell\.is-sidebar-collapsed\s+\.admin-sidebar-collapse\s*\{[\s\S]*?margin-inline:\s*auto;[\s\S]*?transform:\s*none;[\s\S]*?\}/,
  'Collapsed toggle must reset the legacy translateX positioning.',
);

assert.match(
  ui0bCssSource,
  /\.admin-shell\.is-sidebar-collapsed\s+\.admin-sidebar-nav\s*\{[\s\S]*?margin-top:\s*6px;[\s\S]*?\}/,
  'Collapsed navigation must override the legacy 46px top gap.',
);

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

for (
  const invariant
  of [
    'data-admin-spatial-phase="ui-0a"',
    'className="admin-navigation-zone"',
    'className="admin-workspace"',
    'className="admin-workspace-canvas"',
    '<AdminSidebar',
    '<AdminTopbar',
    '<AdminBottomNav',
  ]
) {
  assert.equal(
    adminPageSource.includes(
      invariant,
    ),
    true,
    'UI-0B must preserve UI-0A shell invariant: ' +
      invariant,
  );
}

const topbarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminTopbar.jsx',
    ),
    'utf8',
  );

assert.equal(
  topbarSource.includes(
    '/admin/notifications'
  ),
  true,
  'Notification navigation must remain in Topbar.',
);

const bottomNavSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminBottomNav.jsx',
    ),
    'utf8',
  );

for (
  const invariant
  of [
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    "event.key === 'Escape'",
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      invariant,
    ),
    true,
    'UI-0B must not change mobile navigation behavior: ' +
      invariant,
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
    'admin-shell-navigation-ux-test.mjs',
    'admin-shell-ui0-desktop-contract-test.mjs',
    'spatial-ui-foundation-contract-test.mjs',
    'admin-spatial-workspace-contract-test.mjs',
    'admin-spatial-navigation-rail-contract-test.mjs',
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
    'Missing registered shell contract: ' +
      requiredContract,
  );
}

process.stdout.write(
  '✅ Admin Spatial Navigation Rail UI-0B contract passed.\n',
);
