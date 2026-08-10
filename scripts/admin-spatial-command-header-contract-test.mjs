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

/*
 * GP-4 portal ownership must remain reflected in the command header contract.
 *
 * studio_guard never owns the Admin shell: AdminPage redirects it to Guard
 * before AdminTopbar renders. Owner now owns the explicit cross-portal
 * shortcut. GP-6 retires legacy admin+isGuard compatibility.
 */
assert.match(
  topbarSource,
  /user\??\.role\s*===\s*['"]owner['"]/,
  'Owner Guard shortcut eligibility must remain formatting-agnostic.',
);

assert.doesNotMatch(
  topbarSource,
  /user\??\.role\s*===\s*['"]admin['"]/,
  'GP-6 must remove legacy Admin Guard shortcut eligibility.',
);

assert.doesNotMatch(
  topbarSource,
  /user\.isGuard\s*===\s*true/,
  'GP-6 must remove legacy Admin Guard flag eligibility.',
);

assert.doesNotMatch(
  topbarSource,
  /user\??\.role\s*===\s*['"]studio_guard['"]/,
  'studio_guard shortcut must stay absent because AdminPage owns its redirect.',
);

assert.equal(
  topbarSource.includes(
    "from 'react-router-dom'"
  ),
  true,
  'Guard Portal shortcut must use React Router after GP-4.',
);

assert.equal(
  topbarSource.includes(
    'to="/guard/attendance"'
  ),
  true,
  'Guard Portal destination must remain /guard/attendance.',
);

assert.equal(
  topbarSource.includes(
    'href="/guard/attendance"'
  ),
  false,
  'Guard Portal switch must not use a raw page reload after GP-4.',
);

assert.equal(
  topbarSource.includes(
    'currentAdminPath'
  ),
  true,
  'Guard Portal shortcut must preserve the current Admin return route.',
);

assert.equal(
  topbarSource.includes(
    'returnTo:'
  ),
  true,
  'Admin-to-Guard navigation must carry return intent.',
);

assert.match(
  topbarSource,
  /window\.addEventListener\(\s*['"]online['"]/,
  'Online listener must remain registered.',
);

assert.match(
  topbarSource,
  /window\.addEventListener\(\s*['"]offline['"]/,
  'Offline listener must remain registered.',
);

assert.equal(
  topbarSource.includes(
    'navigator.onLine'
  ),
  true,
  'Initial connectivity state must remain browser-derived.',
);

assert.equal(
  topbarSource.includes(
    'setIsOnline('
  ),
  true,
  'Connectivity updates must remain state-driven.',
);

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

assert.match(
  adminPageSource,
  /ACCOUNT_ROLES\.STUDIO_GUARD[\s\S]*?to="\/guard\/attendance"/,
  'studio_guard must remain redirected before the Admin command header renders.',
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
