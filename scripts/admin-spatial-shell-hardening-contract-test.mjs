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

function read(path) {
  return readFileSync(
    resolve(
      path,
    ),
    'utf8',
  );
}

/**
 * ============================================================
 * DEPENDENCY / PERFORMANCE BOUNDARY
 * ============================================================
 */

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

assert.equal(
  Boolean(
    packageJson.dependencies.motion,
  ),
  true,
  'Motion dependency must remain installed.',
);

assert.equal(
  Boolean(
    packageJson.dependencies['radix-ui'],
  ),
  true,
  'Radix dependency must remain installed.',
);

for (
  const forbiddenPackage
  of [
    '@mui/material',
    'antd',
    'bootstrap',
    '@chakra-ui/react',
    '@mantine/core',
  ]
) {
  assert.equal(
    Boolean(
      packageJson.dependencies[
        forbiddenPackage
      ],
    ),
    false,
    'Full visual framework must not enter spatial foundation: ' +
      forbiddenPackage,
  );
}

/**
 * ============================================================
 * THEME
 * ============================================================
 */

const themePreferencesSource =
  read(
    'src/theme/themePreferences.js',
  );

for (
  const invariant
  of [
    'THEME_STORAGE_KEY',
    "DARK:\n      'dark'",
    "LIGHT:\n      'light'",
    "SYSTEM:\n      'system'",
    'window.localStorage.getItem(',
    'readStoredThemePreference() ||',
    'THEME_PREFERENCES.LIGHT',
    'resolveThemePreference(',
  ]
) {
  assert.equal(
    themePreferencesSource.includes(
      invariant,
    ),
    true,
    'Theme preference invariant missing: ' +
      invariant,
  );
}

const themeProviderSource =
  read(
    'src/theme/ThemeProvider.jsx',
  );

for (
  const invariant
  of [
    'getInitialThemePreference',
    'getSystemTheme',
    "window.matchMedia(\n        '(prefers-color-scheme: dark)'",
    "media.addEventListener(\n        'change'",
    'dataset.theme =',
    '.style.colorScheme =',
    'window.localStorage.setItem(',
    'THEME_STORAGE_KEY',
  ]
) {
  assert.equal(
    themeProviderSource.includes(
      invariant,
    ),
    true,
    'ThemeProvider invariant missing: ' +
      invariant,
  );
}

const spatialFoundationSource =
  read(
    'src/styles/spatial-foundation.css',
  );

for (
  const invariant
  of [
    "html[data-admin-theme-active='true']",
    "html[data-admin-theme-active='true'][data-theme='dark']",
    '--studio-env:',
    '--studio-canvas:',
    '--studio-surface-floating:',
    '--studio-text-primary:',
    '--studio-edge-soft:',
    '--studio-accent:',
    '--studio-shadow-surface:',
    '--studio-duration-fast:',
    'prefers-reduced-motion: reduce',
  ]
) {
  assert.equal(
    spatialFoundationSource.includes(
      invariant,
    ),
    true,
    'Spatial token invariant missing: ' +
      invariant,
  );
}

/**
 * ============================================================
 * ADMIN ACCESS / ROUTING
 * ============================================================
 */

const adminPageSource =
  read(
    'src/pages/AdminPage.jsx',
  );

assert.match(
  adminPageSource,
  /ACCOUNT_ROLES\.STUDIO_GUARD[\s\S]*?to="\/guard\/attendance"/,
  'studio_guard must remain redirected before the Admin shell renders.',
);

for (
  const invariant
  of [
    'canAccessNavItem',
    'permittedNavItems',
    'isAdminSidebarItem',
    'isAdminMobileItem',
    'resolveAdminNavigationPath',
    'getPermittedDefaultLandingPath',
    'PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
    'ACCOUNT_ROLES.STUDIO_GUARD',
    'SIDEBAR_STORAGE_KEY',
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
    'Admin access / routing invariant missing: ' +
      invariant,
  );
}

/**
 * ============================================================
 * DESKTOP NAVIGATION RAIL
 * ============================================================
 */

const sidebarSource =
  read(
    'src/components/admin/AdminSidebar.jsx',
  );

for (
  const invariant
  of [
    'data-admin-spatial-rail="ui-0b"',
    'useReducedMotion',
    'const shouldReduceMotion =',
    'layoutId="admin-nav-active-plate"',
    'aria-current={',
    'aria-expanded={',
    'StudioTooltip',
    'admin-sidebar-account',
    'admin-account-logout',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      invariant,
    ),
    true,
    'Desktop rail invariant missing: ' +
      invariant,
  );
}

/**
 * ============================================================
 * COMMAND HEADER
 * ============================================================
 */

const topbarSource =
  read(
    'src/components/admin/AdminTopbar.jsx',
  );

for (
  const invariant
  of [
    'data-admin-spatial-header="ui-0c"',
    'data-admin-mobile-command="ui-0d"',
    'useReducedMotion',
    'const shouldReduceMotion =',
    'aria-live="polite"',
    'admin-topbar-status-chip',
  ]
) {
  assert.equal(
    topbarSource.includes(
      invariant,
    ),
    true,
    'Command header invariant missing: ' +
      invariant,
  );
}

assert.match(
  topbarSource,
  /goTo\(\s*['"]\/admin\/notifications['"]\s*,?\s*\)/,
  'Notification Console must remain topbar-accessible.',
);

/*
 * GP-4 removes the unreachable studio_guard shortcut from AdminTopbar.
 * AdminPage remains the owner of studio_guard -> Guard redirect.
 * Owner receives the intentional cross-portal entry instead.
 */
assert.match(
  topbarSource,
  /user\??\.role\s*===\s*['"]owner['"]/,
  'Owner Guard shortcut eligibility must remain intact.',
);

assert.doesNotMatch(
  topbarSource,
  /user\??\.role\s*===\s*['"]admin['"]/,
  'GP-6 must remove legacy Admin Guard shortcut eligibility.',
);

assert.doesNotMatch(
  topbarSource,
  /user\.isGuard\s*===\s*true/,
  'GP-6 must remove legacy Admin Guard flag requirement.',
);

assert.doesNotMatch(
  topbarSource,
  /user\??\.role\s*===\s*['"]studio_guard['"]/,
  'studio_guard must not regain an unreachable AdminTopbar shortcut.',
);

assert.equal(
  topbarSource.includes(
    "from 'react-router-dom'"
  ),
  true,
  'Admin Guard shortcut must stay router-driven after GP-4.',
);

assert.equal(
  topbarSource.includes(
    'to="/guard/attendance"'
  ),
  true,
  'Guard Portal target must remain canonical.',
);

assert.equal(
  topbarSource.includes(
    'href="/guard/attendance"'
  ),
  false,
  'Cross-portal switch must not regress to a raw reload.',
);

assert.match(
  topbarSource,
  /window\.addEventListener\(\s*['"]online['"]/,
  'Online event listener must remain intact.',
);

assert.match(
  topbarSource,
  /window\.addEventListener\(\s*['"]offline['"]/,
  'Offline event listener must remain intact.',
);

/**
 * ============================================================
 * MOBILE SHELL
 * ============================================================
 */

assert.deepEqual(
  ADMIN_MOBILE_PRIMARY_KEYS,
  [
    'dashboard',
    'requests',
    'schedule',
    'billing',
  ],
  'Canonical mobile primary IA must remain unchanged.',
);

const bottomNavSource =
  read(
    'src/components/admin/AdminBottomNav.jsx',
  );

for (
  const invariant
  of [
    "from 'radix-ui'",
    'Dialog.Root',
    'modal={true}',
    'Dialog.Portal',
    'Dialog.Overlay',
    'Dialog.Content',
    'Dialog.Title',
    'Dialog.Description',
    'Dialog.Close',
    'data-admin-mobile-dock="ui-0d"',
    'aria-current={',
    'admin-mobile-more-sheet',
    'admin-mobile-account',
    'admin-mobile-logout',
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      invariant,
    ),
    true,
    'Mobile shell invariant missing: ' +
      invariant,
  );
}

assert.equal(
  bottomNavSource.includes(
    "event.key === 'Escape'"
  ),
  false,
  'Manual Escape listener must stay replaced by Radix Dialog.',
);

const validRoleTitleCasePattern =
  String.raw`/\b\w/g`;

const escapedRoleTitleCaseRegression =
  String.raw`/\\b\\w/g`;

assert.equal(
  bottomNavSource.includes(
    escapedRoleTitleCaseRegression,
  ),
  false,
  'Over-escaped mobile account formatter regression must stay removed.',
);

assert.equal(
  bottomNavSource.includes(
    validRoleTitleCasePattern,
  ),
  true,
  'Mobile account role formatter must use word-boundary title case.',
);

/**
 * ============================================================
 * SHELL CSS
 * ============================================================
 */

const shellCssSource =
  read(
    'src/styles/modules/admin-shell.css',
  );

for (
  const phaseMarker
  of [
    'UI-0A v2 — Spatial Environment + Workspace Canvas',
    'UI-0B v2 — Spatial Desktop Navigation Rail',
    'UI-0C v2 — Spatial Command Header',
    'UI-0D v2 — Spatial Mobile Shell',
    'UI-0E — Theme + Accessibility + Shell Hardening',
  ]
) {
  assert.equal(
    shellCssSource.includes(
      phaseMarker,
    ),
    true,
    'Missing App Shell phase marker: ' +
      phaseMarker,
  );
}

assert.match(
  shellCssSource,
  /\.admin-navigation-zone\s+\.admin-sidebar\[\s*data-admin-spatial-rail='ui-0b'\s*\]\s*\{[\s\S]*?position:\s*fixed;/,
  'Desktop rail must remain viewport-pinned.',
);

for (
  const accessibilityInvariant
  of [
    '.admin-nav-item:focus-visible',
    '.admin-bottom-item:focus-visible',
    '.admin-mobile-sheet-close:focus-visible',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
    'touch-action:',
    'max-width: 767px',
    'max-width: 359px',
    'min-width: 768px',
    'min-width: 1280px',
  ]
) {
  assert.equal(
    shellCssSource.includes(
      accessibilityInvariant,
    ),
    true,
    'Shell accessibility/responsive invariant missing: ' +
      accessibilityInvariant,
  );
}

/**
 * ============================================================
 * CONTRACT REGISTRATION
 * ============================================================
 */

for (
  const requiredContract
  of [
    'spatial-ui-foundation-contract-test.mjs',
    'admin-spatial-workspace-contract-test.mjs',
    'admin-spatial-navigation-rail-contract-test.mjs',
    'admin-spatial-command-header-contract-test.mjs',
    'admin-spatial-mobile-shell-contract-test.mjs',
    'admin-spatial-shell-hardening-contract-test.mjs',
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
    'Missing registered App Shell contract: ' +
      requiredContract,
  );
}

process.stdout.write(
  '✅ Admin Spatial App Shell UI-0E hardening contract passed.\n',
);
