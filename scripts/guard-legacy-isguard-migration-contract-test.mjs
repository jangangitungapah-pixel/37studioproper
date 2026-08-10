import assert from 'node:assert/strict';

import {
  readdirSync,
  readFileSync,
  statSync,
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
      settings: true,
    },
  },
  {
    uid: 'canonical-admin',
    email: 'admin@example.test',
    role: 'admin',
    status: 'approved',
    isGuard: false,
  },
  {
    uid: 'canonical-guard',
    email: 'guard@example.test',
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

assert.equal(
  isLegacyAdminGuardAccount(
    sampleUsers[0],
  ),
  true,
);

assert.equal(
  isLegacyAdminGuardAccount(
    sampleUsers[1],
  ),
  false,
);

assert.equal(
  isLegacyAdminGuardAccount(
    sampleUsers[2],
  ),
  false,
);

const report =
  buildLegacyAdminGuardAuditReport({
    attendanceByUid: {
      'legacy-admin-1': [
        {
          id: 'att__legacy-admin-1__2026-08-10',
          date: '2026-08-10',
          clockInAt: '2026-08-10T08:00:00.000Z',
        },
      ],
    },
    people,
    users: sampleUsers,
  });

assert.equal(report.mode, 'READ_ONLY');
assert.equal(report.summary.totalUsersScanned, 3);
assert.equal(report.summary.canonicalStudioGuardCount, 1);
assert.equal(report.summary.approvedCanonicalStudioGuardCount, 1);
assert.equal(report.summary.legacyAdminGuardCount, 1);
assert.equal(report.summary.activeLegacyAdminGuardCount, 1);
assert.equal(report.summary.withGuardAttendanceEvidence, 1);
assert.equal(report.summary.withValidGuardIdentity, 1);
assert.equal(report.accounts[0].migrationDecision.reviewRequired, true);
assert.equal(report.accounts[0].migrationDecision.reviewedTarget, null);
assert.equal(
  report.accounts[0].migrationDecision.targets.studio_guard.eligible,
  true,
);

const auditSource =
  readFileSync(
    resolve(
      'scripts/audit-legacy-admin-guard.mjs',
    ),
    'utf8',
  );

for (const required of [
  "const AUDIT_OUTPUT_DIR =\n  '.guard-migration-audit';",
  "Mode: READ_ONLY",
  'NO MUTATION PERFORMED.',
  'loadAllUsers',
  'loadOperatorFeePeople',
  'loadAttendanceEvidenceByUid',
  'assertOwnerIdentity',
  'signInWithEmailAndPassword',
  'reviewedTarget tetap null',
  'input.pause();',
  'Canonical studio_guard:',
  'Approved canonical studio_guard:',
  'Akun role=studio_guard tetap terdeteksi sebagai Guard canonical',
]) {
  assert.equal(
    auditSource.includes(required),
    true,
    'GP6-A audit marker missing: ' + required,
  );
}

for (const forbidden of [
  'setDoc',
  'updateDoc',
  'deleteDoc',
  'addDoc',
  'writeBatch',
  'batch.set',
  'batch.update',
  'batch.delete',
  '.commit()',
]) {
  assert.equal(
    auditSource.includes(forbidden),
    false,
    'GP6-A live audit must be read-only; forbidden Firestore mutation marker: ' +
      forbidden,
  );
}

function collectSourceFiles(directoryPath) {
  const output = [];

  for (const name of readdirSync(directoryPath)) {
    const fullPath =
      resolve(
        directoryPath,
        name,
      );

    const stats =
      statSync(fullPath);

    if (stats.isDirectory()) {
      output.push(
        ...collectSourceFiles(
          fullPath,
        ),
      );

      continue;
    }

    if (
      /\.(?:js|jsx|mjs|cjs)$/.test(name)
    ) {
      output.push(fullPath);
    }
  }

  return output;
}

const runtimeFiles =
  collectSourceFiles(
    resolve('src'),
  );

const forbiddenTrueWritePatterns = [
  /\bisGuard\s*:\s*true\b/,
  /\bisGuard\s*=\s*true\b/,
];

for (const filePath of runtimeFiles) {
  const source =
    readFileSync(
      filePath,
      'utf8',
    );

  for (const pattern of forbiddenTrueWritePatterns) {
    assert.equal(
      pattern.test(source),
      false,
      'Canonical runtime source must not create new isGuard=true state: ' +
        filePath +
        ' via ' +
        pattern,
    );
  }
}

const permissionsSource =
  readFileSync(
    resolve(
      'src/utils/adminPermissions.js',
    ),
    'utf8',
  );

assert.equal(
  (
    permissionsSource.match(
      /isGuard:\s*\n?\s*false/g
    ) || []
  ).length >= 2,
  true,
  'Canonical role transitions must retire isGuard by writing false.',
);

const accountRolesSource =
  readFileSync(
    resolve(
      'src/utils/accountRoles.js',
    ),
    'utf8',
  );

for (const required of [
  'LEGACY_GUARD_OPERATIONAL',
  'identity?.isGuard === true',
]) {
  assert.equal(
    accountRolesSource.includes(required),
    true,
    'GP6-A audit stage must preserve legacy runtime reads until the live report is reviewed: ' +
      required,
  );
}

const topbarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminTopbar.jsx',
    ),
    'utf8',
  );

assert.equal(
  topbarSource.includes(
    'user.isGuard ===\n            true'
  ),
  true,
  'GP6-A must not remove legacy Admin Guard shortcut before migration review.',
);

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

for (const required of [
  "getUserData().role == 'admin'",
  "getUserData().isGuard == true",
  "data.isGuard == null || data.isGuard is bool",
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'GP6-A must preserve legacy Firestore compatibility until migration is reviewed: ' +
      required,
  );
}

const gitignoreSource =
  readFileSync(
    resolve('.gitignore'),
    'utf8',
  );

assert.equal(
  gitignoreSource.includes(
    '.guard-migration-audit/'
  ),
  true,
  'Live migration audit reports must never be committed by default.',
);

const packageJson =
  JSON.parse(
    readFileSync(
      resolve('package.json'),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-legacy-isguard-migration-contract-test.mjs'
  ),
  true,
  'GP6 migration contract must be registered in npm test.',
);

console.log(
  'guard-legacy-isguard-migration-contract-test: PASS (GP6-A audit-only)',
);
