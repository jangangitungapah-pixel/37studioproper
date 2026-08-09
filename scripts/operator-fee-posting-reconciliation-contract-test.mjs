import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  OPERATOR_FEE_ENTRY_STATUSES,
  buildOperatorFeePostedPatch,
  createOperatorFeeBookkeepingPayload,
  normalizeOperatorFeeEntry,
} from '../src/services/operatorFeeRepository.js';

const reviewedEntry =
  normalizeOperatorFeeEntry({
    id:
      'booking-1__crew-1__rule-1',

    amount:
      50000,

    bookingCode:
      'BKG-001',

    bookingDate:
      '2026-08-09',

    bookingId:
      'booking-1',

    calculationMode:
      'flat',

    durationHours:
      6,

    mealAmount:
      0,

    note:
      '',

    overtimeAmount:
      0,

    payeeRole:
      'recording_operator',

    paymentMethod:
      'transfer',

    personId:
      'crew-1',

    personName:
      'Operator Test',

    postedAt:
      '',

    postedBookkeepingEntryId:
      '',

    postedByUid:
      '',

    ruleId:
      'rule-1',

    ruleName:
      'Recording Operator',

    serviceLabel:
      'Recording Track',

    sourcePricingId:
      'recording-track',

    sourcePricingLabel:
      'Recording Track',

    sourcePricingType:
      'recordingType',

    status:
      OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,

    title:
      'Operator Fee - Operator Test',

    totalAmount:
      50000,

    createdAt:
      '2026-08-09T01:00:00.000Z',

    updatedAt:
      '2026-08-09T01:00:00.000Z',
  });

const bookkeepingPayload =
  createOperatorFeeBookkeepingPayload(
    reviewedEntry,
    {
      id:
        'booking-1',

      date:
        '2026-08-09',
    },
  );

assert.equal(
  bookkeepingPayload.id,
  'opfee__booking-1__crew-1__rule-1',
);

assert.equal(
  bookkeepingPayload.source,
  'operatorFee',
);

assert.equal(
  bookkeepingPayload.sourceFeeEntryId,
  reviewedEntry.id,
);

assert.equal(
  bookkeepingPayload.sourceBookingId,
  'booking-1',
);

assert.equal(
  bookkeepingPayload.amount,
  50000,
);

const postedPatch =
  buildOperatorFeePostedPatch(
    reviewedEntry,
    bookkeepingPayload.id,
    'admin-uid',
    {
      timestamp:
        '2026-08-09T10:00:00.000Z',
    },
  );

assert.equal(
  postedPatch.status,
  OPERATOR_FEE_ENTRY_STATUSES.POSTED,
);

assert.equal(
  postedPatch.postedBookkeepingEntryId,
  bookkeepingPayload.id,
);

assert.equal(
  postedPatch.postedByUid,
  'admin-uid',
);

assert.throws(
  () =>
    buildOperatorFeePostedPatch(
      {
        ...reviewedEntry,

        status:
          OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
      },
      bookkeepingPayload.id,
      'admin-uid',
    ),

  /harus Reviewed/,
);

assert.throws(
  () =>
    buildOperatorFeePostedPatch(
      {
        ...reviewedEntry,

        status:
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      },
      bookkeepingPayload.id,
      'admin-uid',
    ),

  /sudah diposting/,
);

const repositorySource =
  readFileSync(
    resolve(
      'src/services/operatorFeeRepository.js',
    ),
    'utf8',
  );

for (
  const required
  of [
    'writeBatch',
    'postOperatorFeeEntryToBookkeeping',
    'buildOperatorFeePostedPatch',
    "batch.set(",
    "batch.update(",
  ]
) {
  assert.equal(
    repositorySource.includes(
      required,
    ),
    true,
    'Atomic Operator Fee repository contract missing: ' +
      required,
  );
}

assert.equal(
  repositorySource.includes(
    'export async function markOperatorFeeEntryPosted'
  ),
  false,
  'Non-atomic posted command must be removed.',
);

const pageSource =
  readFileSync(
    resolve(
      'src/pages/admin/OperatorFeePage.jsx',
    ),
    'utf8',
  );

assert.equal(
  pageSource.includes(
    'postOperatorFeeEntryToBookkeeping'
  ),
  true,
);

for (
  const forbidden
  of [
    'createBookkeepingEntry',
    'markOperatorFeeEntryPosted',
    'createOperatorFeeBookkeepingPayload',
  ]
) {
  assert.equal(
    pageSource.includes(
      forbidden,
    ),
    false,
    'Operator Fee page still owns a non-atomic write: ' +
      forbidden,
  );
}

const bookkeepingPageSource =
  readFileSync(
    resolve(
      'src/pages/admin/BookkeepingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  bookkeepingPageSource.includes(
    "const isManualEntry = transaction.source === 'manual';"
  ),
  true,
  'Bookkeeping UI must continue exposing edit/delete only for manual entries.',
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
    'function validOperatorFeeEntry(',
    'function adminPostsOperatorFee(',
    'function operatorFeeBookkeepingExistsAfter(',
    'function operatorFeeBookkeepingBecomesPostedAfter(',
    'function guardMealBookkeepingBecomesPostedAfter(',
    'function reconciledBookkeepingWriteAllowed(',
    "data.source in [\n        'operatorFee',\n        'guardAttendanceMeal'",
    'resource.data.status != \'posted\'',
  ]
) {
  assert.equal(
    rulesSource.includes(
      required,
    ),
    true,
    'Finance reconciliation rule missing: ' +
      required,
  );
}

assert.equal(
  rulesSource.includes(
    'allow read, create, update, delete: if canManageOperatorFees();'
  ),
  false,
  'Operator Fee entries must no longer use unrestricted CRUD rules.',
);

assert.equal(
  rulesSource.includes(
    '!isReconciledBookkeepingSource(\n          resource.data\n        )'
  ),
  true,
  'Reconciled bookkeeping delete must remain blocked.',
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
    'guard-meal-reconciliation-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'operator-fee-posting-reconciliation-contract-test.mjs',
  ),
  true,
);

process.stdout.write(
  '✅ Operator Fee Posting Reconciliation contract passed.\n',
);
