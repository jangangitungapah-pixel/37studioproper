import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

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
    "from 'motion/react'",
    "from '../ui/StudioTooltip.jsx'",
    'data-admin-shell-ui="ui-0b-desktop"',
    'data-admin-spatial-header="ui-0c"',
    'activeItem.groupLabel',
    'activeItem.key',
    'admin-command-context-mark',
    'admin-command-utility',
    'admin-command-icon',
    'admin-command-visually-hidden',
    'admin-topbar-guard-shortcut',
    'admin-notification-shortcut',
    'admin-topbar-status-chip',
    'admin-connectivity-dot',
    'admin-connectivity-label',
    'admin-topbar-logout',
    'aria-live="polite"',
    'StudioTooltip',
  ]
) {
  assert.equal(
    topbarSource.includes(
      required,
    ),
    true,
    'UI-0C Topbar missing: ' +
      required,
  );
}

assert.match(
  topbarSource,
  /goTo\(\s*['"]\/admin\/notifications['"]\s*,?\s*\)/,
  'Notification Console must remain reachable from command header.',
);

for (
  const guardInvariant
  of [
    "user.role ===\n          'studio_guard'",
    "user.role ===\n            'admin'",
    'user.isGuard ===\n            true',
    'href="/guard/attendance"',
  ]
) {
  assert.equal(
    topbarSource.includes(
      guardInvariant,
    ),
    true,
    'Guard eligibility invariant missing: ' +
      guardInvariant,
  );
}

for (
  const connectivityInvariant
  of [
    "window.addEventListener(\n      'online'",
    "window.addEventListener(\n      'offline'",
    'navigator.onLine',
    'setIsOnline(',
  ]
) {
  assert.equal(
    topbarSource.includes(
      connectivityInvariant,
    ),
    true,
    'Connectivity invariant missing: ' +
      connectivityInvariant,
  );
}

assert.equal(
  topbarSource.includes(
    'style={{'
  ),
  false,
  'Command Header must not use inline visual CSS.',
);

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/admin-shell.css',
    ),
    'utf8',
  );

const ui0cIndex =
  cssSource.lastIndexOf(
    'UI-0C v2 — Spatial Command Header',
  );

assert.notEqual(
  ui0cIndex,
  -1,
  'UI-0C CSS marker must exist.',
);

const ui0cCss =
  cssSource.slice(
    ui0cIndex,
  );

for (
  const required
  of [
    "data-admin-spatial-header='ui-0c'",
    '.admin-command-context-mark',
    '.admin-command-utility',
    '.admin-command-icon',
    '.admin-connectivity-dot',
    '.admin-command-visually-hidden',
    'border-radius:',
    '18px',
    '--studio-surface-1',
    '--studio-surface-2',
    '--studio-text-primary',
    '--studio-text-tertiary',
    '--studio-shadow-contact',
    'prefers-reduced-motion: reduce',
  ]
) {
  assert.equal(
    ui0cCss.includes(
      required,
    ),
    true,
    'UI-0C CSS missing: ' +
      required,
  );
}

assert.match(
  ui0cCss,
  /\.admin-workspace-canvas\s+\.admin-topbar\[\s*data-admin-spatial-header='ui-0c'\s*\]\s*\{[\s\S]*?margin:\s*14px\s+0\s+24px;/,
  'Desktop command header must float inside workspace instead of using negative full-width margins.',
);

assert.match(
  ui0cCss,
  /\.admin-topbar\[\s*data-admin-spatial-header='ui-0c'\s*\]\s+\.admin-topbar-logout\s*\{[\s\S]*?display:\s*none;/,
  'Desktop duplicate logout action must be hidden while rail owns logout.',
);

const sidebarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminSidebar.jsx',
    ),
    'utf8',
  );

for (
  const invariant
  of [
    'data-admin-spatial-rail="ui-0b"',
    'layoutId="admin-nav-active-plate"',
    'admin-sidebar-account',
    'admin-account-logout',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      invariant,
    ),
    true,
    'UI-0C must preserve UI-0B rail: ' +
      invariant,
  );
}

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
    '<AdminTopbar',
  ]
) {
  assert.equal(
    adminPageSource.includes(
      invariant,
    ),
    true,
    'UI-0C must preserve workspace invariant: ' +
      invariant,
  );
}

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
    'Dialog.Content',
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      invariant,
    ),
    true,
    'UI-0C must preserve mobile navigation: ' +
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
    'admin-spatial-command-header-contract-test.mjs',
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
  '✅ Admin Spatial Command Header UI-0C contract passed.\n',
);
