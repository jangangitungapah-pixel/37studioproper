import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

const requiredAdminMarkers = [
  'data-admin-spatial-root="true"',
  'data-admin-spatial-phase="ui-0a"',
  'className="admin-shell-layout"',
  'className="admin-navigation-zone"',
  'className="admin-workspace"',
  'className="admin-workspace-canvas"',
  '<AdminSidebar',
  '<AdminTopbar',
  '<AdminBottomNav',
  'renderAdminContent(',
  'activeItem.key',
  'authState.user',
  'admin-route-loading',
];

for (
  const required
  of requiredAdminMarkers
) {
  assert.equal(
    adminPageSource.includes(
      required,
    ),
    true,
    'UI-0A AdminPage missing: ' +
      required,
  );
}

const layoutIndex =
  adminPageSource.indexOf(
    'className="admin-shell-layout"',
  );

const navigationIndex =
  adminPageSource.indexOf(
    'className="admin-navigation-zone"',
    layoutIndex,
  );

const sidebarIndex =
  adminPageSource.indexOf(
    '<AdminSidebar',
    navigationIndex,
  );

const workspaceIndex =
  adminPageSource.indexOf(
    'className="admin-workspace"',
    sidebarIndex,
  );

const canvasIndex =
  adminPageSource.indexOf(
    'className="admin-workspace-canvas"',
    workspaceIndex,
  );

const stageIndex =
  adminPageSource.indexOf(
    'className="admin-stage"',
    canvasIndex,
  );

const topbarIndex =
  adminPageSource.indexOf(
    '<AdminTopbar',
    stageIndex,
  );

const contentIndex =
  adminPageSource.indexOf(
    'renderAdminContent(',
    topbarIndex,
  );

assert.equal(
  layoutIndex >= 0 &&
    navigationIndex >
      layoutIndex &&
    sidebarIndex >
      navigationIndex &&
    workspaceIndex >
      sidebarIndex &&
    canvasIndex >
      workspaceIndex &&
    stageIndex >
      canvasIndex &&
    topbarIndex >
      stageIndex &&
    contentIndex >
      topbarIndex,
  true,
  'UI-0A spatial hierarchy order is invalid.',
);

for (
  const invariant
  of [
    'resolveAdminNavigationPath',
    'canAccessNavItem',
    'getPermittedDefaultLandingPath',
    'ACCOUNT_ROLES.STUDIO_GUARD',
    'PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
    'SIDEBAR_STORAGE_KEY',
  ]
) {
  assert.equal(
    adminPageSource.includes(
      invariant,
    ),
    true,
    'Admin routing/access invariant missing: ' +
      invariant,
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
    'UI-0A v2 — Spatial Environment + Workspace Canvas',
    '.admin-shell-layout',
    '.admin-navigation-zone',
    '.admin-workspace',
    '.admin-workspace-canvas',
    '--admin-environment-pad:',
    '--admin-environment-gap:',
    '--studio-env',
    '--studio-canvas',
    '--studio-shadow-surface',
    '--studio-radius-large',
    'min-width: 768px',
    'min-width: 1280px',
    'prefers-reduced-motion: reduce',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'UI-0A CSS missing: ' +
      required,
  );
}

const sidebarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminSidebar.jsx',
    ),
    'utf8',
  );

assert.equal(
  sidebarSource.includes(
    'data-admin-shell-ui="ui-0b-desktop"'
  ),
  true,
  'UI-0A must preserve existing sidebar component behavior.',
);

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
  'UI-0A must preserve Notification navigation.',
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
    'admin-bottom-more-backdrop',
    'admin-more-section-label',
    'Dialog.Content',
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      required,
    ),
    true,
    'UI-0A must preserve mobile navigation behavior: ' +
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
    'spatial-ui-foundation-contract-test.mjs'
  ),
  true,
  'UI-F0 foundation contract must remain registered.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'admin-spatial-workspace-contract-test.mjs'
  ),
  true,
  'UI-0A workspace contract must be registered.',
);

process.stdout.write(
  '✅ Admin Spatial Workspace UI-0A contract passed.\n',
);
