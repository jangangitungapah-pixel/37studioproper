import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  GUARD_PORTAL_ACCESS,
  getAccountIdentityIntentForPortal,
  getPortalAccess,
  isGuardOperationalAccount,
  isLegacyGuardOperationalAccount,
  isOwnerOversightAccount,
  resolveGuardPortalAccess,
} from '../src/utils/accountRoles.js';

const owner = {
  role: ACCOUNT_ROLES.OWNER,
  status: ACCOUNT_STATUSES.APPROVED,
};

const approvedAdmin = {
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.APPROVED,
};

const pendingAdmin = {
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.PENDING,
};

const rejectedAdmin = {
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.REJECTED,
};

const operationalGuard = {
  guardId: 'crew-guard-1',
  role: ACCOUNT_ROLES.STUDIO_GUARD,
  status: ACCOUNT_STATUSES.APPROVED,
};

const guardMissingIdentity = {
  role: ACCOUNT_ROLES.STUDIO_GUARD,
  status: ACCOUNT_STATUSES.APPROVED,
};

const blockedGuard = {
  guardId: 'crew-guard-2',
  role: ACCOUNT_ROLES.STUDIO_GUARD,
  status: ACCOUNT_STATUSES.REJECTED,
};

const client = {
  role: ACCOUNT_ROLES.CLIENT,
  status: ACCOUNT_STATUSES.ACTIVE,
};

const legacyAdminGuard = {
  guardId: 'crew-legacy-guard',
  isGuard: true,
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.APPROVED,
};

const legacyAdminGuardMissingIdentity = {
  isGuard: true,
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.APPROVED,
};

const scenarios = [
  [null, GUARD_PORTAL_ACCESS.MISSING_ACCOUNT],
  [owner, GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT],
  [approvedAdmin, GUARD_PORTAL_ACCESS.REDIRECT_ADMIN],
  [pendingAdmin, GUARD_PORTAL_ACCESS.BLOCKED],
  [rejectedAdmin, GUARD_PORTAL_ACCESS.BLOCKED],
  [operationalGuard, GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL],
  [guardMissingIdentity, GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED],
  [blockedGuard, GUARD_PORTAL_ACCESS.BLOCKED],
  [client, GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT],
  [legacyAdminGuard, GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL],
  [legacyAdminGuardMissingIdentity, GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED],
  [{ role: 'mystery', status: 'approved' }, GUARD_PORTAL_ACCESS.INVALID_ACCOUNT],
];

for (const [identity, expected] of scenarios) {
  assert.equal(
    resolveGuardPortalAccess(identity),
    expected,
    `${identity?.role || 'missing'} Guard access must resolve to ${expected}`
  );
}

for (const [identity, expected] of scenarios.slice(1)) {
  assert.equal(
    getPortalAccess(identity, 'guard'),
    expected,
    `getPortalAccess(..., 'guard') must delegate ${identity?.role} to the canonical Guard resolver.`
  );
}

assert.equal(isOwnerOversightAccount(owner), true);
assert.equal(isOwnerOversightAccount(approvedAdmin), false);

assert.equal(isGuardOperationalAccount(operationalGuard), true);
assert.equal(isGuardOperationalAccount(guardMissingIdentity), false);
assert.equal(isGuardOperationalAccount(owner), false);

assert.equal(isLegacyGuardOperationalAccount(legacyAdminGuard), true);
assert.equal(isLegacyGuardOperationalAccount(legacyAdminGuardMissingIdentity), false);
assert.equal(isLegacyGuardOperationalAccount(operationalGuard), false);

assert.equal(
  getAccountIdentityIntentForPortal('guard'),
  'admin',
  'Guard entry must never self-create a Client identity.'
);
assert.equal(getAccountIdentityIntentForPortal('admin'), 'admin');
assert.equal(getAccountIdentityIntentForPortal('client'), 'client');
assert.equal(getAccountIdentityIntentForPortal('unknown'), '');

const accountRoleRepositorySource = readFileSync(
  resolve('src/services/accountRoleRepository.js'),
  'utf8'
);

assert.equal(
  accountRoleRepositorySource.includes('getAccountIdentityIntentForPortal'),
  true,
  'Account repository must use the canonical portal intent helper.'
);
assert.equal(
  accountRoleRepositorySource.includes("throw new Error('Portal akun tidak didukung.')"),
  true,
  'Unknown portal intents must fail closed instead of creating an account with an accidental role.'
);

const adminPermissionsSource = readFileSync(
  resolve('src/utils/adminPermissions.js'),
  'utf8'
);

assert.equal(
  adminPermissionsSource.includes('export const guardPortalPermissionKeys = [];'),
  true,
  'GP-1 must preserve zero Admin-page permissions for studio_guard.'
);

const rulesSource = readFileSync(resolve('firestore.rules'), 'utf8');
assert.match(
  rulesSource,
  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,
  'GP-1 must not broaden or remove Owner attendance review authority.'
);

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-portal-access-resolution-contract-test.mjs'
  ),
  true,
  'GP-1 Guard portal access contract must be registered in npm test.'
);

console.log('guard-portal-access-resolution-contract-test: PASS');
