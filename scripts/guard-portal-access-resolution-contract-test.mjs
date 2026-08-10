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

const legacyShapedAdmin = {
  guardId: 'crew-legacy-guard',
  isGuard: true,
  role: ACCOUNT_ROLES.ADMIN,
  status: ACCOUNT_STATUSES.APPROVED,
};

const legacyShapedAdminMissingIdentity = {
  isGuard: true,
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

const scenarios = [
  [null, GUARD_PORTAL_ACCESS.MISSING_ACCOUNT],
  [owner, GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT],
  [approvedAdmin, GUARD_PORTAL_ACCESS.REDIRECT_ADMIN],
  [legacyShapedAdmin, GUARD_PORTAL_ACCESS.REDIRECT_ADMIN],
  [legacyShapedAdminMissingIdentity, GUARD_PORTAL_ACCESS.REDIRECT_ADMIN],
  [pendingAdmin, GUARD_PORTAL_ACCESS.BLOCKED],
  [rejectedAdmin, GUARD_PORTAL_ACCESS.BLOCKED],
  [operationalGuard, GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL],
  [guardMissingIdentity, GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED],
  [blockedGuard, GUARD_PORTAL_ACCESS.BLOCKED],
  [client, GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT],
  [{ role: 'mystery', status: 'approved' }, GUARD_PORTAL_ACCESS.INVALID_ACCOUNT],
];

for (const [identity, expected] of scenarios) {
  assert.equal(
    resolveGuardPortalAccess(identity),
    expected,
    `${identity?.role || 'missing'} Guard access must resolve to ${expected}`,
  );
}

for (const [identity, expected] of scenarios.slice(1)) {
  assert.equal(
    getPortalAccess(identity, 'guard'),
    expected,
    `getPortalAccess(..., 'guard') must delegate ${identity?.role} to the canonical Guard resolver.`,
  );
}

assert.equal(isOwnerOversightAccount(owner), true);
assert.equal(isOwnerOversightAccount(approvedAdmin), false);
assert.equal(isGuardOperationalAccount(operationalGuard), true);
assert.equal(isGuardOperationalAccount(guardMissingIdentity), false);
assert.equal(isGuardOperationalAccount(owner), false);

assert.equal(
  Object.prototype.hasOwnProperty.call(
    GUARD_PORTAL_ACCESS,
    'LEGACY_GUARD_OPERATIONAL',
  ),
  false,
  'GP6 must retire LEGACY_GUARD_OPERATIONAL from the canonical state model.',
);

assert.equal(
  getAccountIdentityIntentForPortal('guard'),
  'admin',
  'Guard entry must never self-create a Client identity.',
);
assert.equal(getAccountIdentityIntentForPortal('admin'), 'admin');
assert.equal(getAccountIdentityIntentForPortal('client'), 'client');
assert.equal(getAccountIdentityIntentForPortal('unknown'), '');

const accountRoleRepositorySource = readFileSync(
  resolve('src/services/accountRoleRepository.js'),
  'utf8',
);

assert.equal(
  accountRoleRepositorySource.includes('getAccountIdentityIntentForPortal'),
  true,
);

const adminPermissionsSource = readFileSync(
  resolve('src/utils/adminPermissions.js'),
  'utf8',
);

assert.equal(
  adminPermissionsSource.includes('export const guardPortalPermissionKeys = [];'),
  true,
  'studio_guard must retain zero Admin-page permissions.',
);

const rulesSource = readFileSync(resolve('firestore.rules'), 'utf8');

assert.match(
  rulesSource,
  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,
  'Owner attendance review authority must remain intact.',
);

console.log('guard-portal-access-resolution-contract-test: PASS');
