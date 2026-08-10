import { adminPermissionPages } from './adminPermissions.js';

export const ACCOUNT_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  CLIENT: 'client',
  STUDIO_GUARD: 'studio_guard',
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

export const GUARD_PORTAL_ACCESS = Object.freeze({
  GUARD_OPERATIONAL: 'guard_operational',
  OWNER_OVERSIGHT: 'owner_oversight',
  REDIRECT_ADMIN: 'redirect_admin',
  WRONG_PORTAL_CLIENT: PORTAL_ACCESS.WRONG_PORTAL_CLIENT,
  BLOCKED: 'guard_blocked',
  IDENTITY_REPAIR_REQUIRED: 'guard_identity_repair_required',
  INVALID_ACCOUNT: PORTAL_ACCESS.INVALID_ACCOUNT,
  MISSING_ACCOUNT: PORTAL_ACCESS.MISSING_ACCOUNT,
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

export function isAdminPortalAccount(identity) {
  return isAdminAccount(identity) || identity?.role === ACCOUNT_ROLES.STUDIO_GUARD;
}

export function isClientAccount(identity) {
  return identity?.role === ACCOUNT_ROLES.CLIENT && identity?.status === ACCOUNT_STATUSES.ACTIVE;
}

function hasGuardIdentity(identity) {
  return Boolean(String(identity?.guardId || '').trim());
}

export function isGuardOperationalAccount(identity) {
  return Boolean(
    identity?.role === ACCOUNT_ROLES.STUDIO_GUARD &&
    identity?.status === ACCOUNT_STATUSES.APPROVED &&
    hasGuardIdentity(identity)
  );
}

export function isOwnerOversightAccount(identity) {
  return Boolean(
    identity?.role === ACCOUNT_ROLES.OWNER &&
    identity?.status === ACCOUNT_STATUSES.APPROVED
  );
}

export function resolveGuardPortalAccess(identity) {
  if (!identity) return GUARD_PORTAL_ACCESS.MISSING_ACCOUNT;

  if (isOwnerOversightAccount(identity)) {
    return GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT;
  }

  if (identity.role === ACCOUNT_ROLES.STUDIO_GUARD) {
    if (identity.status !== ACCOUNT_STATUSES.APPROVED) {
      return GUARD_PORTAL_ACCESS.BLOCKED;
    }

    if (!hasGuardIdentity(identity)) {
      return GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED;
    }

    return GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL;
  }

  if (identity.role === ACCOUNT_ROLES.ADMIN) {
    if (identity.status !== ACCOUNT_STATUSES.APPROVED) {
      return GUARD_PORTAL_ACCESS.BLOCKED;
    }

    return GUARD_PORTAL_ACCESS.REDIRECT_ADMIN;
  }

  if (identity.role === ACCOUNT_ROLES.CLIENT) {
    return GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT;
  }

  if (identity.role === ACCOUNT_ROLES.OWNER) {
    return GUARD_PORTAL_ACCESS.BLOCKED;
  }

  return GUARD_PORTAL_ACCESS.INVALID_ACCOUNT;
}

export function getAccountIdentityIntentForPortal(portal) {
  if (portal === 'client') return 'client';
  if (portal === 'admin' || portal === 'guard') return 'admin';
  return '';
}

export function getPortalAccess(identity, portal) {
  if (!identity) return PORTAL_ACCESS.MISSING_ACCOUNT;

  if (portal === 'admin') {
    if (isClientAccount(identity)) return PORTAL_ACCESS.WRONG_PORTAL_CLIENT;
    if (!isAdminPortalAccount(identity)) return PORTAL_ACCESS.INVALID_ACCOUNT;
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

  if (portal === 'guard') {
    return resolveGuardPortalAccess(identity);
  }

  return PORTAL_ACCESS.INVALID_ACCOUNT;
}

export function canConvertAdminRequestToClient(identity) {
  return identity?.role === ACCOUNT_ROLES.ADMIN &&
    [ACCOUNT_STATUSES.PENDING, ACCOUNT_STATUSES.REJECTED].includes(identity.status);
}
