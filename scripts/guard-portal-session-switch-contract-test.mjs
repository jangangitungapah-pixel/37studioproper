import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

function read(path) {
  return readFileSync(
    resolve(path),
    'utf8'
  );
}

const adminPageSource =
  read(
    'src/pages/AdminPage.jsx'
  );

const adminTopbarSource =
  read(
    'src/components/admin/AdminTopbar.jsx'
  );

const guardSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx'
  );

const rulesSource =
  read(
    'firestore.rules'
  );

const packageJson =
  JSON.parse(
    read(
      'package.json'
    )
  );

/*
 * Studio Guard remains isolated from the Admin shell.
 */
assert.equal(
  adminPageSource.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD'
  ),

  true,
  'AdminPage must still detect studio_guard.'
);

assert.equal(
  adminPageSource.includes(
    'to="/guard/attendance"'
  ),

  true,
  'studio_guard direct Admin access must still redirect to Guard Portal.'
);

/*
 * Admin shell exposes the explicit Guard Portal bridge to Owner only.
 * GP-6 has retired legacy Admin+isGuard shortcut compatibility.
 */
assert.equal(
  adminTopbarSource.includes(
    "import {\n  Link,\n} from 'react-router-dom';"
  ),

  true,
  'Admin Guard shortcut must use React Router Link.'
);

assert.match(
  adminTopbarSource,

  /user\??\.role\s*===\s*['"]owner['"]/,

  'Owner must receive the Guard Portal shortcut.'
);

assert.equal(
  adminTopbarSource.includes(
    'user.isGuard'
  ),
  false,
  'Legacy Admin+isGuard shortcut must be absent after GP-6.'
);

assert.doesNotMatch(
  adminTopbarSource,

  /user\??\.role\s*===\s*['"]admin['"]/,

  'Approved Admin must use the Guard cross-portal state, not an AdminTopbar Guard shortcut.'
);

assert.doesNotMatch(
  adminTopbarSource,

  /user\??\.role\s*===\s*['"]studio_guard['"]/,

  'AdminTopbar must not carry an unreachable studio_guard shortcut.'
);

for (
  const required
  of [
    'currentAdminPath',
    'state={{',
    'returnTo:',
    'to="/guard/attendance"',
  ]
) {
  assert.equal(
    adminTopbarSource.includes(
      required
    ),

    true,
    'Admin-to-Guard SPA intent marker missing: ' + required
  );
}

assert.equal(
  adminTopbarSource.includes(
    'href="/guard/attendance"'
  ),

  false,
  'Admin-to-Guard portal switch must not use a raw page reload.'
);

assert.match(
  adminPageSource,

  /currentAdminPath=\{[\s\S]*?location\.pathname[\s\S]*?location\.search[\s\S]*?location\.hash/,

  'AdminPage must preserve the current Admin route when opening Guard Portal.'
);

/*
 * Guard Portal resolves a safe return path from router state.
 */
for (
  const required
  of [
    "from 'react-router-dom'",
    'useLocation',
    'const adminReturnPath = useMemo(() => {',
    'location.state?.returnTo',
    "returnTo.startsWith('/admin/')",
    "returnTo.startsWith('/admin?')",
    "returnTo.startsWith('/admin#')",
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,
    'Guard return-intent marker missing: ' + required
  );
}

/*
 * Owner/Admin portal switches are SPA links and never logout operations.
 */
for (
  const required
  of [
    'to={adminReturnPath}',
    'to="/admin/operations/guard-attendance"',
    'Kembali ke Admin',
    'Buka Attendance Review',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,
    'Guard-to-Admin SPA action missing: ' + required
  );
}

for (
  const forbidden
  of [
    'href="/admin"',
    'href="/admin/operations/guard-attendance"',
  ]
) {
  assert.equal(
    guardSource.includes(
      forbidden
    ),

    false,
    'Guard portal switch must not force page reload: ' + forbidden
  );
}

/*
 * Approved non-Guard Admin receives a role-aware cross-portal state.
 */
for (
  const required
  of [
    'const isAdminCrossPortal = Boolean(',
    'GUARD_PORTAL_ACCESS.REDIRECT_ADMIN',
    'aria-label="Admin Cross Portal"',
    'Anda login sebagai Admin.',
    'canReviewGuardAttendance',
    "hasAdminPagePermission(\n      guardAccount,\n      'guard-attendance'",
    '!isAdminCrossPortal',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,
    'Admin cross-portal marker missing: ' + required
  );
}

/*
 * Global logout remains one shared Firebase account logout and is explicit.
 */
assert.equal(
  guardSource.includes(
    'Keluar Akun'
  ),

  true,
  'Guard logout must use the explicit Keluar Akun label.'
);

assert.match(
  guardSource,

  /async function handleLogout\(\)[\s\S]*?adminAuthRepository\.signOutAdmin\(\)/,

  'Global Guard logout must continue delegating to shared signOutAdmin.'
);

/*
 * Dedicated Guard login stays on the requested Guard route after auth.
 * No Admin redirect is inserted into either login handler.
 */
const signInBlock =
  guardSource.slice(
    guardSource.indexOf(
      'async function handleSignIn'
    ),
    guardSource.indexOf(
      'async function handleGoogleSignIn'
    ),
  );

const googleBlock =
  guardSource.slice(
    guardSource.indexOf(
      'async function handleGoogleSignIn'
    ),
    guardSource.indexOf(
      'async function handleLogout'
    ),
  );

assert.equal(
  signInBlock.includes(
    '/admin'
  ),

  false,
  'Email/password Guard login must preserve Guard route intent.'
);

assert.equal(
  googleBlock.includes(
    '/admin'
  ),

  false,
  'Google Guard login must preserve Guard route intent.'
);

/*
 * Security rules remain unchanged: Owner reviews, Guard self-creates.
 */
assert.match(
  rulesSource,

  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,

  'Owner review authority must remain unchanged.'
);

assert.match(
  rulesSource,

  /function guardCreatesOwnAttendance\(data, attendanceId\) \{\s*return isStudioGuardAccount\(\)/,

  'Guard attendance create must remain Studio Guard self-only.'
);

/*
 * GP-4 targeted contract registration.
 */
assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-portal-session-switch-contract-test.mjs'
  ),

  true,
  'GP-4 session-switch contract must be registered in npm test.'
);

console.log(
  'guard-portal-session-switch-contract-test: PASS'
);
