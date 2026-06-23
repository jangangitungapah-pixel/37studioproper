import assert from 'node:assert/strict';
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  PORTAL_ACCESS,
  canConvertAdminRequestToClient,
  createAdminPermissions,
  getPortalAccess,
} from '../src/utils/accountRoles.js';

const client = { role: ACCOUNT_ROLES.CLIENT, status: ACCOUNT_STATUSES.ACTIVE };
const adminPending = { role: ACCOUNT_ROLES.ADMIN, status: ACCOUNT_STATUSES.PENDING };
const adminApproved = { role: ACCOUNT_ROLES.ADMIN, status: ACCOUNT_STATUSES.APPROVED };
const adminRejected = { role: ACCOUNT_ROLES.ADMIN, status: ACCOUNT_STATUSES.REJECTED };
const owner = { role: ACCOUNT_ROLES.OWNER, status: ACCOUNT_STATUSES.APPROVED };
const studioGuard = { role: ACCOUNT_ROLES.STUDIO_GUARD, status: ACCOUNT_STATUSES.APPROVED };

const scenarios = [
  [client, 'client', PORTAL_ACCESS.ALLOWED],
  [client, 'admin', PORTAL_ACCESS.WRONG_PORTAL_CLIENT],
  [adminPending, 'admin', PORTAL_ACCESS.ADMIN_PENDING],
  [adminPending, 'client', PORTAL_ACCESS.ADMIN_PENDING_CLIENT_CHOICE],
  [adminApproved, 'admin', PORTAL_ACCESS.ALLOWED],
  [adminApproved, 'client', PORTAL_ACCESS.WRONG_PORTAL_ADMIN],
  [adminRejected, 'admin', PORTAL_ACCESS.ADMIN_BLOCKED],
  [adminRejected, 'client', PORTAL_ACCESS.ADMIN_INACTIVE_CLIENT_CHOICE],
  [owner, 'admin', PORTAL_ACCESS.ALLOWED],
  [owner, 'client', PORTAL_ACCESS.WRONG_PORTAL_ADMIN],
  [studioGuard, 'admin', PORTAL_ACCESS.ALLOWED],
  [studioGuard, 'client', PORTAL_ACCESS.WRONG_PORTAL_ADMIN],
  [null, 'client', PORTAL_ACCESS.MISSING_ACCOUNT],
];

for (const [identity, portal, expected] of scenarios) {
  assert.equal(getPortalAccess(identity, portal), expected, `${identity?.role || 'missing'} -> ${portal}`);
}

assert.equal(canConvertAdminRequestToClient(adminPending), true);
assert.equal(canConvertAdminRequestToClient(adminRejected), true);
assert.equal(canConvertAdminRequestToClient(adminApproved), false);
assert.equal(canConvertAdminRequestToClient(owner), false);
assert.equal(canConvertAdminRequestToClient(client), false);
assert.equal(Object.values(createAdminPermissions(false)).every((value) => value === false), true);
