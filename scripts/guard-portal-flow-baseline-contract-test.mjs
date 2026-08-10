import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path) {
  return readFileSync(resolve(path), 'utf8');
}

const accountRolesSource = read('src/utils/accountRoles.js');
const adminPermissionsSource = read('src/utils/adminPermissions.js');
const adminPageSource = read('src/pages/AdminPage.jsx');
const guardPageSource = read('src/pages/guard/GuardAttendancePage.jsx');
const adminTopbarSource = read('src/components/admin/AdminTopbar.jsx');
const rulesSource = read('firestore.rules');
const baselineDocSource = read('docs/guard-portal-flow-baseline.md');
const packageJson = JSON.parse(read('package.json'));

const CURRENT_GUARD_PORTAL_MATRIX = Object.freeze({
  owner: {
    currentGuardPageResult: 'generic-guard-blocked',
    currentAdminPortal: true,
    target: 'owner-oversight',
  },
  admin: {
    currentGuardPageResult: 'generic-guard-blocked',
    currentAdminPortal: true,
    target: 'redirect-admin',
  },
  studio_guard: {
    currentGuardPageResult: 'guard-operational',
    currentAdminPortal: false,
    target: 'guard-operational',
  },
  client: {
    currentGuardPageResult: 'generic-guard-blocked',
    currentAdminPortal: false,
    target: 'wrong-portal-client',
  },
  legacy_admin_guard: {
    currentGuardPageResult: 'guard-operational-compatibility',
    currentAdminPortal: true,
    target: 'migration-required',
  },
});

assert.deepEqual(
  Object.keys(CURRENT_GUARD_PORTAL_MATRIX),
  ['owner', 'admin', 'studio_guard', 'client', 'legacy_admin_guard'],
  'GP-0 must retain the five audited account contexts.'
);

// The baseline document remains the immutable record of pre-remediation policy.
for (const marker of [
  'CURRENT ACCESS MATRIX',
  'TARGET BOUNDARIES',
  'Guard Portal access is still decided inside',
  'Owner -> current: generic blocked; target: OWNER_OVERSIGHT',
  'Studio Guard -> current: operational; target: GUARD_OPERATIONAL',
  'Legacy Admin + isGuard -> current: compatibility operational; target: MIGRATION_REQUIRED',
  'No runtime behavior change in GP-0.',
]) {
  assert.equal(
    baselineDocSource.includes(marker),
    true,
    'Guard portal baseline documentation missing: ' + marker
  );
}

// GP-1 intentionally promotes Guard to a first-class portal intent.
assert.equal(
  accountRolesSource.includes("if (portal === 'guard')"),
  true,
  'After GP-1 the shared account-role resolver must include Guard portal intent.'
);
assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-portal-access-resolution-contract-test.mjs'
  ),
  true,
  'GP-1 resolver contract must accompany the intentional baseline transition.'
);

// Existing studio_guard isolation is a hard invariant, not technical debt.
assert.equal(
  adminPermissionsSource.includes('export const guardPortalPermissionKeys = [];'),
  true,
  'studio_guard must continue owning zero admin-page permissions.'
);
assert.equal(
  adminPageSource.includes('ACCOUNT_ROLES.STUDIO_GUARD'),
  true,
  'AdminPage must continue detecting studio_guard accounts.'
);
assert.equal(
  adminPageSource.includes('to="/guard/attendance"'),
  true,
  'studio_guard direct Admin access must continue redirecting to Guard Portal.'
);

// Guard Portal still owns duplicate Firebase Auth / identity logic at GP-1.
// GP-2 is explicitly responsible for removing these direct dependencies.
for (const marker of [
  'onAuthStateChanged',
  'signInWithEmailAndPassword',
  'signOut',
  'GoogleAuthProvider',
  'signInWithPopup',
  'getDoc',
  'readGuardAccount',
]) {
  assert.equal(
    guardPageSource.includes(marker),
    true,
    'GP-1 direct Guard auth evidence missing before GP-2: ' + marker
  );
}

// Legacy mixed Admin + Guard compatibility remains migration debt until GP-6.
assert.match(
  guardPageSource,
  /account\.role === 'admin' && account\.isGuard === true/,
  'Guard page legacy admin+isGuard compatibility evidence missing.'
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

// Owner already has attendance review authority. Owner Oversight must reuse it.
assert.match(
  rulesSource,
  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,
  'Owner attendance review authority must remain present.'
);
assert.match(
  rulesSource,
  /match \/guardAttendanceSessions\/\{attendanceId\} \{[\s\S]*?allow read: if[\s\S]*?canManageGuardAttendance\(\)/,
  'Owner/admin attendance read path must remain protected by the review authority.'
);

// The misleading lock copy remains a known UI defect until GP-3/GP-7.
assert.equal(
  guardPageSource.includes('Akun ini belum aktif sebagai Penjaga Studio.'),
  true,
  'GP-1 must not silently mix UI remediation into the resolver phase.'
);

for (const contractName of [
  'guard-portal-isolation-contract-test.mjs',
  'guard-role-transition-contract-test.mjs',
  'guard-attendance-reliability-contract-test.mjs',
  'guard-meal-reconciliation-contract-test.mjs',
  'guard-portal-flow-baseline-contract-test.mjs',
]) {
  assert.equal(
    packageJson.scripts.test.includes(contractName),
    true,
    'Guard regression gate missing from npm test: ' + contractName
  );
}

console.log('guard-portal-flow-baseline-contract-test: PASS');
