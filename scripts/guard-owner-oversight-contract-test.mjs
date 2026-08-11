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
    'to={adminReturnPath}',
    'Buka Attendance Review',
    'to="/admin/operations/guard-attendance"',
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
 * Owner safety is provided by mutually exclusive GP7 access states.
 * The generic blocked branch no longer exists, so there is no
 * !isOwnerOversight escape condition to maintain.
 */
assert.equal(
  guardSource.includes(
    '!isOwnerOversight'
  ),
  false,
  'GP7 must not use the retired generic Owner exclusion guard.'
);

for (
  const required
  of [
    'const isOwnerOversight = Boolean(',
    'GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT',
    'const isWrongPortalClient = Boolean(',
    'GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT',
    'const isBlockedGuardAccess = Boolean(',
    'GUARD_PORTAL_ACCESS.BLOCKED',
    'const isInvalidGuardAccess = Boolean(',
    'GUARD_PORTAL_ACCESS.INVALID_ACCOUNT',
    'GUARD_PORTAL_ACCESS.MISSING_ACCOUNT',
    'aria-label="Owner Oversight Mode"',
    'aria-label="Wrong Portal Client"',
    'aria-label="Guard Access Blocked"',
    'aria-label="Guard Account Recovery Required"',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),
    true,
    'Owner/GP7 mutually exclusive access-state marker missing: ' +
      required
  );
}

/*
 * Guard-owned workspace remains separate from Owner Oversight.
 * GP-5 may keep this workspace mounted for Guard history / legacy checkout
 * while a broken identity link is being repaired, but Owner never enters it.
 */
assert.match(
  guardSource,

  /\{canUseGuardPage \? \([\s\S]*?aria-label="Panel absen penjaga"/,

  'Guard history / checkout workspace must remain inaccessible to Owner Oversight.'
);

/*
 * Owner and other non-operational actors must never inherit a Guard identity.
 * GP-5 removes the UID fallback entirely for new attendance identity:
 * assignedGuardPersonId is available only from a validated canonical guardId.
 */
assert.match(
  guardSource,

  /const assignedGuardPersonId =[\s\S]*?canStartGuardShift[\s\S]*?guardAccount\?\.guardId \|\|[\s\S]*?''/,

  'Canonical guardId must only become an attendance identity after canStartGuardShift.'
);

assert.equal(
  /guardAccount\?\.guardId\s*\|\|\s*authUser\?\.uid/.test(
    guardSource
  ),

  false,

  'Guard Portal must not fall back from guardId to Firebase UID.'
);

/*
 * Defense-in-depth after GP-5:
 * - new Clock In requires a fully valid canonical Guard identity;
 * - Clock Out stays UID-bound through canUseGuardPage so an already-open
 *   historical shift is not stranded while Owner repairs guardId.
 */
assert.match(
  guardSource,

  /async function handleCheckIn\(\) \{[\s\S]*?if \(!canStartGuardShift\)/,

  'Check-in handler must reject missing, deleted, inactive, or otherwise invalid Guard identity links.'
);

assert.match(
  guardSource,

  /async function handleCheckOut\(\) \{[\s\S]*?if \(!canUseGuardPage\)/,

  'Historical checkout must stay available only to the authenticated Guard account context.'
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
 * GP-4 clarifies portal switching versus global account logout.
 */
assert.equal(
  guardSource.includes(
    'Keluar Akun'
  ),

  true,

  'Guard logout must clearly mean global account logout after GP-4.'
);

assert.equal(
  guardSource.includes(
    'href="/admin"'
  ),

  false,

  'Owner return-to-admin must use SPA routing after GP-4.'
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
