import { adminPermissionPages } from './adminPermissions.js';

export const ACCOUNT_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  CLIENT: 'client',
});

export const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const PORTAL_ACCESS = Object.freeze({
  ALLOWED: 'allowed',
  ADMIN_PENDING: 'admin_pending',
  ADMIN_BLOCKED: 'admin_blocked',
  WRONG_PORTAL_CLIENT: 'wrong_portal_client',
  WRONG_PORTAL_ADMIN: 'wrong_portal_admin',
  ADMIN_PENDING_CLIENT_CHOICE: 'admin_pending_client_choice',
  ADMIN_INACTIVE_CLIENT_CHOICE: 'admin_inactive_client_choice',
  INVALID_ACCOUNT: 'invalid_account',
  MISSING_ACCOUNT: 'missing_account',
});

export function createAdminPermissions(enabled = false) {
  return adminPermissionPages.reduce((permissions, page) => ({
    ...permissions,
    [page.key]: Boolean(enabled),
  }), {});
}

export function isAdminAccount(identity) {
  return identity?.role === ACCOUNT_ROLES.ADMIN || identity?.role === ACCOUNT_ROLES.OWNER;
}

export function isClientAccount(identity) {
  return identity?.role === ACCOUNT_ROLES.CLIENT && identity?.status === ACCOUNT_STATUSES.ACTIVE;
}

export function getPortalAccess(identity, portal) {
  if (!identity) return PORTAL_ACCESS.MISSING_ACCOUNT;

  if (portal === 'admin') {
    if (isClientAccount(identity)) return PORTAL_ACCESS.WRONG_PORTAL_CLIENT;
    if (!isAdminAccount(identity)) return PORTAL_ACCESS.INVALID_ACCOUNT;
    if (identity.status === ACCOUNT_STATUSES.APPROVED) return PORTAL_ACCESS.ALLOWED;
    if (identity.role === ACCOUNT_ROLES.ADMIN && identity.status === ACCOUNT_STATUSES.PENDING) {
      return PORTAL_ACCESS.ADMIN_PENDING;
    }
    return PORTAL_ACCESS.ADMIN_BLOCKED;
  }

  if (portal === 'client') {
    if (isClientAccount(identity)) return PORTAL_ACCESS.ALLOWED;
    if (identity.role === ACCOUNT_ROLES.OWNER || identity.status === ACCOUNT_STATUSES.APPROVED) {
      return PORTAL_ACCESS.WRONG_PORTAL_ADMIN;
    }
    if (identity.role === ACCOUNT_ROLES.ADMIN && identity.status === ACCOUNT_STATUSES.PENDING) {
      return PORTAL_ACCESS.ADMIN_PENDING_CLIENT_CHOICE;
    }
    if (identity.role === ACCOUNT_ROLES.ADMIN && identity.status === ACCOUNT_STATUSES.REJECTED) {
      return PORTAL_ACCESS.ADMIN_INACTIVE_CLIENT_CHOICE;
    }
  }

  return PORTAL_ACCESS.INVALID_ACCOUNT;
}

export function canConvertAdminRequestToClient(identity) {
  return identity?.role === ACCOUNT_ROLES.ADMIN &&
    [ACCOUNT_STATUSES.PENDING, ACCOUNT_STATUSES.REJECTED].includes(identity.status);
}
