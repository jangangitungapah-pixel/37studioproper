import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

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

const authSource =
  read(
    'src/services/adminAuthRepository.js'
  );

const accountRolesSource =
  read(
    'src/utils/accountRoles.js'
  );

const attendanceSource =
  read(
    'src/services/guardAttendanceRepository.js'
  );

const packageJson =
  JSON.parse(
    read(
      'package.json'
    )
  );

/*
 * Guard page may no longer own a second Firebase
 * authentication / user-identity stack.
 */
for (
  const forbidden
  of [
    "from 'firebase/auth'",
    "from 'firebase/firestore'",
    'onAuthStateChanged',
    'signInWithEmailAndPassword',
    'GoogleAuthProvider',
    'signInWithPopup',
    'getDoc',
    'readGuardAccount',
    'STUDIO_GUARD_ROLE',
  ]
) {
  assert.equal(
    guardSource.includes(
      forbidden
    ),

    false,

    'Guard page must not own duplicate auth/identity logic after GP-2: ' +
      forbidden
  );
}

/*
 * Shared auth repository + canonical Guard portal resolver.
 */
for (
  const required
  of [
    "from '../../services/adminAuthRepository.js'",
    "from '../../utils/accountRoles.js'",
    'adminAuthRepository.subscribeAdminAuth',
    'adminAuthRepository.signInAdmin',
    'adminAuthRepository.signInWithGoogle',
    'adminAuthRepository.signOutAdmin',
    'adminAuthRepository.getAdminAuthErrorMessage',
    'resolveGuardPortalAccess(guardAccount)',
    'GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL',
    'GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL',
    'Memeriksa akses portal...',
  ]
) {
  assert.equal(
    guardSource.includes(
      required
    ),

    true,

    'GP-2 shared auth marker missing: ' +
      required
  );
}

/*
 * Realtime shared auth state must drive both
 * Firebase user identity and account role identity.
 */
assert.match(
  guardSource,

  /adminAuthRepository\.subscribeAdminAuth\([\s\S]*?setAuthUser\(nextUser\)[\s\S]*?setGuardAccount\(nextUser\)/,

  'Shared auth subscription must drive both Firebase identity and Guard account state.'
);

/*
 * If Owner changes role/status/guardId and operational
 * access disappears, old Guard attendance data must
 * immediately be removed from local component state.
 */
assert.match(
  guardSource,

  /if \(!authUser\?\.uid \|\| !canUseGuardPage\) \{[\s\S]*?setSessions\(\[\]\)/,

  'Losing operational Guard access must clear locally held attendance sessions.'
);

/*
 * Attendance subscription stays UID scoped.
 */
assert.match(
  guardSource,

  /subscribeGuardAttendanceSessions\([\s\S]*?guardUid: authUser\.uid/,

  'Operational attendance subscription must remain scoped to authenticated UID.'
);

/*
 * Owner role-aware locked UI is intentionally a GP-3/GP-7 concern.
 */
assert.equal(
  guardSource.includes(
    'Akun ini belum punya role Penjaga Studio approved.'
  ),

  true,

  'Owner/Admin role-aware locked UI remains reserved for GP-3/GP-7.'
);

/*
 * Shared auth service must remain realtime.
 */
for (
  const required
  of [
    'onAuthStateChanged',
    'onSnapshot',
    'guardId: userData?.guardId || null',
    'isGuard: userData?.isGuard || false',
    'role: userData?.role',
    'status: userData?.status',
  ]
) {
  assert.equal(
    authSource.includes(
      required
    ),

    true,

    'Shared auth repository realtime identity marker missing: ' +
      required
  );
}

/*
 * Canonical Guard resolver from GP-1 remains authoritative.
 */
for (
  const required
  of [
    'resolveGuardPortalAccess',
    'OWNER_OVERSIGHT',
    'GUARD_OPERATIONAL',
    'IDENTITY_REPAIR_REQUIRED',
    'LEGACY_GUARD_OPERATIONAL',
  ]
) {
  assert.equal(
    accountRolesSource.includes(
      required
    ),

    true,

    'Canonical Guard access resolver marker missing: ' +
      required
  );
}

/*
 * Attendance ownership semantics must not change.
 */
for (
  const required
  of [
    'createGuardAttendanceCheckIn',
    'closeGuardAttendanceSession',
    'guardUid:',
    'user.uid',
  ]
) {
  assert.equal(
    attendanceSource.includes(
      required
    ),

    true,

    'Attendance ownership invariant missing after GP-2: ' +
      required
  );
}

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-identity-realtime-contract-test.mjs'
  ),

  true,

  'GP-2 realtime identity contract must be registered in npm test.'
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/account-password-security-contract-test.mjs'
  ),

  true,

  'Shared auth password-security contract must remain registered.'
);

console.log(
  'guard-identity-realtime-contract-test: PASS'
);
