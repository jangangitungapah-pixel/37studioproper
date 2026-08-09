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
  GUARD_MEAL_BOOKKEEPING_STATUSES,
  buildGuardMealPostingPatch,
  createGuardMealBookkeepingPayload,
  normalizeGuardAttendanceSession,
} from '../src/services/guardAttendanceRepository.js';

import {
  normalizeBookkeepingEntry,
} from '../src/services/bookkeepingRepository.js';

const approvedClosedSession =
  normalizeGuardAttendanceSession({
    id:
      'att__guard-uid-1__2026-08-09',

    approvalStatus:
      GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED,

    clockInAt:
      '2026-08-09T01:00:00.000Z',

    clockInByUid:
      'guard-uid-1',

    clockOutAt:
      '2026-08-09T09:00:00.000Z',

    clockOutByUid:
      'guard-uid-1',

    closedAt:
      '2026-08-09T09:00:00.000Z',

    createdAt:
      '2026-08-09T01:00:00.000Z',

    date:
      '2026-08-09',

    durationHours:
      8,

    guardName:
      'Guard Test',

    guardPersonId:
      'guard-person-1',

    guardUid:
      'guard-uid-1',

    mealAmount:
      40000,

    mealEligible:
      true,

    mealBookkeepingStatus:
      GUARD_MEAL_BOOKKEEPING_STATUSES.NOT_POSTED,

    status:
      GUARD_ATTENDANCE_STATUSES.CLOSED,

    updatedAt:
      '2026-08-09T09:00:00.000Z',
  });

const mealPayload =
  createGuardMealBookkeepingPayload(
    approvedClosedSession,
    {
      paymentMethod:
        'transfer',
    },
  );

assert.equal(
  mealPayload.id,
  'guardmeal__guard-person-1__2026-08-09',
);

assert.equal(
  mealPayload.type,
  'expense',
);

assert.equal(
  mealPayload.amount,
  40000,
);

assert.equal(
  mealPayload.paymentMethod,
  'transfer',
);

assert.equal(
  mealPayload.source,
  'guardAttendanceMeal',
);

assert.equal(
  mealPayload.sourceAttendanceId,
  approvedClosedSession.id,
);

assert.equal(
  mealPayload.sourceAttendanceDate,
  '2026-08-09',
);

assert.equal(
  mealPayload.sourceGuardPersonId,
  'guard-person-1',
);

const normalizedBookkeeping =
  normalizeBookkeepingEntry(
    {
      ...mealPayload,

      createdAt:
        '2026-08-09T10:00:00.000Z',

      updatedAt:
        '2026-08-09T10:00:00.000Z',
    },
    mealPayload.id,
  );

assert.equal(
  normalizedBookkeeping.sourceAttendanceId,
  approvedClosedSession.id,
);

assert.equal(
  normalizedBookkeeping.sourceGuardPersonId,
  'guard-person-1',
);

const mealPostingPatch =
  buildGuardMealPostingPatch(
    approvedClosedSession,

    {
      uid:
        'owner-uid',
    },

    mealPayload.id,

    {
      timestamp:
        '2026-08-09T10:00:00.000Z',
    },
  );

assert.equal(
  mealPostingPatch.mealBookkeepingStatus,
  GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED,
);

assert.equal(
  mealPostingPatch.mealBookkeepingEntryId,
  mealPayload.id,
);

assert.equal(
  mealPostingPatch.mealPostedByUid,
  'owner-uid',
);

assert.throws(
  () =>
    buildGuardMealPostingPatch(
      {
        ...approvedClosedSession,

        status:
          GUARD_ATTENDANCE_STATUSES.ACTIVE,
      },

      {
        uid:
          'owner-uid',
      },

      mealPayload.id,
    ),

  /Selesaikan shift/,
);

assert.throws(
  () =>
    buildGuardMealPostingPatch(
      {
        ...approvedClosedSession,

        approvalStatus:
          GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
      },

      {
        uid:
          'owner-uid',
      },

      mealPayload.id,
    ),

  /attendance approved/,
);

assert.throws(
  () =>
    buildGuardMealPostingPatch(
      {
        ...approvedClosedSession,

        mealBookkeepingStatus:
          GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED,
      },

      {
        uid:
          'owner-uid',
      },

      mealPayload.id,
    ),

  /sudah diposting/,
);

const repositorySource =
  readFileSync(
    resolve(
      'src/services/guardAttendanceRepository.js',
    ),
    'utf8',
  );

for (
  const required
  of [
    'postGuardMealToBookkeeping',
    'buildGuardMealPostingPatch',
    'writeBatch',
    'mealBookkeepingStatus',
    'mealBookkeepingEntryId',
    'mealPostedAt',
    'mealPostedByUid',
    'guardAttendanceMeal',
  ]
) {
  assert.equal(
    repositorySource.includes(
      required,
    ),
    true,
    'Guard meal repository contract missing: ' +
      required,
  );
}

const bookkeepingSource =
  readFileSync(
    resolve(
      'src/services/bookkeepingRepository.js',
    ),
    'utf8',
  );

for (
  const required
  of [
    'sourceAttendanceId',
    'sourceAttendanceDate',
    'sourceGuardPersonId',
  ]
) {
  assert.equal(
    bookkeepingSource.includes(
      required,
    ),
    true,
  );
}

const operatorFeeSource =
  readFileSync(
    resolve(
      'src/pages/admin/OperatorFeePage.jsx',
    ),
    'utf8',
  );

assert.equal(
  operatorFeeSource.includes(
    'GuardMealReconciliationPanel',
  ),
  true,
);

const mealPanelSource =
  readFileSync(
    resolve(
      'src/components/operator-fee/GuardMealReconciliationPanel.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'Uang Makan dari Absen',
    'Post Semua Uang Makan',
    'postGuardMealToBookkeeping',
    'Menunggu Selesai Jaga',
    'Post Uang Makan',
  ]
) {
  assert.equal(
    mealPanelSource.includes(
      required,
    ),
    true,
    'Guard meal UI contract missing: ' +
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

for (
  const required
  of [
    'function adminPostsGuardMeal()',
    'function guardMealBookkeepingExistsAfter()',
    'existsAfter(entryPath)',
    "getAfter(entryPath).data.source == 'guardAttendanceMeal'",
    "request.resource.data.mealBookkeepingStatus == 'posted'",
    'request.resource.data.mealPostedByUid == request.auth.uid',
    'guardMealNotPosted(resource.data)',
    'adminPostsGuardMeal();',
    'sourceAttendanceId',
    'sourceAttendanceDate',
    'sourceGuardPersonId',
  ]
) {
  assert.equal(
    rulesSource.includes(
      required,
    ),
    true,
    'Guard meal Firestore contract missing: ' +
      required,
  );
}

const ownerAttendanceSource =
  readFileSync(
    resolve(
      'src/pages/admin/GuardAttendancePage.jsx',
    ),
    'utf8',
  );

assert.equal(
  ownerAttendanceSource.includes(
    'Uang makan sudah posted',
  ),
  true,
);

assert.equal(
  ownerAttendanceSource.includes(
    'isApproved && !isMealPosted',
  ),
  true,
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
    'guard-attendance-reliability-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'guard-meal-reconciliation-contract-test.mjs',
  ),
  true,
);

process.stdout.write(
  '✅ Guard Meal Reconciliation contract passed.\n',
);
