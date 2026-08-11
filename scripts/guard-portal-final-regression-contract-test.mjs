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

import {
  GUARD_IDENTITY_LINK_STATES,
  resolveGuardIdentityLink,
} from '../src/utils/guardIdentity.js';

import {
  STUDIO_GUARD_ROLE,
  adminPermissionPages,
  buildPortalRoleTransitionPatch,
} from '../src/utils/adminPermissions.js';

function read(path) {
  return readFileSync(
    resolve(path),
    'utf8',
  );
}

const accountRolesSource =
  read(
    'src/utils/accountRoles.js',
  );

const guardSource =
  read(
    'src/pages/guard/GuardAttendancePage.jsx',
  );

const loginSource =
  read(
    'src/pages/LoginPage.jsx',
  );

const attendanceSource =
  read(
    'src/services/guardAttendanceRepository.js',
  );

const provisioningSource =
  read(
    'src/services/ownerAccountProvisioningRepository.js',
  );

const rulesSource =
  read(
    'firestore.rules',
  );

const releaseChecklistSource =
  read(
    'docs/guard-portal-remediation-release-checklist.md',
  );

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

/*
 * GP8-A — canonical role / Guard portal access matrix.
 */
const accessMatrix = [
  [
    null,
    GUARD_PORTAL_ACCESS.MISSING_ACCOUNT,
  ],
  [
    {
      role: ACCOUNT_ROLES.OWNER,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT,
  ],
  [
    {
      role: ACCOUNT_ROLES.OWNER,
      status: ACCOUNT_STATUSES.REJECTED,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
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
      role: ACCOUNT_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.PENDING,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
  ],
  [
    {
      role: ACCOUNT_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.REJECTED,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
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
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED,
  ],
  [
    {
      guardId: 'guard-1',
      role: ACCOUNT_ROLES.STUDIO_GUARD,
      status: ACCOUNT_STATUSES.REJECTED,
    },
    GUARD_PORTAL_ACCESS.BLOCKED,
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
      role: 'unknown-role',
      status: ACCOUNT_STATUSES.APPROVED,
    },
    GUARD_PORTAL_ACCESS.INVALID_ACCOUNT,
  ],
];

for (const [identity, expected] of accessMatrix) {
  assert.equal(
    resolveGuardPortalAccess(
      identity,
    ),
    expected,
    'GP8 access matrix mismatch for role=' +
      (identity?.role || 'missing') +
      ' status=' +
      (identity?.status || 'missing'),
  );
}

assert.equal(
  resolveGuardPortalAccess({
    guardId: 'legacy-guard',
    isGuard: true,
    role: ACCOUNT_ROLES.ADMIN,
    status: ACCOUNT_STATUSES.APPROVED,
  }),
  GUARD_PORTAL_ACCESS.REDIRECT_ADMIN,
  'Legacy-shaped Admin must remain Admin after GP6 retirement.',
);

assert.equal(
  Object.prototype.hasOwnProperty.call(
    GUARD_PORTAL_ACCESS,
    'LEGACY_GUARD_OPERATIONAL',
  ),
  false,
  'Legacy Guard operational state must remain retired.',
);

for (const forbidden of [
  'LEGACY_GUARD_OPERATIONAL',
  'isLegacyGuardOperationalAccount',
  'identity?.isGuard === true',
]) {
  assert.equal(
    accountRolesSource.includes(
      forbidden,
    ),
    false,
    'Legacy Guard resolver marker must remain absent: ' +
      forbidden,
  );
}

/*
 * GP8-B — canonical Guard identity integrity.
 */
const people = [
  {
    active: true,
    id: 'guard-1',
    name: 'Guard One',
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
    role: 'operator',
  },
];

assert.equal(
  resolveGuardIdentityLink(
    people,
    'guard-1',
  ).state,
  GUARD_IDENTITY_LINK_STATES.VALID,
);

assert.equal(
  resolveGuardIdentityLink(
    people,
    'guard-both',
  ).state,
  GUARD_IDENTITY_LINK_STATES.VALID,
);

assert.equal(
  resolveGuardIdentityLink(
    people,
    '',
  ).state,
  GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID,
);

assert.equal(
  resolveGuardIdentityLink(
    people,
    'deleted-person',
  ).state,
  GUARD_IDENTITY_LINK_STATES.PERSON_NOT_FOUND,
);

assert.equal(
  resolveGuardIdentityLink(
    people,
    'guard-inactive',
  ).state,
  GUARD_IDENTITY_LINK_STATES.PERSON_INACTIVE,
);

assert.equal(
  resolveGuardIdentityLink(
    people,
    'operator-only',
  ).state,
  GUARD_IDENTITY_LINK_STATES.INVALID_PERSON_ROLE,
);

const guardPatch =
  buildPortalRoleTransitionPatch(
    {
      role: 'admin',
    },
    STUDIO_GUARD_ROLE,
    {
      guardId: 'guard-1',
      guardPeople: people,
    },
  );

assert.equal(
  guardPatch.role,
  STUDIO_GUARD_ROLE,
);

assert.equal(
  guardPatch.status,
  ACCOUNT_STATUSES.APPROVED,
);

assert.equal(
  guardPatch.guardId,
  'guard-1',
);

assert.equal(
  guardPatch.isGuard,
  false,
);

for (const page of adminPermissionPages) {
  assert.equal(
    guardPatch.permissions[page.key],
    false,
    'Canonical studio_guard must not receive Admin permission: ' +
      page.key,
  );
}

const adminPatch =
  buildPortalRoleTransitionPatch(
    {
      guardId: 'guard-1',
      role: STUDIO_GUARD_ROLE,
    },
    ACCOUNT_ROLES.ADMIN,
    {
      guardPeople: people,
    },
  );

assert.equal(
  adminPatch.role,
  ACCOUNT_ROLES.ADMIN,
);

assert.equal(
  adminPatch.guardId,
  null,
);

assert.equal(
  adminPatch.isGuard,
  false,
);

assert.throws(
  () =>
    buildPortalRoleTransitionPatch(
      {},
      STUDIO_GUARD_ROLE,
      {
        guardId: 'guard-inactive',
        guardPeople: people,
      },
    ),
  /nonaktif|Guard/i,
  'Inactive crew must not become canonical studio_guard identity.',
);

/*
 * GP8-C — Guard portal UX and shared authentication boundary.
 */
for (const required of [
  'aria-label="Owner Oversight Mode"',
  'aria-label="Admin Cross Portal"',
  'aria-label="Wrong Portal Client"',
  'aria-label="Guard Access Blocked"',
  'aria-label="Guard Account Recovery Required"',
  'aria-label="Guard Identity Repair Required"',
  'const canUseGuardPage = Boolean(',
  'const canStartGuardShift = Boolean(',
  '/login?portal=guard&redirectTo=%2Fguard%2Fattendance',
  'adminAuthRepository.subscribeAdminAuth',
  'adminAuthRepository.signOutAdmin',
]) {
  assert.equal(
    guardSource.includes(
      required,
    ),
    true,
    'Final Guard UX/auth marker missing: ' +
      required,
  );
}

for (const forbidden of [
  'async function handleSignIn',
  'async function handleGoogleSignIn',
  'LEGACY_GUARD_OPERATIONAL',
  'guardAccount?.guardId || authUser?.uid',
]) {
  assert.equal(
    guardSource.includes(
      forbidden,
    ),
    false,
    'Retired Guard portal marker unexpectedly restored: ' +
      forbidden,
  );
}

assert.match(
  guardSource,
  /async function handleCheckIn\(\) \{[\s\S]*?if \(!canStartGuardShift\)/,
  'Clock In must remain gated by a valid canonical Guard identity.',
);

assert.match(
  guardSource,
  /async function handleCheckOut\(\) \{[\s\S]*?if \(!canUseGuardPage\)/,
  'Clock Out must remain scoped to authenticated Guard context.',
);

for (const required of [
  "searchParams.get('portal') === 'guard'",
  "startsWith('/guard')",
  'const guardRedirectTarget =',
  'if (guardIntent) {',
  'adminAuthRepository.sendPhoneOTP',
  '!guardIntent && authMode',
  'Masuk Guard Portal',
]) {
  assert.equal(
    loginSource.includes(
      required,
    ),
    true,
    'Shared login Guard-intent marker missing: ' +
      required,
  );
}

assert.match(
  loginSource,
  /guardIntent[\s\S]*?\?\s*'Masuk Guard Portal'/,
  'Guard login submit copy must remain driven by guardIntent.'
);

assert.equal(
  loginSource.includes(
    "role = 'studio_guard'"
  ),
  false,
  'Shared login must never create studio_guard role.',
);

/*
 * GP8-D — attendance ownership and identity invariants.
 */
for (const required of [
  'export function makeGuardAttendanceId',
  'assertValidGuardIdentityLink',
  'const accountGuardId =',
  'accountGuardId !==',
  'guardUid:',
  'user.uid',
  'export function buildGuardAttendanceCheckOutPatch',
]) {
  assert.equal(
    attendanceSource.includes(
      required,
    ),
    true,
    'Attendance invariant marker missing: ' +
      required,
  );
}

for (const forbidden of [
  'guardPerson.id || user.uid',
  'guardPerson?.id || user?.uid',
  'guardPerson.id || user?.uid',
]) {
  assert.equal(
    attendanceSource.includes(
      forbidden,
    ),
    false,
    'Attendance must not restore auth UID as Guard person identity fallback: ' +
      forbidden,
  );
}

assert.match(
  attendanceSource,
  /makeGuardAttendanceId\(\{[\s\S]*?guardUid:\s*user\.uid/,
  'Attendance document identity must remain UID-scoped.',
);

assert.match(
  attendanceSource,
  /!user\?\.uid \|\|[\s\S]*?user\.uid !==[\s\S]*?record\.guardUid/,
  'Checkout must remain bound to the same authenticated Guard UID.',
);

/*
 * GP8-E — Owner provisioning and Firestore security boundary.
 */
for (const required of [
  'initializeAuth(',
  'inMemoryPersistence',
  'assertValidGuardIdentityLink(',
  'buildPortalRoleTransitionPatch(',
  'deleteUser(',
  'deleteApp(',
]) {
  assert.equal(
    provisioningSource.includes(
      required,
    ),
    true,
    'Owner provisioning safety marker missing: ' +
      required,
  );
}

const studioGuardRuleBlock =
  rulesSource.slice(
    rulesSource.indexOf(
      'function isStudioGuardAccount()'
    ),
    rulesSource.indexOf(
      'function hasCanonicalGuardId(data)'
    ),
  );

assert.equal(
  studioGuardRuleBlock.includes(
    "role == 'studio_guard'"
  ),
  true,
  'Firestore Guard actor must remain canonical studio_guard.',
);

for (const forbidden of [
  "role == 'admin'",
  'isGuard',
]) {
  assert.equal(
    studioGuardRuleBlock.includes(
      forbidden,
    ),
    false,
    'Firestore Guard actor must not restore legacy mixed-role marker: ' +
      forbidden,
  );
}

assert.equal(
  rulesSource.includes(
    "(data.role == 'studio_guard' && data.status == 'approved' && hasOnlyGuardPortalPermissions(data.permissions) && hasCanonicalGuardId(data))"
  ),
  true,
  'Canonical studio_guard user document must require guardId and zero Admin permissions.',
);

assert.equal(
  rulesSource.includes(
    "(!data.keys().hasAny(['isGuard']) || data.isGuard == null || data.isGuard == false)"
  ),
  true,
  'Firestore must continue rejecting isGuard=true writes.',
);

assert.match(
  rulesSource,
  /function guardCreatesOwnAttendance\(data, attendanceId\) \{\s*return isStudioGuardAccount\(\)/,
  'Guard attendance create must remain canonical Guard self-only.',
);

const guardCreateRuleBlock =
  rulesSource.slice(
    rulesSource.indexOf(
      'function guardCreatesOwnAttendance(data, attendanceId) {'
    ),
    rulesSource.indexOf(
      'function validGuardSelfCheckoutPatch() {'
    ),
  );

assert.notEqual(
  guardCreateRuleBlock,
  '',
  'Guard attendance create rule block must remain present.',
);

for (const required of [
  "attendanceId == 'att__' + request.auth.uid + '__' + data.date",
  'data.guardUid == request.auth.uid',
  'data.clockInByUid == request.auth.uid',
]) {
  assert.equal(
    guardCreateRuleBlock.includes(
      required,
    ),
    true,
    'Guard attendance create UID binding missing: ' +
      required,
  );
}

assert.equal(
  guardCreateRuleBlock.includes(
    'request.auth.uid'
  ),
  true,
  'Guard attendance create UID bindings must remain scoped to request.auth.uid.',
);

/*
 * GP8-F — all remediation phase gates must stay registered.
 */
const requiredContracts = [
  'guard-portal-flow-baseline-contract-test.mjs',
  'guard-portal-access-resolution-contract-test.mjs',
  'guard-identity-realtime-contract-test.mjs',
  'guard-owner-oversight-contract-test.mjs',
  'guard-portal-session-switch-contract-test.mjs',
  'owner-managed-account-provisioning-contract-test.mjs',
  'guard-attendance-owner-review-transition-contract-test.mjs',
  'guard-identity-link-contract-test.mjs',
  'guard-legacy-isguard-migration-contract-test.mjs',
  'guard-wrong-portal-auth-ux-contract-test.mjs',
  'guard-portal-final-regression-contract-test.mjs',
];

for (const contract of requiredContracts) {
  assert.equal(
    packageJson.scripts.test.includes(
      'node scripts/' +
        contract
    ),
    true,
    'Guard remediation contract must remain registered: ' +
      contract,
  );
}

for (const required of [
  'GP8 FINAL RELEASE CHECKLIST',
  'Owner Oversight',
  'Admin Cross Portal',
  'Canonical Guard',
  'Wrong Portal Client',
  'Identity Repair',
  'Legacy compatibility retired',
  'npm run lint',
  'npm test',
  'npm run build',
]) {
  assert.equal(
    releaseChecklistSource.includes(
      required,
    ),
    true,
    'GP8 release checklist marker missing: ' +
      required,
  );
}

console.log(
  'guard-portal-final-regression-contract-test: PASS',
);
