import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  GUARD_PORTAL_ACCESS,
  resolveGuardPortalAccess,
} from '../src/utils/accountRoles.js';

function read(path) {
  return readFileSync(
    resolve(path),
    'utf8'
  );
}

const guardSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx'
  );

const rulesSource =
  read(
    'firestore.rules'
  );

const packageJson =
  JSON.parse(
    read(
      'package.json'
    )
  );

/*
 * Canonical resolver: approved Owner is oversight, never operational Guard.
 */
const ownerAccess =
  resolveGuardPortalAccess({
    email:
      'owner@example.test',

    role:
      ACCOUNT_ROLES.OWNER,

    status:
      ACCOUNT_STATUSES.APPROVED,

    uid:
      'owner-uid',
  });

assert.equal(
  ownerAccess,
  GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT,
  'Approved Owner must resolve to OWNER_OVERSIGHT.'
);

assert.notEqual(
  ownerAccess,
  GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
  'Owner must never resolve to GUARD_OPERATIONAL by default.'
);

/*
 * Owner UI must be intentional and role-aware.
 */
for (
  const required
  of [
    'const isOwnerOversight = Boolean(',
    'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
    'aria-label="Owner Oversight Mode"',
    'Owner Mode',
    'Read-only Oversight',
    'Anda sedang melihat Guard Portal sebagai Owner',
    'Mode Owner tidak membuat attendance. Gunakan akun Guard',
    'Owner · {guardAccount?.email || authUser?.email ||',
    'Tidak ada Guard identity yang dipakai pada mode ini.',
    'Kembali ke Admin',
    'href="/admin"',
    'Buka Attendance Review',
    'href="/admin/operations/guard-attendance"',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,

    'Owner Oversight UI marker missing: ' +
      required
  );
}

/*
 * Generic blocked state must explicitly exclude Owner Oversight.
 */
assert.match(
  guardSource,

  /authUser &&[\s\S]*?!canUseGuardPage &&[\s\S]*?!isOwnerOversight/,

  'Owner Oversight must not fall through to generic Guard blocked state.'
);

/*
 * Operational Guard workspace remains separate.
 */
assert.match(
  guardSource,

  /\{canUseGuardPage \? \([\s\S]*?aria-label="Panel absen penjaga"/,

  'Clock In/Out workspace must remain gated by operational Guard access.'
);

/*
 * Owner and other non-operational actors must never inherit a Guard identity.
 * GP-5 still owns removal of the UID fallback for operational Guard accounts.
 */
assert.match(
  guardSource,

  /const assignedGuardPersonId =[\s\S]*?canUseGuardPage[\s\S]*?guardAccount\?\.guardId \|\|[\s\S]*?authUser\?\.uid/,

  'Guard identity fallback must only exist inside operational Guard access.'
);

/*
 * Defense-in-depth: even if a stale UI event fires, mutation handlers fail closed.
 */
assert.match(
  guardSource,

  /async function handleCheckIn\(\) \{[\s\S]*?if \(!canUseGuardPage\)/,

  'Check-in handler must reject non-operational actors.'
);

assert.match(
  guardSource,

  /async function handleCheckOut\(\) \{[\s\S]*?if \(!canUseGuardPage\)/,

  'Check-out handler must reject non-operational actors.'
);

assert.equal(
  guardSource.includes(
    '{showCheckOutConfirm && canUseGuardPage ? ('
  ),

  true,

  'Checkout modal must disappear when realtime access stops being operational.'
);

/*
 * GP-3 must not create Owner attendance permission.
 * Firestore create remains Guard self-only.
 */
assert.match(
  rulesSource,

  /function guardCreatesOwnAttendance\(data, attendanceId\) \{\s*return isStudioGuardAccount\(\)/,

  'Attendance create must remain restricted to Studio Guard account semantics.'
);

assert.match(
  rulesSource,

  /allow create: if validGuardAttendanceSession\(request\.resource\.data, attendanceId\) &&\s*guardCreatesOwnAttendance/,

  'Owner Oversight must not introduce a new attendance create rule.'
);

/*
 * Owner already has review authority. GP-3 reuses existing Admin review route.
 */
assert.match(
  rulesSource,

  /function canManageGuardAttendance\(\) \{\s*return isOwner\(\) \|\|/,

  'Existing Owner attendance review authority must remain.'
);

/*
 * No GP-4 behavior should be pulled into GP-3.
 */
assert.equal(
  guardSource.includes(
    'Keluar Akun'
  ),

  false,

  'Logout wording belongs to GP-4, not GP-3.'
);

/*
 * Contract registration.
 */
assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-owner-oversight-contract-test.mjs'
  ),

  true,

  'GP-3 Owner Oversight contract must be registered in npm test.'
);

console.log(
  'guard-owner-oversight-contract-test: PASS'
);
