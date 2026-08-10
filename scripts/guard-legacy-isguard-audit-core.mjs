import {
  resolveGuardIdentityLink,
} from '../src/utils/guardIdentity.js';

export const LEGACY_GUARD_AUDIT_VERSION = 'gp6-a-v1';

export function isLegacyAdminGuardAccount(user) {
  return Boolean(
    user &&
    user.role === 'admin' &&
    user.isGuard === true
  );
}

export function getEnabledAdminPermissionKeys(permissions) {
  if (!permissions || typeof permissions !== 'object') {
    return [];
  }

  return Object.entries(permissions)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => key)
    .sort();
}

function toIsoText(value) {
  return String(value || '').trim();
}

function getAttendanceTimestamp(session) {
  return (
    toIsoText(session?.clockInAt) ||
    toIsoText(session?.createdAt) ||
    (
      toIsoText(session?.date)
        ? toIsoText(session.date) + 'T00:00:00.000Z'
        : ''
    )
  );
}

export function buildLegacyAdminGuardAuditEntry({
  attendance = [],
  people = [],
  user,
} = {}) {
  if (!isLegacyAdminGuardAccount(user)) {
    return null;
  }

  const guardLink =
    resolveGuardIdentityLink(
      people,
      user.guardId,
    );

  const attendanceRows =
    (Array.isArray(attendance) ? attendance : [])
      .map((session) => ({
        date: toIsoText(session?.date),
        id: toIsoText(session?.id),
        timestamp: getAttendanceTimestamp(session),
      }))
      .sort((left, right) =>
        right.timestamp.localeCompare(left.timestamp)
      );

  const activeAdminPermissionKeys =
    getEnabledAdminPermissionKeys(
      user.permissions,
    );

  return {
    uid: toIsoText(user.uid || user.id),
    displayName: toIsoText(user.displayName),
    email: toIsoText(user.email),
    status: toIsoText(user.status),
    legacyIsGuard: true,
    guardId: toIsoText(user.guardId),
    guardIdentity: {
      isValid: guardLink.isValid,
      personId: toIsoText(guardLink.person?.id),
      personName: toIsoText(guardLink.person?.name),
      state: guardLink.state,
    },
    adminPermissionEvidence: {
      enabledCount: activeAdminPermissionKeys.length,
      enabledKeys: activeAdminPermissionKeys,
    },
    guardAttendanceEvidence: {
      count: attendanceRows.length,
      lastAttendanceDate: attendanceRows[0]?.date || '',
      lastAttendanceId: attendanceRows[0]?.id || '',
      lastAttendanceTimestamp: attendanceRows[0]?.timestamp || '',
    },
    migrationDecision: {
      reviewedTarget: null,
      reviewRequired: true,
      targets: {
        admin: {
          eligible: true,
          note: 'Retain Admin role and retire legacy Guard compatibility.',
        },
        studio_guard: {
          eligible: guardLink.isValid,
          blocker: guardLink.isValid
            ? ''
            : 'Repair/relink to an active Guard/Both crew before conversion.',
          note: 'Convert only after explicit review; canonical Guard requires valid guardId.',
        },
      },
    },
  };
}

export function buildLegacyAdminGuardAuditReport({
  attendanceByUid = {},
  people = [],
  users = [],
} = {}) {
  const allUsers =
    Array.isArray(users)
      ? users
      : [];

  const legacyEntries =
    allUsers
      .filter(isLegacyAdminGuardAccount)
      .map((user) =>
        buildLegacyAdminGuardAuditEntry({
          attendance:
            attendanceByUid[
              String(user.uid || user.id || '')
            ] || [],
          people,
          user,
        })
      )
      .filter(Boolean)
      .sort((left, right) =>
        left.email.localeCompare(right.email)
      );

  return {
    auditVersion: LEGACY_GUARD_AUDIT_VERSION,
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsersScanned: allUsers.length,
      legacyAdminGuardCount: legacyEntries.length,
      activeLegacyAdminGuardCount:
        legacyEntries.filter(
          (entry) => entry.status === 'approved'
        ).length,
      withGuardAttendanceEvidence:
        legacyEntries.filter(
          (entry) =>
            entry.guardAttendanceEvidence.count > 0
        ).length,
      withValidGuardIdentity:
        legacyEntries.filter(
          (entry) =>
            entry.guardIdentity.isValid
        ).length,
      requiringGuardIdentityRepair:
        legacyEntries.filter(
          (entry) =>
            !entry.guardIdentity.isValid
        ).length,
    },
    accounts: legacyEntries,
  };
}
