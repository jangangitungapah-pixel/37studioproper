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
    'utf8',
  );
}

const guardSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx',
  );

const loginSource =
  read(
    'src/pages/LoginPage.jsx',
  );

const rulesSource =
  read(
    'firestore.rules',
  );

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

const matrix = [
  [
    {
      role: ACCOUNT_ROLES.OWNER,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT,
  ],
  [
    {
      role: ACCOUNT_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.REDIRECT_ADMIN,
  ],
  [
    {
      guardId: 'guard-1',
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
  ],
  [
    {
      role: ACCOUNT_ROLES.CLIENT,
      status: ACCOUNT_STATUSES.ACTIVE,
    },
    GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT,
  ],
  [
    {
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.PENDING,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
  ],
  [
    {
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.REJECTED,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
  ],
  [
    {
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED,
  ],
  [
    {
      role: 'unknown-role',
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.INVALID_ACCOUNT,
  ],
];

for (const [identity, expected] of matrix) {
  assert.equal(
    resolveGuardPortalAccess(
      identity,
    ),
    expected,
    'GP7 Guard access matrix mismatch for role=' +
      identity.role +
      ' status=' +
      identity.status,
  );
}

assert.equal(
  guardSource.includes(
    'Akun ini belum punya role Penjaga Studio approved.'
  ),
  false,
  'Generic Guard wrong-role lock copy must be retired in GP7.',
);

for (const required of [
  'aria-label="Wrong Portal Client"',
  'Akun Client tidak menggunakan Guard Portal',
  'to="/client/portal"',
  'aria-label="Guard Access Blocked"',
  'Akses Guard belum aktif',
  'Akses Admin belum aktif',
  'aria-label="Guard Account Recovery Required"',
  'Data akun belum dapat digunakan',
  'aria-label="Guard Identity Repair Required"',
  'aria-label="Owner Oversight Mode"',
  'aria-label="Admin Cross Portal"',
]) {
  assert.equal(
    guardSource.includes(
      required,
    ),
    true,
    'GP7 Guard access-state UI marker missing: ' +
      required,
  );
}

for (const forbidden of [
  'async function handleSignIn',
  'async function handleGoogleSignIn',
  'setEmail(',
  'setPassword(',
  'showPassword',
]) {
  assert.equal(
    guardSource.includes(
      forbidden,
    ),
    false,
    'Guard page must not own duplicate shared-login behavior after GP7: ' +
      forbidden,
  );
}

for (const required of [
  '/login?portal=guard&redirectTo=%2Fguard%2Fattendance',
  'Email/password, Google, dan OTP nomor HP',
]) {
  assert.equal(
    guardSource.includes(
      required,
    ),
    true,
    'Shared Guard login entry marker missing: ' +
      required,
  );
}

for (const required of [
  "searchParams.get('portal') === 'guard'",
  "startsWith('/guard')",
  'const guardRedirectTarget =',
  'if (guardIntent) {',
  'adminAuthRepository.sendPhoneOTP',
  'if (!guardIntent) {',
  "? 'Guard Portal'",
  "? 'Masuk Guard Portal'",
  '!guardIntent && authMode',
]) {
  assert.equal(
    loginSource.includes(
      required,
    ),
    true,
    'Shared LoginPage Guard-intent marker missing: ' +
      required,
  );
}

assert.equal(
  loginSource.includes(
    "role = 'studio_guard'"
  ),
  false,
  'Guard login must never mutate or self-create studio_guard role.',
);

assert.equal(
  rulesSource.includes(
    "getUserData().isGuard == true"
  ),
  false,
  'GP7 must not restore legacy mixed Admin+Guard Firestore authorization.',
);

assert.match(
  rulesSource,
  /function guardCreatesOwnAttendance\(data, attendanceId\) \{\s*return isStudioGuardAccount\(\)/,
  'Guard attendance create must remain canonical Guard self-only.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/guard-wrong-portal-auth-ux-contract-test.mjs'
  ),
  true,
  'GP7 wrong-portal/auth UX contract must be registered in npm test.',
);

console.log(
  'guard-wrong-portal-auth-ux-contract-test: PASS',
);
