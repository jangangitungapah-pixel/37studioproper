import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  buildLegacyAdminGuardAuditReport,
  isLegacyAdminGuardAccount,
} from './guard-legacy-isguard-audit-core.mjs';

const sampleUsers = [
  {
    uid: 'legacy-admin-1',
    email: 'legacy@example.test',
    displayName: 'Legacy Admin Guard',
    role: 'admin',
    status: 'approved',
    isGuard: true,
    guardId: 'guard-1',
    permissions: {
      dashboard: true,
    },
  },
  {
    uid: 'canonical-guard',
    role: 'studio_guard',
    status: 'approved',
    guardId: 'guard-1',
  },
];

const people = [
  {
    active: true,
    id: 'guard-1',
    name: 'Guard One',
    role: 'guard',
  },
];

assert.equal(isLegacyAdminGuardAccount(sampleUsers[0]), true);
assert.equal(isLegacyAdminGuardAccount(sampleUsers[1]), false);

const auditReport = buildLegacyAdminGuardAuditReport({
  people,
  users: sampleUsers,
});

assert.equal(auditReport.mode, 'READ_ONLY');
assert.equal(auditReport.summary.legacyAdminGuardCount, 1);
assert.equal(auditReport.accounts[0].migrationDecision.reviewRequired, true);
assert.equal(auditReport.accounts[0].migrationDecision.reviewedTarget, null);

const accountRolesSource = readFileSync(
  resolve('src/utils/accountRoles.js'),
  'utf8',
);

for (const forbidden of [
  'LEGACY_GUARD_OPERATIONAL',
  'isLegacyGuardOperationalAccount',
  'identity?.isGuard === true',
]) {
  assert.equal(
    accountRolesSource.includes(forbidden),
    false,
    'GP6-B canonical resolver must retire legacy mixed-role marker: ' + forbidden,
  );
}

const guardSource = readFileSync(
  resolve('src/pages/guard/GuardAttendancePage.jsx'),
  'utf8',
);

assert.equal(
  guardSource.includes('GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL'),
  false,
  'Guard Portal must accept canonical studio_guard only after GP6.',
);

const topbarSource = readFileSync(
  resolve('src/components/admin/AdminTopbar.jsx'),
  'utf8',
);

assert.equal(
  topbarSource.includes('user.isGuard'),
  false,
  'AdminTopbar must not expose legacy mixed Admin+Guard shortcut.',
);

assert.match(
  topbarSource,
  /user\?\.role\s*===\s*['"]owner['"]/,
  'Owner Guard Portal shortcut must remain intact.',
);

const settingsSource = readFileSync(
  resolve('src/pages/admin/SettingsPage.jsx'),
  'utf8',
);

assert.equal(
  settingsSource.includes('user.isGuard'),
  false,
  'Settings must not present mixed Admin+Guard as an active account model.',
);

const authSource = readFileSync(
  resolve('src/services/adminAuthRepository.js'),
  'utf8',
);

assert.equal(
  authSource.includes('?.isGuard'),
  false,
  'Shared runtime identity must no longer project deprecated isGuard.',
);

const rulesSource = readFileSync(
  resolve('firestore.rules'),
  'utf8',
);

const studioGuardBlock = rulesSource.slice(
  rulesSource.indexOf('function isStudioGuardAccount()'),
  rulesSource.indexOf('function hasCanonicalGuardId(data)'),
);

assert.equal(
  studioGuardBlock.includes("role == 'admin'"),
  false,
  'Firestore Guard actor must no longer accept Admin role.',
);

assert.equal(
  studioGuardBlock.includes('isGuard'),
  false,
  'Firestore Guard actor must no longer depend on legacy isGuard.',
);

assert.equal(
  rulesSource.includes(
    "(!data.keys().hasAny(['isGuard']) || data.isGuard == null || data.isGuard == false)"
  ),
  true,
  'Firestore may retain false/null legacy residue but must reject isGuard=true writes.',
);

const permissionsSource = readFileSync(
  resolve('src/utils/adminPermissions.js'),
  'utf8',
);

assert.equal(
  (
    permissionsSource.match(
      /isGuard:\s*\n?\s*false/g
    ) || []
  ).length >= 2,
  true,
  'Canonical role transitions must continue retiring any stale isGuard value.',
);

const auditSource = readFileSync(
  resolve('scripts/audit-legacy-admin-guard.mjs'),
  'utf8',
);

for (const required of [
  'Mode: READ_ONLY',
  'NO MUTATION PERFORMED.',
  'Canonical studio_guard:',
  'Legacy admin+isGuard:',
]) {
  assert.equal(
    auditSource.includes(required),
    true,
    'Historical GP6 audit tooling must remain available: ' + required,
  );
}

console.log(
  'guard-legacy-isguard-migration-contract-test: PASS (GP6-B retirement complete)',
);
