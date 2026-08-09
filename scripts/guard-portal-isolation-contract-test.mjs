import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  adminPermissionPages,
  guardPortalPermissionKeys,
  hasAdminPagePermission,
  normalizeAdminPermissionsForRole,
} from '../src/utils/adminPermissions.js';

const legacyGuardPermissions =
  adminPermissionPages.reduce(
    (permissions, page) => ({
      ...permissions,
      [page.key]:
        true,
    }),
    {},
  );

const normalizedGuardPermissions =
  normalizeAdminPermissionsForRole(
    legacyGuardPermissions,
    'studio_guard',
  );

assert.deepEqual(
  guardPortalPermissionKeys,
  [],
  'studio_guard must not own admin-page permissions.',
);

assert.equal(
  Object.values(
    normalizedGuardPermissions,
  ).every(
    (value) =>
      value === false,
  ),
  true,
  'Legacy persisted guard permission flags must become inert in UI permission normalization.',
);

for (
  const page
  of adminPermissionPages
) {
  assert.equal(
    hasAdminPagePermission(
      {
        permissions:
          legacyGuardPermissions,

        role:
          'studio_guard',

        status:
          'approved',
      },

      page.key,
    ),

    false,

    'studio_guard must not access admin page: ' +
      page.key,
  );
}

const adminSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminSource.includes(
    'ACCOUNT_ROLES.STUDIO_GUARD',
  ),
  true,
);

assert.equal(
  adminSource.includes(
    'to="/guard/attendance"',
  ),
  true,
  'Direct /admin access must redirect studio_guard to guard portal.',
);

const loginSource =
  readFileSync(
    resolve(
      'src/pages/LoginPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  loginSource.includes(
    "authState.user?.role ===\n          ACCOUNT_ROLES.STUDIO_GUARD",
  ),
  true,
);

assert.equal(
  loginSource.includes(
    "navigate(\n            '/guard/attendance'",
  ),
  true,
  'Generic login must route studio_guard to attendance.',
);

const guardSource =
  readFileSync(
    resolve(
      'src/pages/guard/GuardAttendancePage.jsx',
    ),
    'utf8',
  );

for (
  const forbidden
  of [
    'subscribeOperatorFeeEntries',
    'feeEntries',
    'selectedSessionForBreakdown',
    'Estimasi Pendapatan',
    'Detail Komisi',
    'Komisi booking',
    'PILIH PROFIL SHIFT',
  ]
) {
  assert.equal(
    guardSource.includes(
      forbidden,
    ),
    false,
    'Attendance-only guard page must not contain: ' +
      forbidden,
  );
}

for (
  const required
  of [
    'assignedGuardPersonId',
    'guardAccount?.guardId',
    'PROFIL PENJAGA',
    'Approved Bulan Ini',
    'Menunggu Approval',
    'Clock-in, clock-out, dan riwayat kehadiran penjaga.',
  ]
) {
  assert.equal(
    guardSource.includes(
      required,
    ),
    true,
    'Guard attendance page missing isolation contract: ' +
      required,
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
    'function hasPermission(page) {\n      return isOwner() || (\n        isApprovedAdmin() &&',
  ),
  true,
  'Admin data permissions must only accept owner/approved admin.',
);

assert.equal(
  rulesSource.includes(
    'function getCurrentGuardPersonId()',
  ),
  true,
);

assert.equal(
  rulesSource.includes(
    'data.guardPersonId == getCurrentGuardPersonId()',
  ),
  true,
  'New guard attendance must be bound to the authenticated guard identity.',
);

assert.equal(
  rulesSource.includes(
    'allow read: if canManageGuardAttendance() || (\n        isStudioGuardAccount() &&\n        resource.data.guardUid == request.auth.uid',
  ),
  true,
  'Guard must only read own attendance unless account is an attendance admin.',
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
    'refund-lifecycle-contract-test.mjs',
  ),
  true,
  'Phase 5D gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-portal-isolation-contract-test.mjs',
  ),
  true,
  'Phase 6A gate must be registered.',
);

process.stdout.write(
  '✅ Guard Portal Isolation contract passed.\n',
);
