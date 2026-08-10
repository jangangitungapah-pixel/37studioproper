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
  'GP-0 must freeze the five audited account contexts.'
);

// Current account-role resolver only models Admin and Client portals.
// GP-1 is expected to intentionally replace this baseline.
assert.equal(
  accountRolesSource.includes("if (portal === 'admin')"),
  true,
  'Admin portal access branch must exist in the GP-0 baseline.'
);
assert.equal(
  accountRolesSource.includes("if (portal === 'client')"),
  true,
  'Client portal access branch must exist in the GP-0 baseline.'
);
assert.equal(
  accountRolesSource.includes("portal === 'guard'"),
  false,
  'GP-0 records that Guard is not yet a first-class portal intent.'
);

// Existing studio_guard isolation is a hard invariant, not technical debt.
assert.equal(
  adminPermissionsSource.includes("export const guardPortalPermissionKeys = [];"),
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

// Guard Portal currently owns a duplicate Firebase Auth / identity stack.
// GP-2 will intentionally remove these direct dependencies.
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
    'GP-0 direct Guard auth evidence missing: ' + marker
  );
}

// Legacy mixed Admin + Guard compatibility is recorded explicitly.
// It is debt to migrate, not a product feature to preserve indefinitely.
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

// Owner already has attendance review authority. Future Owner Oversight UI
// must reuse this authority and must not broaden Firestore rules.
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

// The current misleading Owner/Admin lock copy is deliberately frozen as a
// known GP-0 defect so GP-3/GP-7 can replace it with role-aware states.
assert.equal(
  guardPageSource.includes('Akun ini belum aktif sebagai Penjaga Studio.'),
  true,
  'GP-0 expected current generic Guard blocked copy.'
);

// Baseline documentation must keep current-vs-target semantics explicit.
for (const marker of [
  'CURRENT ACCESS MATRIX',
  'TARGET BOUNDARIES',
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

// Existing Guard lifecycle/security contracts remain mandatory.
for (const contractName of [
  'guard-portal-isolation-contract-test.mjs',
  'guard-role-transition-contract-test.mjs',
  'guard-attendance-reliability-contract-test.mjs',
  'guard-meal-reconciliation-contract-test.mjs',
]) {
  assert.equal(
    packageJson.scripts.test.includes(contractName),
    true,
    'Existing Guard regression gate missing from npm test: ' + contractName
  );
}

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-portal-flow-baseline-contract-test.mjs'
  ),
  true,
  'GP-0 baseline contract must be registered in npm test.'
);

console.log('guard-portal-flow-baseline-contract-test: PASS');
