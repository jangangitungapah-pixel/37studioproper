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
    'adminAuthRepository.signInAdmin',
    'adminAuthRepository.signInWithGoogle',
    'adminAuthRepository.signOutAdmin',
    'resolveGuardPortalAccess',
    'GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL',
    'GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL',
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
 * Legacy Admin + isGuard survives only through
 * GP-1 canonical resolver until GP-6 migration.
 */
assert.equal(
  accountRolesSource.includes(
    'identity?.isGuard === true'
  ),

  true,

  'Canonical resolver must still carry legacy isGuard compatibility until GP-6.'
);

assert.match(
  adminTopbarSource,

  /user\.role ===\s*'admin'[\s\S]*?user\.isGuard ===\s*true/,

  'Admin topbar legacy admin+isGuard compatibility evidence missing.'
);

assert.match(
  rulesSource,

  /getUserData\(\)\.role == 'admin'[\s\S]*?getUserData\(\)\.isGuard == true/,

  'Firestore legacy admin+isGuard compatibility evidence missing.'
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
 * Role-aware Owner UI intentionally remains GP-3 / GP-7.
 */
assert.equal(
  guardPageSource.includes(
    'Akun ini belum punya role Penjaga Studio approved.'
  ),

  true,

  'GP-2 must not silently absorb Owner Oversight UI work.'
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
