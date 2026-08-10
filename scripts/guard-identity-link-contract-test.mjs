import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  GUARD_IDENTITY_LINK_STATES,
  assertValidGuardIdentityLink,
  resolveGuardIdentityLink,
} from '../src/utils/guardIdentity.js';

const people = [
  {
    active: true,
    id: 'guard-active',
    name: 'Guard Active',
    role: 'guard',
  },
  {
    active: true,
    id: 'guard-both',
    name: 'Guard Both',
    role: 'both',
  },
  {
    active: false,
    id: 'guard-inactive',
    name: 'Guard Inactive',
    role: 'guard',
  },
  {
    active: true,
    id: 'operator-only',
    name: 'Operator Only',
    role: 'recording_operator',
  },
];

assert.equal(
  resolveGuardIdentityLink(people, '').state,
  GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID,
);

assert.equal(
  resolveGuardIdentityLink(people, 'deleted-guard').state,
  GUARD_IDENTITY_LINK_STATES.PERSON_NOT_FOUND,
);

assert.equal(
  resolveGuardIdentityLink(people, 'guard-inactive').state,
  GUARD_IDENTITY_LINK_STATES.PERSON_INACTIVE,
);

assert.equal(
  resolveGuardIdentityLink(people, 'operator-only').state,
  GUARD_IDENTITY_LINK_STATES.INVALID_PERSON_ROLE,
);

for (const guardId of [
  'guard-active',
  'guard-both',
]) {
  const link =
    resolveGuardIdentityLink(
      people,
      guardId,
    );

  assert.equal(link.isValid, true);
  assert.equal(link.guardId, guardId);
  assert.equal(
    assertValidGuardIdentityLink(
      people,
      guardId,
    ).person.id,
    guardId,
  );
}

const guardPageSource =
  readFileSync(
    resolve('src/pages/guard/GuardAttendancePage.jsx'),
    'utf8',
  );

for (const required of [
  'resolveGuardIdentityLink',
  'isGuardIdentityRepairRequired',
  'canStartGuardShift',
  'Guard Identity Repair Required',
  'Identitas Guard perlu diperbaiki',
  'Hubungi Owner',
  'settings.people',
  'guardIdentityLink.person',
]) {
  assert.equal(
    guardPageSource.includes(required),
    true,
    'Guard Portal identity integrity marker missing: ' + required,
  );
}

assert.equal(
  /guardAccount\?\.guardId\s*\|\|\s*authUser\?\.uid/.test(
    guardPageSource
  ),
  false,
  'Guard Portal must not fall back from guardId to Firebase UID for new attendance identity.',
);

const attendanceSource =
  readFileSync(
    resolve('src/services/guardAttendanceRepository.js'),
    'utf8',
  );

for (const required of [
  'assertValidGuardIdentityLink',
  'const accountGuardId =',
  'accountGuardId !==',
  'guardPersonId',
  'user?.guardId',
]) {
  assert.equal(
    attendanceSource.includes(required),
    true,
    'Attendance write-layer Guard identity marker missing: ' + required,
  );
}

assert.equal(
  /guardPerson\.id\s*\|\|\s*user\.uid/.test(
    attendanceSource
  ),
  false,
  'New check-in repository must never synthesize guardPersonId from Firebase UID.',
);

const settingsSource =
  readFileSync(
    resolve('src/pages/admin/SettingsPage.jsx'),
    'utf8',
  );

for (const required of [
  'Belum terhubung',
  'Crew tidak ditemukan',
  'Nonaktif',
  'openGuardIdentityLinker',
  'Perbaiki identitas Guard',
  'Hubungkan ulang identitas Guard',
  'Simpan Link Guard',
  'Akun Guard tidak bisa diaktifkan sebelum identity link diperbaiki.',
  'guardPeople: operatorFeeSettings?.people || []',
]) {
  assert.equal(
    settingsSource.includes(required),
    true,
    'Owner Guard identity repair UI marker missing: ' + required,
  );
}

const provisioningSource =
  readFileSync(
    resolve('src/services/ownerAccountProvisioningRepository.js'),
    'utf8',
  );

for (const required of [
  'assertValidGuardIdentityLink',
  'guardPeople = []',
  'guardPeople,\n      password',
  'guardPeople,\n        },',
]) {
  assert.equal(
    provisioningSource.includes(required),
    true,
    'Owner provisioning Guard identity validation marker missing: ' + required,
  );
}

const rulesSource =
  readFileSync(
    resolve('firestore.rules'),
    'utf8',
  );

for (const required of [
  'function hasCanonicalGuardId(data)',
  'hasCanonicalGuardId(getUserData()) &&',
  'data.guardPersonId == getCurrentGuardPersonId()',
  'resource.data.guardUid == request.auth.uid',
  'request.resource.data.guardUid == resource.data.guardUid',
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Firestore Guard identity integrity marker missing: ' + required,
  );
}

const currentGuardPersonBlock =
  rulesSource.slice(
    rulesSource.indexOf(
      'function getCurrentGuardPersonId()'
    ),
    rulesSource.indexOf(
      'function guardMealStartsUnposted'
    ),
  );

assert.equal(
  currentGuardPersonBlock.includes(
    'request.auth.uid'
  ),
  false,
  'Firestore must not fall back to auth UID when selecting guardPersonId for new attendance.',
);

assert.equal(
  rulesSource.includes(
    "(data.role == 'studio_guard' && data.status == 'approved' && hasOnlyGuardPortalPermissions(data.permissions) && hasCanonicalGuardId(data))"
  ),
  true,
  'New/updated canonical studio_guard documents must carry guardId.',
);

const studioGuardAccountBlock =
  rulesSource.slice(
    rulesSource.indexOf(
      'function isStudioGuardAccount()'
    ),
    rulesSource.indexOf(
      'function hasCanonicalGuardId(data)'
    ),
  );

assert.equal(
  studioGuardAccountBlock.includes(
    'hasCanonicalGuardId'
  ),
  false,
  'Historical Guard read/checkout compatibility must stay role+status based; guardId is enforced only for new identity-bound writes.',
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
    'node scripts/guard-identity-link-contract-test.mjs'
  ),
  true,
  'GP5 Guard identity link contract must be registered in npm test.',
);

process.stdout.write(
  '✅ GP5 Guard Identity Link contract passed.\n',
);
