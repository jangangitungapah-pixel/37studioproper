import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(
    resolve(path),
    'utf8'
  );
}

const accountRolesSource =
  read(
    'src/utils/accountRoles.js'
  );

const adminPermissionsSource =
  read(
    'src/utils/adminPermissions.js'
  );

const adminPageSource =
  read(
    'src/pages/AdminPage.jsx'
  );

const guardPageSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx'
  );

const adminTopbarSource =
  read(
    'src/components/admin/AdminTopbar.jsx'
  );

const authRepositorySource =
  read(
    'src/services/adminAuthRepository.js'
  );

const rulesSource =
  read(
    'firestore.rules'
  );

const baselineDocSource =
  read(
    'docs/guard-portal-flow-baseline.md'
  );

const packageJson =
  JSON.parse(
    read(
      'package.json'
    )
  );

const CURRENT_GUARD_PORTAL_MATRIX =
  Object.freeze({
    owner: {
      currentGuardPageResult:
        'generic-guard-blocked',

      currentAdminPortal:
        true,

      target:
        'owner-oversight',
    },

    admin: {
      currentGuardPageResult:
        'generic-guard-blocked',

      currentAdminPortal:
        true,

      target:
        'redirect-admin',
    },

    studio_guard: {
      currentGuardPageResult:
        'guard-operational',

      currentAdminPortal:
        false,

      target:
        'guard-operational',
    },

    client: {
      currentGuardPageResult:
        'generic-guard-blocked',

      currentAdminPortal:
        false,

      target:
        'wrong-portal-client',
    },

    legacy_admin_guard: {
      currentGuardPageResult:
        'guard-operational-compatibility',

      currentAdminPortal:
        true,

      target:
        'migration-required',
    },
  });

assert.deepEqual(
  Object.keys(
    CURRENT_GUARD_PORTAL_MATRIX
  ),

  [
    'owner',
    'admin',
    'studio_guard',
    'client',
    'legacy_admin_guard',
  ],

  'GP-0 must retain the five audited account contexts.'
);

for (
  const marker
  of [
    'CURRENT ACCESS MATRIX',
    'TARGET BOUNDARIES',
    'Guard Portal access is still decided inside',
    'Owner -> current: generic blocked; target: OWNER_OVERSIGHT',
    'Studio Guard -> current: operational; target: GUARD_OPERATIONAL',
    'Legacy Admin + isGuard -> current: compatibility operational; target: MIGRATION_REQUIRED',
    'No runtime behavior change in GP-0.',
  ]
) {
  assert.equal(
    baselineDocSource.includes(
      marker
    ),

    true,

    'Guard portal baseline documentation missing: ' +
      marker
  );
}

/*
 * GP-1 promoted Guard into the canonical
 * shared portal access resolver.
 */
assert.equal(
  accountRolesSource.includes(
    "if (portal === 'guard')"
  ),

  true,

  'Shared account-role resolver must include Guard portal intent.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-portal-access-resolution-contract-test.mjs'
  ),

  true,

  'GP-1 resolver contract must remain registered.'
);

/*
 * GP-2 removes Guard page's own Firebase
 * authentication and one-shot Firestore user read.
 */
for (
  const forbidden
  of [
    "from 'firebase/auth'",
    "from 'firebase/firestore'",
    'onAuthStateChanged',
    'signInWithEmailAndPassword',
    'GoogleAuthProvider',
    'signInWithPopup',
    'getDoc',
    'readGuardAccount',
  ]
) {
  assert.equal(
    guardPageSource.includes(
      forbidden
    ),

    false,

    'GP-2 must remove direct Guard auth dependency: ' +
      forbidden
  );
}

for (
  const required
  of [
    'adminAuthRepository.subscribeAdminAuth',
    'adminAuthRepository.signOutAdmin',
    '/login?portal=guard&redirectTo=%2Fguard%2Fattendance',
    'resolveGuardPortalAccess',
    'GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL',
    'Memeriksa akses portal...',
  ]
) {
  assert.equal(
    guardPageSource.includes(
      required
    ),

    true,

    'GP-2 shared Guard session marker missing: ' +
      required
  );
}

/*
 * Firebase auth-state and realtime user identity
 * now live behind the shared auth repository.
 */
assert.equal(
  authRepositorySource.includes(
    'onAuthStateChanged'
  ),

  true,

  'Shared auth repository must remain responsible for Firebase auth-state changes.'
);

assert.equal(
  authRepositorySource.includes(
    'onSnapshot'
  ),

  true,

  'Shared auth repository must remain responsible for realtime users/{uid} updates.'
);

/*
 * Existing studio_guard isolation remains hard invariant.
 */
assert.equal(
  adminPermissionsSource.includes(
    'export const guardPortalPermissionKeys = [];'
  ),

  true,

  'studio_guard must continue owning zero admin-page permissions.'
);

assert.equal(
  adminPageSource.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD'
  ),

  true,

  'AdminPage must continue detecting studio_guard accounts.'
);

assert.equal(
  adminPageSource.includes(
    'to="/guard/attendance"'
  ),

  true,

  'studio_guard direct Admin access must continue redirecting to Guard Portal.'
);

/*
 * GP-6 closes the migration window.
 * The GP-0 baseline document remains historical evidence, while live runtime
 * and Firestore authorization must no longer accept mixed Admin + Guard.
 */
for (
  const forbidden
  of [
    'LEGACY_GUARD_OPERATIONAL',
    'identity?.isGuard === true',
  ]
) {
  assert.equal(
    accountRolesSource.includes(
      forbidden
    ),
    false,
    'GP-6 must retire legacy resolver marker: ' +
      forbidden
  );
}

assert.equal(
  adminTopbarSource.includes(
    'user.isGuard'
  ),
  false,
  'GP-6 must retire legacy Admin Guard shortcut.'
);

assert.equal(
  rulesSource.includes(
    'getUserData().isGuard == true'
  ),
  false,
  'GP-6 must retire legacy Admin Guard Firestore authorization.'
);

/*
 * Owner already owns attendance review authority.
 * GP-2 must not broaden Firestore rules.
 */
assert.match(
  rulesSource,

  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,

  'Owner attendance review authority must remain present.'
);

/*
 * GP-3 gives approved Owner a dedicated oversight state.
 * The generic blocked copy may remain for Admin/Client/pending states,
 * but Owner must be excluded from that branch.
 */
for (
  const required
  of [
    'const isOwnerOversight = Boolean(',
    'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
    'Owner Mode',
    'Read-only Oversight',
    'Anda sedang melihat Guard Portal sebagai Owner',
    'Mode Owner tidak membuat attendance. Gunakan akun Guard',
    'Kembali ke Admin',
    'Buka Attendance Review',
    '/admin/operations/guard-attendance',
    '!isOwnerOversight',
  ]
) {
  assert.equal(
    guardPageSource.includes(
      required
    ),

    true,

    'GP-3 Owner Oversight marker missing: ' +
      required
  );
}

assert.equal(
  packageJson.scripts.test.includes(
    'guard-owner-oversight-contract-test.mjs'
  ),

  true,

  'GP-3 Owner Oversight contract must remain registered.'
);



/*
 * GP-4 separates portal switching from global account logout.
 */
for (
  const required
  of [
    'const isAdminCrossPortal = Boolean(',
    'GUARD_PORTAL_ACCESS.REDIRECT_ADMIN',
    'Anda login sebagai Admin.',
    'canReviewGuardAttendance',
    'Kembali ke Admin',
    'Keluar Akun',
    'to={adminReturnPath}',
    'to="/admin/operations/guard-attendance"',
  ]
) {
  assert.equal(
    guardPageSource.includes(
      required
    ),

    true,

    'GP-4 Guard portal session marker missing: ' +
      required
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
    guardPageSource.includes(
      forbidden
    ),

    false,

    'GP-4 must remove raw Guard-to-Admin reload navigation: ' +
      forbidden
  );
}

assert.equal(
  adminTopbarSource.includes(
    "from 'react-router-dom'"
  ),

  true,

  'Admin Guard shortcut must use React Router after GP-4.'
);

assert.match(
  adminTopbarSource,

  /user\??\.role\s*===\s*['"]owner['"]/,

  'Owner must receive an explicit Guard Portal shortcut.'
);

assert.doesNotMatch(
  adminTopbarSource,

  /user\??\.role\s*===\s*['"]studio_guard['"]/,

  'Unreachable studio_guard AdminTopbar shortcut must be removed.'
);

assert.equal(
  adminTopbarSource.includes(
    'href="/guard/attendance"'
  ),

  false,

  'Admin-to-Guard switch must not use a raw page reload.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-portal-session-switch-contract-test.mjs'
  ),

  true,

  'GP-4 portal session switch contract must remain registered.'
);


for (
  const contractName
  of [
    'guard-portal-isolation-contract-test.mjs',
    'guard-role-transition-contract-test.mjs',
    'guard-attendance-reliability-contract-test.mjs',
    'guard-meal-reconciliation-contract-test.mjs',
    'guard-portal-flow-baseline-contract-test.mjs',
    'guard-portal-access-resolution-contract-test.mjs',
    'guard-identity-realtime-contract-test.mjs',
  ]
) {
  assert.equal(
    packageJson.scripts.test.includes(
      contractName
    ),

    true,

    'Guard regression gate missing from npm test: ' +
      contractName
  );
}

console.log(
  'guard-portal-flow-baseline-contract-test: PASS'
);
