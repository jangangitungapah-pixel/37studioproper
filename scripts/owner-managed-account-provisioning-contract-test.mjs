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
    'utf8',
  );
}

const serviceSource =
  read(
    'src/services/ownerAccountProvisioningRepository.js',
  );

const settingsSource =
  read(
    'src/pages/admin/SettingsPage.jsx',
  );

const permissionSource =
  read(
    'src/utils/adminPermissions.js',
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

/*
 * Primary Owner auth must never be replaced by provisioning.
 * A named secondary Firebase app + in-memory Auth owns credential creation.
 */
for (
  const required
  of [
    'initializeApp(',
    'createTemporaryAppName()',
    'initializeAuth(',
    'inMemoryPersistence',
    'createUserWithEmailAndPassword(\n        temporaryAuth',
    'getFirestore(\n      temporaryApp',
    'deleteApp(\n        temporaryApp',
  ]
) {
  assert.equal(
    serviceSource.includes(
      required,
    ),
    true,
    'Secondary Firebase provisioning marker missing: ' +
      required,
  );
}

assert.equal(
  serviceSource.includes(
    'createUserWithEmailAndPassword(\n        firebaseAuth',
  ),
  false,
  'Owner provisioning must not create the new user on primary Auth.',
);

assert.equal(
  serviceSource.includes(
    'signOut(\n          firebaseAuth',
  ),
  false,
  'Owner provisioning must never sign out primary Owner Auth.',
);

assert.equal(
  serviceSource.includes(
    'firebaseAuth.currentUser?.uid !==\n      ownerUid',
  ),
  true,
  'Provisioning must fail closed if the primary Owner session changes.',
);

/*
 * New account first self-creates a least-privilege pending Admin identity.
 * This preserves existing Firestore user-create security instead of broadening it.
 */
for (
  const required
  of [
    "role:\n      'admin'",
    "status:\n      'pending'",
    'createAdminPermissions(\n        false',
    "provider:\n      'password'",
    "setDoc(\n      doc(\n        temporaryDb,\n        'users'",
  ]
) {
  assert.equal(
    serviceSource.includes(
      required,
    ),
    true,
    'Fail-closed self-create marker missing: ' +
      required,
  );
}

/*
 * Primary Owner session performs only the canonical final role transition.
 */
for (
  const required
  of [
    'buildPortalRoleTransitionPatch(',
    "input.role",
    "guardId:\n            input.guardId",
    "updateDoc(\n      doc(\n        firestoreDb,\n        'users'",
  ]
) {
  assert.equal(
    serviceSource.includes(
      required,
    ),
    true,
    'Owner finalization marker missing: ' +
      required,
  );
}

assert.equal(
  permissionSource.includes(
    "role:\n        STUDIO_GUARD_ROLE",
  ),
  true,
  'Canonical Guard role transition must remain available.',
);

assert.equal(
  permissionSource.includes(
    '...defaultGuardPortalPermissions',
  ),
  true,
  'Guard provisioning must preserve zero Admin permissions.',
);

/*
 * Password may exist in transient provisioning variables, but must never
 * enter either Firestore identity payload.
 */
const pendingIdentityBlock =
  serviceSource.slice(
    serviceSource.indexOf(
      'function buildPendingSelfIdentity'
    ),
    serviceSource.indexOf(
      'export function getOwnerProvisioningErrorMessage'
    ),
  );

assert.equal(
  /^\s*password\s*:/m.test(
    pendingIdentityBlock,
  ),
  false,
  'Pending Firestore identity must not contain a password field.',
);

const finalFirestoreBlock =
  serviceSource.slice(
    serviceSource.indexOf(
      'await updateDoc('
    ),
    serviceSource.indexOf(
      'finalized =\n      true'
    ),
  );

assert.equal(
  /^\s*password\s*:/m.test(
    finalFirestoreBlock,
  ),
  false,
  'Final Owner Firestore update must not contain a password field.',
);

assert.equal(
  serviceSource.includes(
    'input.password'
  ),
  true,
  'Password may only be consumed by Firebase Auth credential creation.',
);

/*
 * Rollback must clean both the Firestore identity and the newly-created Auth user.
 */
for (
  const required
  of [
    'deleteDoc(',
    'deleteUser(',
    'pendingDocCreated',
    'finalized',
  ]
) {
  assert.equal(
    serviceSource.includes(
      required,
    ),
    true,
    'Provisioning rollback marker missing: ' +
      required,
  );
}

/*
 * Existing Firestore user-create boundary stays unchanged.
 */
assert.match(
  rulesSource,

  /match \/users\/\{userId\}[\s\S]*?allow create: if isSignedIn\(\) &&[\s\S]*?request\.auth\.uid == userId[\s\S]*?isSafeAccountSelfCreate\(request\.resource\.data\)/,

  'Owner provisioning must keep user document create restricted to self-create.',
);

assert.match(
  rulesSource,

  /allow update: if validUser\(request\.resource\.data, userId\) && \([\s\S]*?isOwner\(\)/,

  'Owner must retain canonical user-document update authority.',
);

/*
 * Settings UI is Owner-only and creates only Admin / Guard accounts.
 */
assert.equal(
  settingsSource.includes(
    "{activeSubpage === 'user-settings' && isOwnerAdminUser(currentUser) && ("
  ),
  true,
  'User & Access Settings must remain Owner-only.',
);

for (
  const required
  of [
    'Buat Akun Portal',
    'Buat Akun & Aktifkan',
    'OWNER_PROVISION_ROLE_OPTIONS',
    "key: 'admin'",
    "key: 'studio_guard'",
    'handleProvisionPortalAccount',
    'ownerAccountProvisioningRepository.provisionPortalAccount',
    'guardProvisionOptions',
    'Pilih identitas crew Guard terlebih dahulu.',
    'Kredensial siap diberikan',
    'Copy Kredensial',
    'Password tidak disimpan di database aplikasi',
    "createdAccount.role === 'studio_guard'",
    "? '/guard/attendance'",
    ": '/login'",
  ]
) {
  assert.equal(
    settingsSource.includes(
      required,
    ),
    true,
    'Owner provisioning UI marker missing: ' +
      required,
  );
}

/*
 * Guard selectable identities must come from the existing active Guard/Both crew list.
 */
assert.match(
  settingsSource,

  /const guardPeople = useMemo\([\s\S]*?person\.active[\s\S]*?OPERATOR_FEE_PERSON_ROLES\.GUARD[\s\S]*?OPERATOR_FEE_PERSON_ROLES\.BOTH/,

  'Guard provisioning must use active Guard/Both crew identities.',
);

/*
 * Credential receipt is intentionally ephemeral.
 */
assert.equal(
  settingsSource.includes(
    'localStorage.setItem(\n        provisionedCredentials'
  ),
  false,
  'Provisioned password receipt must not be persisted to localStorage.',
);

assert.equal(
  settingsSource.includes(
    'setProvisionedCredentials({'
  ),
  true,
  'Credential receipt must remain React state only.',
);

/*
 * Contract registration.
 */
assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/owner-managed-account-provisioning-contract-test.mjs'
  ),
  true,
  'Owner provisioning contract must be registered in npm test.',
);

console.log(
  'owner-managed-account-provisioning-contract-test: PASS',
);
