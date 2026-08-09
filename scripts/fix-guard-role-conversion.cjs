const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  permissions: path.join(
    ROOT,
    'src',
    'utils',
    'adminPermissions.js',
  ),

  settings: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'SettingsPage.jsx',
  ),

  rules: path.join(
    ROOT,
    'firestore.rules',
  ),

  test: path.join(
    ROOT,
    'scripts',
    'guard-role-transition-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),
};

const staged = new Map();

function fail(message) {
  console.error('');
  console.error(
    '[guard-role-hotfix] ' +
      message,
  );
  console.error('');

  process.exit(1);
}

function normalize(value) {
  return String(value)
    .replace(/\r\n/g, '\n');
}

function read(file) {
  if (staged.has(file)) {
    return staged.get(file);
  }

  if (!fs.existsSync(file)) {
    fail(
      'File tidak ditemukan: ' +
        path.relative(
          ROOT,
          file,
        ),
    );
  }

  return normalize(
    fs.readFileSync(
      file,
      'utf8',
    ),
  );
}

function stage(
  file,
  content,
) {
  staged.set(
    file,
    normalize(content),
  );
}

function count(
  source,
  needle,
) {
  return source
    .split(needle)
    .length -
    1;
}

function replaceOnce(
  file,
  before,
  after,
  label,
) {
  const source =
    read(file);

  if (
    !source.includes(before) &&
    source.includes(after)
  ) {
    console.log(
      'ℹ️ Already applied: ' +
        label,
    );

    return;
  }

  const matches =
    count(
      source,
      before,
    );

  if (
    matches !== 1
  ) {
    fail(
      label +
        ': expected 1 anchor, found ' +
        matches,
    );
  }

  stage(
    file,
    source.replace(
      before,
      after,
    ),
  );

  console.log(
    '✅ Updated: ' +
      label,
  );
}

function replaceRange(
  file,
  startMarker,
  endMarker,
  replacement,
  label,
) {
  const source =
    read(file);

  const start =
    source.indexOf(
      startMarker,
    );

  const end =
    source.indexOf(
      endMarker,
      start >= 0
        ? start
        : 0,
    );

  if (
    start < 0 ||
    end < 0 ||
    end <= start
  ) {
    fail(
      label +
        ': markers tidak ditemukan.',
    );
  }

  stage(
    file,
    source.slice(
      0,
      start,
    ) +
      replacement +
      source.slice(
        end,
      ),
  );

  console.log(
    '✅ Updated: ' +
      label,
  );
}

function stageNewFile(
  file,
  content,
) {
  const normalized =
    normalize(content);

  if (
    fs.existsSync(file)
  ) {
    const current =
      normalize(
        fs.readFileSync(
          file,
          'utf8',
        ),
      );

    if (
      current === normalized
    ) {
      console.log(
        'ℹ️ Already correct: ' +
          path.relative(
            ROOT,
            file,
          ),
      );

      return;
    }

    fail(
      path.relative(
        ROOT,
        file,
      ) +
        ' sudah ada dengan isi berbeda.',
    );
  }

  stage(
    file,
    normalized,
  );
}

/**
 * ============================================================
 * BASELINE
 * ============================================================
 */

if (
  !read(
    FILES.permissions,
  ).includes(
    'export const guardPortalPermissionKeys = [];',
  )
) {
  fail(
    'Phase 6A zero-permission guard baseline belum ada.',
  );
}

if (
  !read(
    FILES.settings,
  ).includes(
    'async function handleUpdateUserRole(userId, newRole)',
  )
) {
  fail(
    'Expected stale Settings role update tidak ditemukan.',
  );
}

/**
 * ============================================================
 * 1. CENTRAL ROLE TRANSITION MODEL
 * ============================================================
 */

const transitionHelper = `export function buildPortalRoleTransitionPatch(
  user,
  nextRole,
  {
    guardId = '',
  } = {},
) {
  if (
    nextRole ===
    STUDIO_GUARD_ROLE
  ) {
    const resolvedGuardId =
      String(
        guardId ||
        user?.guardId ||
        '',
      ).trim();

    if (
      !resolvedGuardId
    ) {
      throw new Error(
        'Pilih identitas crew penjaga sebelum mengubah role menjadi Guard.',
      );
    }

    return {
      guardId:
        resolvedGuardId,

      isGuard:
        false,

      permissions: {
        ...defaultGuardPortalPermissions,
      },

      role:
        STUDIO_GUARD_ROLE,

      status:
        'approved',
    };
  }

  if (
    nextRole ===
    'admin'
  ) {
    return {
      guardId:
        null,

      isGuard:
        false,

      permissions: {
        ...defaultAdminPermissions,
      },

      role:
        'admin',

      status:
        'approved',
    };
  }

  throw new Error(
    'Role portal tidak didukung.',
  );
}

`;

replaceOnce(
  FILES.permissions,

  'export function getAssignablePermissionPages(user) {',

  transitionHelper +
    'export function getAssignablePermissionPages(user) {',

  'portal role transition helper',
);

/**
 * ============================================================
 * 2. SETTINGS IMPORT
 * ============================================================
 */

replaceOnce(
  FILES.settings,

  `  countEnabledAdminPermissions,
  defaultAdminPermissions,`,

  `  buildPortalRoleTransitionPatch,
  countEnabledAdminPermissions,
  defaultAdminPermissions,`,

  'Settings role transition import',
);

/**
 * ============================================================
 * 3. ROLE UPDATE IS NOW ATOMIC
 * ============================================================
 */

const roleUpdate = `  async function commitUserRoleTransition(
    user,
    newRole,
    {
      guardId = '',
    } = {},
  ) {
    if (
      !user?.id
    ) {
      throw new Error(
        'User tujuan tidak valid.',
      );
    }

    const patch =
      buildPortalRoleTransitionPatch(
        user,
        newRole,
        {
          guardId,
        },
      );

    await updateDoc(
      doc(
        firestoreDb,
        'users',
        user.id,
      ),
      {
        ...patch,

        updatedAt:
          new Date().toISOString(),
      },
    );

    return patch;
  }

  async function handleUpdateUserRole(
    user,
    newRole,
    options = {},
  ) {
    if (
      !user?.id ||
      !newRole ||
      newRole ===
        user.role
    ) {
      return;
    }

    if (
      newRole ===
        'studio_guard' &&
      !(
        options.guardId ||
        user.guardId
      )
    ) {
      setSelectingGuardUser({
        ...user,

        pendingRole:
          'studio_guard',
      });

      setSelectedCrewId(
        null,
      );

      setApprovalSettingsMessage(
        'Pilih identitas crew penjaga untuk menyelesaikan perubahan role.',
      );

      return;
    }

    try {
      await commitUserRoleTransition(
        user,
        newRole,
        options,
      );

      setSelectingGuardUser(
        null,
      );

      setSelectedCrewId(
        null,
      );

      setApprovalSettingsMessage(
        newRole ===
          'studio_guard'
          ? 'Role berhasil diubah menjadi Guard.'
          : 'Role berhasil diubah menjadi Admin.',
      );
    } catch (err) {
      console.error(
        'Failed to update user role:',
        err,
      );

      setApprovalSettingsMessage(
        err?.message ||
        'Gagal memperbarui peran akun.',
      );
    }
  }

`;

replaceRange(
  FILES.settings,

  '  async function handleUpdateUserRole(userId, newRole) {',

  '  async function handleToggleUserStatus(',

  roleUpdate,

  'atomic Admin/Guard role conversion',
);

/**
 * ============================================================
 * 4. REMOVE LEGACY ADMIN + isGuard WRITE ACTION
 * ============================================================
 */

replaceRange(
  FILES.settings,

  '  async function handleToggleUserIsGuard(',

  '  function openPermissionSettings(user) {',

  '',

  'remove legacy Admin + isGuard mutation',
);

/**
 * ============================================================
 * 5. DROPDOWN PASSES FULL USER
 * ============================================================
 */

replaceOnce(
  FILES.settings,

  `onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}`,

  `onChange={(e) => handleUpdateUserRole(user, e.target.value)}`,

  'role dropdown canonical user conversion',
);

/**
 * ============================================================
 * 6. REMOVE LEGACY SET-AS-GUARD BUTTON
 * ============================================================
 */

replaceRange(
  FILES.settings,

  `                          {/* Set as Guard checkbox (only for Admins) */}`,

  `                          {/* Transfer Owner (Admin only) */}`,

  '',

  'remove legacy mixed admin/guard UI',
);

/**
 * ============================================================
 * 7. CREW PICKER NOW COMPLETES ROLE CONVERSION
 * ============================================================
 */

replaceOnce(
  FILES.settings,

  `                <span>Pilih crew penjaga yang sesuai untuk menghubungkan absensi admin ini.</span>`,

  `                <span>Pilih crew penjaga yang sesuai untuk mengaktifkan role Guard pada akun ini.</span>`,

  'guard picker conversion copy',
);

replaceOnce(
  FILES.settings,

  `onClick={() => handleToggleUserIsGuard(selectingGuardUser.id, false, selectedCrewId)}`,

  `onClick={() =>
                  handleUpdateUserRole(
                    selectingGuardUser,
                    'studio_guard',
                    {
                      guardId:
                        selectedCrewId,
                    },
                  )
                }`,

  'guard picker saves role transition',
);

/**
 * ============================================================
 * 8. FIRESTORE ZERO ADMIN PERMISSION INVARIANT
 * ============================================================
 */

replaceRange(
  FILES.rules,

  '    function hasOnlyGuardPortalPermissions(data) {',

  '    function validPreferences(data) {',

  `    function hasOnlyGuardPortalPermissions(data) {
      return hasNoAdminPermissions(data);
    }

`,

  'Firestore guard zero-admin-permission invariant',
);

/**
 * ============================================================
 * 9. CONTRACT TEST
 * ============================================================
 */

const testSource = `import assert from 'node:assert/strict';

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

const legacyAdminGuard = {
  guardId:
    'crew-guard-1',

  id:
    'user-guard-old',

  isGuard:
    true,

  permissions: {
    ...defaultAdminPermissions,
  },

  role:
    'admin',

  status:
    'approved',
};

const guardPatch =
  buildPortalRoleTransitionPatch(
    legacyAdminGuard,
    'studio_guard',
  );

assert.equal(
  guardPatch.role,
  'studio_guard',
);

assert.equal(
  guardPatch.status,
  'approved',
);

assert.equal(
  guardPatch.guardId,
  'crew-guard-1',
  'Legacy guardId must survive Admin -> Guard conversion.',
);

assert.equal(
  guardPatch.isGuard,
  false,
  'Legacy mixed-role flag must be disabled.',
);

assert.equal(
  Object.values(
    guardPatch.permissions,
  ).every(
    (value) =>
      value === false,
  ),
  true,
  'Guard must receive zero admin-page permissions.',
);

assert.throws(
  () =>
    buildPortalRoleTransitionPatch(
      {
        id:
          'admin-without-guard',

        role:
          'admin',
      },
      'studio_guard',
    ),

  /Pilih identitas crew penjaga/,
);

const selectedGuardPatch =
  buildPortalRoleTransitionPatch(
    {
      id:
        'admin-new-guard',

      role:
        'admin',
    },
    'studio_guard',
    {
      guardId:
        'crew-guard-2',
    },
  );

assert.equal(
  selectedGuardPatch.guardId,
  'crew-guard-2',
);

const adminPatch =
  buildPortalRoleTransitionPatch(
    {
      guardId:
        'crew-guard-1',

      id:
        'guard-user',

      role:
        'studio_guard',
    },
    'admin',
  );

assert.equal(
  adminPatch.role,
  'admin',
);

assert.equal(
  adminPatch.status,
  'approved',
);

assert.equal(
  adminPatch.guardId,
  null,
);

assert.equal(
  adminPatch.isGuard,
  false,
);

assert.deepEqual(
  adminPatch.permissions,
  defaultAdminPermissions,
);

const settingsSource =
  readFileSync(
    resolve(
      'src/pages/admin/SettingsPage.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'buildPortalRoleTransitionPatch',
    'commitUserRoleTransition',
    'handleUpdateUserRole(user, e.target.value)',
    "pendingRole:\\n          'studio_guard'",
    "guardId:\\n                        selectedCrewId",
  ]
) {
  assert.equal(
    settingsSource.includes(
      required,
    ),
    true,
    'Settings guard role transition missing: ' +
      required,
  );
}

for (
  const forbidden
  of [
    'handleToggleUserIsGuard',
    'Set as Guard checkbox',
    'Jadikan Penjaga',
  ]
) {
  assert.equal(
    settingsSource.includes(
      forbidden,
    ),
    false,
    'Legacy mixed Admin + Guard flow must be removed: ' +
      forbidden,
  );
}

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

assert.equal(
  rulesSource.includes(
    'function hasOnlyGuardPortalPermissions(data) {\\n      return hasNoAdminPermissions(data);\\n    }',
  ),
  true,
  'studio_guard Firestore invariant must require zero admin permissions.',
);

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
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
  '✅ Guard Role Transition contract passed.\\n',
);
`;

stageNewFile(
  FILES.test,
  testSource,
);

/**
 * ============================================================
 * 10. REGISTER TEST
 * ============================================================
 */

let packageJson;

try {
  packageJson =
    JSON.parse(
      read(
        FILES.packageJson,
      ),
    );
} catch (error) {
  fail(
    'package.json invalid: ' +
      error.message,
  );
}

const phase6a =
  'node scripts/guard-portal-isolation-contract-test.mjs';

const hotfix =
  'node scripts/guard-role-transition-contract-test.mjs';

const commands =
  packageJson
    .scripts
    .test
    .split('&&')
    .map(
      (command) =>
        command.trim(),
    )
    .filter(Boolean);

if (
  !commands.includes(
    phase6a,
  )
) {
  fail(
    'Phase 6A contract hilang.',
  );
}

if (
  !commands.includes(
    hotfix,
  )
) {
  packageJson.scripts.test =
    [
      ...commands,
      hotfix,
    ].join(
      ' && ',
    );

  stage(
    FILES.packageJson,

    JSON.stringify(
      packageJson,
      null,
      2,
    ) +
      '\n',
  );
}

/**
 * ============================================================
 * FINAL VALIDATION
 * ============================================================
 */

const nextSettings =
  read(
    FILES.settings,
  );

for (
  const forbidden
  of [
    'handleToggleUserIsGuard',
    'Set as Guard checkbox',
  ]
) {
  if (
    nextSettings.includes(
      forbidden,
    )
  ) {
    fail(
      'Legacy mixed role flow masih ada: ' +
        forbidden,
    );
  }
}

const nextRules =
  read(
    FILES.rules,
  );

if (
  !nextRules.includes(
    'function hasOnlyGuardPortalPermissions(data) {\n      return hasNoAdminPermissions(data);\n    }',
  )
) {
  fail(
    'Guard permission invariant belum zero-admin.',
  );
}

/**
 * ============================================================
 * WRITE
 * ============================================================
 */

for (
  const [
    file,
    content,
  ]
  of staged.entries()
) {
  fs.mkdirSync(
    path.dirname(
      file,
    ),
    {
      recursive:
        true,
    },
  );

  fs.writeFileSync(
    file,
    content,
    'utf8',
  );

  console.log(
    '[guard-role-hotfix] Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ Guard Role Conversion hotfix prepared.',
);
console.log('');
console.log('Admin -> Guard:');
console.log('  role = studio_guard');
console.log('  status = approved');
console.log('  permissions = all false');
console.log('  legacy isGuard = false');
console.log('  guardId = preserved / selected');
console.log('');
console.log('Guard -> Admin:');
console.log('  role = admin');
console.log('  status = approved');
console.log('  permissions = default admin');
console.log('  guardId = null');
console.log('');
console.log('Firestore rules changed: deploy required.');