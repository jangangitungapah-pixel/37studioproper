import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  buildPortalRoleTransitionPatch,
  defaultAdminPermissions,
} from '../src/utils/adminPermissions.js';

const activeGuardPeople = [
  {
    active: true,
    id: 'crew-guard-1',
    name: 'Guard One',
    role: 'guard',
  },
  {
    active: true,
    id: 'crew-guard-2',
    name: 'Guard Two',
    role: 'both',
  },
];

const legacyAdminGuard = {
  guardId: 'crew-guard-1',
  id: 'user-guard-old',
  isGuard: true,
  permissions: {
    ...defaultAdminPermissions,
  },
  role: 'admin',
  status: 'approved',
};

const guardPatch =
  buildPortalRoleTransitionPatch(
    legacyAdminGuard,
    'studio_guard',
    {
      guardPeople: activeGuardPeople,
    },
  );

assert.equal(guardPatch.role, 'studio_guard');
assert.equal(guardPatch.status, 'approved');
assert.equal(
  guardPatch.guardId,
  'crew-guard-1',
  'Legacy guardId must survive Admin -> Guard conversion only when it is still an active Guard identity.',
);
assert.equal(
  guardPatch.isGuard,
  false,
  'Legacy mixed-role flag must be disabled.',
);
assert.equal(
  Object.values(guardPatch.permissions).every(
    (value) => value === false,
  ),
  true,
  'Guard must receive zero admin-page permissions.',
);

assert.throws(
  () =>
    buildPortalRoleTransitionPatch(
      {
        id: 'admin-without-guard',
        role: 'admin',
      },
      'studio_guard',
      {
        guardPeople: activeGuardPeople,
      },
    ),
  /Pilih identitas crew penjaga/,
);

const selectedGuardPatch =
  buildPortalRoleTransitionPatch(
    {
      id: 'admin-new-guard',
      role: 'admin',
    },
    'studio_guard',
    {
      guardId: 'crew-guard-2',
      guardPeople: activeGuardPeople,
    },
  );

assert.equal(
  selectedGuardPatch.guardId,
  'crew-guard-2',
);

assert.throws(
  () =>
    buildPortalRoleTransitionPatch(
      {
        guardId: 'inactive-guard',
        id: 'admin-inactive-guard',
        role: 'admin',
      },
      'studio_guard',
      {
        guardPeople: [
          {
            active: false,
            id: 'inactive-guard',
            name: 'Inactive Guard',
            role: 'guard',
          },
        ],
      },
    ),
  /nonaktif/i,
  'Admin -> Guard conversion must reject an inactive crew identity.',
);

assert.throws(
  () =>
    buildPortalRoleTransitionPatch(
      {
        guardId: 'operator-only',
        id: 'admin-operator',
        role: 'admin',
      },
      'studio_guard',
      {
        guardPeople: [
          {
            active: true,
            id: 'operator-only',
            name: 'Recording Operator',
            role: 'recording_operator',
          },
        ],
      },
    ),
  /bukan Guard\/Both/i,
  'Admin -> Guard conversion must reject non-Guard crew roles.',
);

const adminPatch =
  buildPortalRoleTransitionPatch(
    {
      guardId: 'crew-guard-1',
      id: 'guard-user',
      role: 'studio_guard',
    },
    'admin',
  );

assert.equal(adminPatch.role, 'admin');
assert.equal(adminPatch.status, 'approved');
assert.equal(adminPatch.guardId, null);
assert.equal(adminPatch.isGuard, false);
assert.deepEqual(
  adminPatch.permissions,
  defaultAdminPermissions,
);

const settingsSource =
  readFileSync(
    resolve('src/pages/admin/SettingsPage.jsx'),
    'utf8',
  );

for (const required of [
  'buildPortalRoleTransitionPatch',
  'commitUserRoleTransition',
  'handleUpdateUserRole(user, e.target.value)',
  'openGuardIdentityLinker',
  'resolveGuardIdentityLink',
  'guardPeople:',
  'Perbaiki identitas Guard',
  'Simpan Link Guard',
]) {
  assert.equal(
    settingsSource.includes(required),
    true,
    'Settings guard role transition missing: ' + required,
  );
}

for (const forbidden of [
  'handleToggleUserIsGuard',
  'Set as Guard checkbox',
  'Jadikan Penjaga',
]) {
  assert.equal(
    settingsSource.includes(forbidden),
    false,
    'Legacy mixed Admin + Guard flow must be removed: ' + forbidden,
  );
}

const rulesSource =
  readFileSync(
    resolve('firestore.rules'),
    'utf8',
  );

assert.equal(
  rulesSource.includes(
    'function hasOnlyGuardPortalPermissions(data) {\n      return hasNoAdminPermissions(data);\n    }'
  ),
  true,
  'studio_guard Firestore invariant must require zero admin permissions.',
);

assert.equal(
  rulesSource.includes(
    "(data.role == 'studio_guard' && data.status == 'approved' && hasOnlyGuardPortalPermissions(data.permissions) && hasCanonicalGuardId(data))"
  ),
  true,
  'Canonical studio_guard documents must require a non-empty guardId.',
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
    'guard-portal-isolation-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-role-transition-contract-test.mjs',
  ),
  true,
);

process.stdout.write(
  '✅ Guard Role Transition contract passed.\n',
);
