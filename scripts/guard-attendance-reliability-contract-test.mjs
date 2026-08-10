import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  buildGuardAttendanceCheckOutPatch,
  makeGuardAttendanceId,
  normalizeGuardAttendanceSession,
} from '../src/services/guardAttendanceRepository.js';

const deterministicId =
  makeGuardAttendanceId({
    date:
      '2026-08-09',

    guardUid:
      'guard-uid-123',
  });

assert.equal(
  deterministicId,
  'att__guard-uid-123__2026-08-09',
);

assert.equal(
  makeGuardAttendanceId({
    date:
      '2026-08-09',

    guardUid:
      'guard-uid-123',
  }),
  deterministicId,
  'Same guard + date must always produce one document ID.',
);

assert.notEqual(
  makeGuardAttendanceId({
    date:
      '2026-08-10',

    guardUid:
      'guard-uid-123',
  }),
  deterministicId,
);

const pendingSession =
  normalizeGuardAttendanceSession({
    approvalStatus:
      GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,

    clockInAt:
      '2026-08-09T01:00:00.000Z',

    clockInByUid:
      'guard-uid-123',

    clockOutAt:
      '',

    clockOutByUid:
      '',

    createdAt:
      '2026-08-09T01:00:00.000Z',

    date:
      '2026-08-09',

    guardName:
      'Guard Test',

    guardPersonId:
      'guard-person-1',

    guardUid:
      'guard-uid-123',

    id:
      deterministicId,

    mealEligible:
      false,

    ownerActionRequired:
      true,

    status:
      GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL,

    updatedAt:
      '2026-08-09T01:00:00.000Z',
  });

const pendingCheckOut =
  buildGuardAttendanceCheckOutPatch(
    pendingSession,

    {
      uid:
        'guard-uid-123',
    },

    {
      timestamp:
        '2026-08-09T09:00:00.000Z',
    },
  );

assert.equal(
  pendingCheckOut.status,
  GUARD_ATTENDANCE_STATUSES.CLOSED,
  'Checkout must close the shift even while owner approval is still pending.',
);

assert.equal(
  pendingCheckOut.clockOutByUid,
  'guard-uid-123',
);

assert.equal(
  pendingCheckOut.durationHours,
  8,
);

assert.throws(
  () =>
    buildGuardAttendanceCheckOutPatch(
      pendingSession,

      {
        uid:
          'different-user',
      },

      {
        timestamp:
          '2026-08-09T09:00:00.000Z',
      },
    ),

  /Hanya penjaga terkait/,
);

assert.throws(
  () =>
    buildGuardAttendanceCheckOutPatch(
      {
        ...pendingSession,

        clockOutAt:
          '2026-08-09T08:00:00.000Z',

        status:
          GUARD_ATTENDANCE_STATUSES.CLOSED,
      },

      {
        uid:
          'guard-uid-123',
      },

      {
        timestamp:
          '2026-08-09T09:00:00.000Z',
      },
    ),

  /sudah selesai/,
);

assert.throws(
  () =>
    buildGuardAttendanceCheckOutPatch(
      {
        ...pendingSession,

        status:
          GUARD_ATTENDANCE_STATUSES.REJECTED,
      },

      {
        uid:
          'guard-uid-123',
      },

      {
        timestamp:
          '2026-08-09T09:00:00.000Z',
      },
    ),

  /Status absen tidak dapat ditutup/,
);

const repositorySource =
  readFileSync(
    resolve(
      'src/services/guardAttendanceRepository.js',
    ),
    'utf8',
  );

for (
  const forbidden
  of [
    'OFFLINE_QUEUE_KEY',
    'addToOfflineQueue',
    'syncOfflineQueue',
    'localStorage.getItem',
    'localStorage.setItem',
  ]
) {
  assert.equal(
    repositorySource.includes(
      forbidden,
    ),
    false,
    'Custom offline queue must be removed from new guard write path: ' +
      forbidden,
  );
}

for (
  const required
  of [
    'getDocs',
    'hasApprovedGuardMealForDay',
    'resolveGuardAttendanceSession',
    'buildGuardAttendanceCheckOutPatch',
    "eventId:\n      'notif_guard_attendance_submitted__'",
    'clockInByUid',
    'clockOutByUid',
  ]
) {
  assert.equal(
    repositorySource.includes(
      required,
    ),
    true,
    'Guard reliability repository contract missing: ' +
      required,
  );
}

assert.equal(
  repositorySource.includes(
    'existing.exists()',
  ),
  false,
  'Guard check-in must not pre-read a deterministic document that may not exist yet.',
);

assert.equal(
  repositorySource.includes(
    "Date.now().toString(36)",
  ),
  false,
  'Attendance document ID must not depend on Date.now().',
);

const adminSource =
  readFileSync(
    resolve(
      'src/pages/admin/GuardAttendancePage.jsx',
    ),
    'utf8',
  );

for (
  const stale
  of [
    'approveGuardAttendanceSession(session.id',
    'rejectGuardAttendanceSession(session.id',
    'voidGuardAttendanceSession(session.id',
    'subscribeGuardAttendanceSessions((items)',
  ]
) {
  assert.equal(
    adminSource.includes(
      stale,
    ),
    false,
    'Owner attendance page contains stale repository contract: ' +
      stale,
  );
}

for (
  const required
  of [
    'approveGuardAttendanceSession(session, currentUser)',
    'rejectGuardAttendanceSession(session, currentUser, reason)',
    'voidGuardAttendanceSession(session, currentUser, reason)',
    'subscribeGuardAttendanceSessions(\n        {},',
  ]
) {
  assert.equal(
    adminSource.includes(
      required,
    ),
    true,
    'Owner attendance contract missing: ' +
      required,
  );
}

const guardPageSource =
  readFileSync(
    resolve(
      'src/pages/guard/GuardAttendancePage.jsx',
    ),
    'utf8',
  );

assert.equal(
  guardPageSource.includes(
    'syncOfflineQueue',
  ),
  false,
  'Guard page must rely on Firestore persistent cache only.',
);

assert.equal(
  guardPageSource.includes(
    'setSessions(',
  ),
  true,
  'Guard page needs optimistic local session state for offline actions.',
);

const firebaseSource =
  readFileSync(
    resolve(
      'src/lib/firebase.js',
    ),
    'utf8',
  );

assert.equal(
  firebaseSource.includes(
    'persistentLocalCache',
  ),
  true,
  'Firestore persistent cache is the canonical offline write mechanism.',
);

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

for (
  const required
  of [
    "attendanceId == 'att__' + request.auth.uid + '__' + data.date",
    'data.clockInByUid == request.auth.uid',
    'request.resource.data.clockOutByUid == request.auth.uid',
    "request.resource.data.status == 'closed'",
    'resource.data.clockOutAt ==',
    'function adminApprovesGuardAttendance()',
    'function adminRejectsGuardAttendance()',
    'function adminVoidsGuardAttendance()',
    'function validGuardAttendanceOwnerReviewAuditFields()',
    'function validGuardAttendanceOwnerApprovePatch()',
    'function validGuardAttendanceOwnerRejectPatch()',
    'function validGuardAttendanceOwnerVoidPatch()',
    'function adminReviewsGuardAttendance()',
    'adminUpdatesGuardAttendance()',
  ]
) {
  assert.equal(
    rulesSource.includes(
      required,
    ),
    true,
    'Firestore reliability contract missing: ' +
      required,
  );
}

assert.equal(
  rulesSource.includes(
    'canManageGuardAttendance() ||\\n        guardClosesOwnAttendance()',
  ),
  false,
  'Admin must no longer have unrestricted attendance update access.',
);

assert.equal(
  rulesSource.includes(
    'function validGuardSelfCheckoutPatch()',
  ),
  true,
  'Guard checkout must validate only its mutable checkout fields.',
);

assert.equal(
  rulesSource.includes(
    'allow update: if guardClosesOwnAttendance() ||\n        adminReviewsGuardAttendance() || (',
  ),
  true,
  'Guard checkout and Owner review transitions must not depend on full-document schema validation.',
);

assert.equal(
  rulesSource.includes(
    'adminReviewsGuardAttendance() || (\n          validGuardAttendanceSession('
  ),
  false,
  'Owner review transitions must remain outside the full-document validator.',
);

assert.equal(
  rulesSource.includes(
    'validGuardAttendanceSession(\n            request.resource.data,\n            attendanceId\n          ) &&\n          adminPostsGuardMeal()'
  ),
  true,
  'Meal posting must retain full-document validation because it reconciles Bookkeeping.',
);

assert.equal(
  rulesSource.includes(
    'validGuardSelfCheckoutPatch() &&',
  ),
  true,
  'Guard checkout transition must use focused checkout validation.',
);

assert.equal(
  rulesSource.includes(
    'request.resource.data.clockOutByUid == request.auth.uid',
  ),
  true,
  'Guard checkout must remain bound to authenticated UID.',
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
  'Phase 6A gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-attendance-reliability-contract-test.mjs',
  ),
  true,
  'Phase 6B gate must be registered.',
);

process.stdout.write(
  '✅ Guard Attendance Reliability contract passed.\n',
);
