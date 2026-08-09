const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  repository: path.join(
    ROOT,
    'src',
    'services',
    'operatorFeeRepository.js',
  ),

  page: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'OperatorFeePage.jsx',
  ),

  bookkeepingPage: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'BookkeepingPage.jsx',
  ),

  rules: path.join(
    ROOT,
    'firestore.rules',
  ),

  test: path.join(
    ROOT,
    'scripts',
    'operator-fee-posting-reconciliation-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),

  docs: path.join(
    ROOT,
    'docs',
    'operator-fee-architecture.md',
  ),
};

const staged = new Map();

function fail(message) {
  console.error('');
  console.error(
    '[phase-7a] ' +
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

function countOccurrences(
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

  const count =
    countOccurrences(
      source,
      before,
    );

  if (count !== 1) {
    fail(
      label +
        ': expected 1 anchor, found ' +
        count,
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

function replaceRangeKeepingEnd(
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
        ': range markers tidak ditemukan.',
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
    const existing =
      normalize(
        fs.readFileSync(
          file,
          'utf8',
        ),
      );

    if (
      existing ===
      normalized
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

  console.log(
    '✅ Prepared: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

/**
 * ============================================================
 * BASELINE
 * ============================================================
 */

if (
  !read(
    FILES.packageJson,
  ).includes(
    'guard-meal-reconciliation-contract-test.mjs',
  )
) {
  fail(
    'Phase 6C belum menjadi baseline.',
  );
}

if (
  !read(
    FILES.rules,
  ).includes(
    'canManageOperatorFees() ||'
  )
) {
  fail(
    'Phase 6C.1 attendance read hotfix belum ada.',
  );
}

if (
  !read(
    FILES.page,
  ).includes(
    'markOperatorFeeEntryPosted'
  )
) {
  fail(
    'Expected non-atomic Operator Fee posting baseline tidak ditemukan.',
  );
}

if (
  !read(
    FILES.rules,
  ).includes(
    'allow read, create, update, delete: if canManageOperatorFees();'
  )
) {
  fail(
    'Expected broad Operator Fee rules baseline tidak ditemukan.',
  );
}

/**
 * ============================================================
 * 1. OPERATOR FEE REPOSITORY IMPORTS
 * ============================================================
 */

replaceOnce(
  FILES.repository,

  `  setDoc,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';`,

  `  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { normalizeBookkeepingEntry } from './bookkeepingRepository.js';`,

  'atomic Operator Fee repository imports',
);

/**
 * ============================================================
 * 2. REPLACE NON-ATOMIC POST COMMAND
 * ============================================================
 */

const atomicPostingFunctions = `export function buildOperatorFeePostedPatch(
  entry,
  bookkeepingEntryId,
  postedByUid,
  {
    timestamp =
      nowIso(),
  } = {},
) {
  const record =
    normalizeOperatorFeeEntry(
      entry,
    );

  if (
    !record.id
  ) {
    throw new Error(
      'Operator fee entry ID tidak valid.',
    );
  }

  if (
    record.status ===
    OPERATOR_FEE_ENTRY_STATUSES.POSTED
  ) {
    throw new Error(
      'Operator fee ini sudah diposting.',
    );
  }

  if (
    record.status !==
    OPERATOR_FEE_ENTRY_STATUSES.REVIEWED
  ) {
    throw new Error(
      'Operator fee harus Reviewed sebelum diposting.',
    );
  }

  const cleanBookkeepingEntryId =
    cleanText(
      bookkeepingEntryId,
    );

  const cleanPostedByUid =
    cleanText(
      postedByUid,
    );

  if (
    !cleanBookkeepingEntryId
  ) {
    throw new Error(
      'Bookkeeping entry ID tidak valid.',
    );
  }

  if (
    !cleanPostedByUid
  ) {
    throw new Error(
      'Identitas user posting tidak valid.',
    );
  }

  return {
    postedAt:
      timestamp,

    postedBookkeepingEntryId:
      cleanBookkeepingEntryId,

    postedByUid:
      cleanPostedByUid,

    status:
      OPERATOR_FEE_ENTRY_STATUSES.POSTED,

    updatedAt:
      timestamp,
  };
}

export async function postOperatorFeeEntryToBookkeeping(
  entry,
  booking = {},
  postedByUid = '',
) {
  if (
    !isFirebaseConfigured ||
    !firestoreDb
  ) {
    throw new Error(
      'Firebase belum dikonfigurasi.',
    );
  }

  const record =
    normalizeOperatorFeeEntry(
      entry,
    );

  const timestamp =
    nowIso();

  const bookkeepingPayload =
    createOperatorFeeBookkeepingPayload(
      record,
      booking,
    );

  const bookkeepingEntry =
    normalizeBookkeepingEntry(
      {
        ...bookkeepingPayload,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,
      },
      bookkeepingPayload.id,
    );

  const postingPatch =
    buildOperatorFeePostedPatch(
      record,
      bookkeepingEntry.id,
      postedByUid,
      {
        timestamp,
      },
    );

  const batch =
    writeBatch(
      firestoreDb,
    );

  batch.set(
    doc(
      firestoreDb,
      'bookkeepingEntries',
      bookkeepingEntry.id,
    ),
    bookkeepingEntry,
  );

  batch.update(
    doc(
      firestoreDb,
      OPERATOR_FEE_ENTRIES_COLLECTION,
      record.id,
    ),
    postingPatch,
  );

  await batch.commit();

  return {
    bookkeepingEntry,

    operatorFeeEntry:
      normalizeOperatorFeeEntry({
        ...record,
        ...postingPatch,
      }),
  };
}

`;

replaceRangeKeepingEnd(
  FILES.repository,

  'export async function markOperatorFeeEntryPosted(',

  'export async function voidOperatorFeeEntry(',

  atomicPostingFunctions,

  'replace non-atomic Operator Fee post command',
);

/**
 * ============================================================
 * 3. REPOSITORY EXPORT
 * ============================================================
 */

replaceOnce(
  FILES.repository,

  `  createOperatorFeeBookkeepingPayload,
  deleteOperatorFeeEntry,
  markOperatorFeeEntryPosted,
  markOperatorFeeEntryReviewed,`,

  `  buildOperatorFeePostedPatch,
  createOperatorFeeBookkeepingPayload,
  deleteOperatorFeeEntry,
  markOperatorFeeEntryReviewed,
  postOperatorFeeEntryToBookkeeping,`,

  'Operator Fee atomic exports',
);

/**
 * ============================================================
 * 4. OPERATOR FEE PAGE IMPORTS
 * ============================================================
 */

replaceOnce(
  FILES.page,

  `import { createBookkeepingEntry } from '../../services/bookkeepingRepository.js';
`,

  '',

  'remove direct Bookkeeping write from Operator Fee page',
);

replaceOnce(
  FILES.page,

  `  OPERATOR_FEE_ENTRIES_COLLECTION,
  OPERATOR_FEE_ENTRY_STATUSES,
  createOperatorFeeBookkeepingPayload,
  markOperatorFeeEntryPosted,
  markOperatorFeeEntryReviewed,`,

  `  OPERATOR_FEE_ENTRIES_COLLECTION,
  OPERATOR_FEE_ENTRY_STATUSES,
  markOperatorFeeEntryReviewed,
  postOperatorFeeEntryToBookkeeping,`,

  'Operator Fee page atomic posting import',
);

/**
 * ============================================================
 * 5. SINGLE POST FLOW
 * ============================================================
 */

replaceOnce(
  FILES.page,

  `      for (const entry of reviewedEntries) {
        const bookkeepingPayload = createOperatorFeeBookkeepingPayload(entry, row.booking);
        const bookkeepingEntry = await createBookkeepingEntry(bookkeepingPayload);
        await markOperatorFeeEntryPosted(entry, bookkeepingEntry, currentUser?.uid || '');
        createdEntries.push(bookkeepingEntry);
      }`,

  `      for (const entry of reviewedEntries) {
        const result =
          await postOperatorFeeEntryToBookkeeping(
            entry,
            row.booking,
            currentUser?.uid || '',
          );

        createdEntries.push(
          result.bookkeepingEntry,
        );
      }`,

  'single Operator Fee atomic posting flow',
);

/**
 * ============================================================
 * 6. BULK POST FLOW
 * ============================================================
 */

replaceOnce(
  FILES.page,

  `        for (const entry of reviewedEntries) {
          const bookkeepingPayload = createOperatorFeeBookkeepingPayload(entry, row.booking);
          const bookkeepingEntry = await createBookkeepingEntry(bookkeepingPayload);
          await markOperatorFeeEntryPosted(entry, bookkeepingEntry, currentUser?.uid || '');
          postedCount += 1;
        }`,

  `        for (const entry of reviewedEntries) {
          await postOperatorFeeEntryToBookkeeping(
            entry,
            row.booking,
            currentUser?.uid || '',
          );

          postedCount += 1;
        }`,

  'bulk Operator Fee atomic posting flow',
);

/**
 * ============================================================
 * 7. FIRESTORE OPERATOR FEE DOMAIN VALIDATION
 * ============================================================
 */

const operatorFeeRules = `    function validOperatorFeeEntry(
      data,
      entryId
    ) {
      return data.keys().hasOnly([
          'id',
          'amount',
          'bookingCode',
          'bookingDate',
          'bookingId',
          'calculationMode',
          'durationHours',
          'mealAmount',
          'note',
          'overtimeAmount',
          'payeeRole',
          'paymentMethod',
          'personId',
          'personName',
          'postedAt',
          'postedBookkeepingEntryId',
          'postedByUid',
          'ruleId',
          'ruleName',
          'serviceLabel',
          'sourcePricingId',
          'sourcePricingLabel',
          'sourcePricingType',
          'status',
          'title',
          'totalAmount',
          'createdAt',
          'updatedAt'
        ]) &&
        data.id == entryId &&
        validNumber(data.amount, 0, 1000000000) &&
        validString(data.bookingCode, 0, 160) &&
        validString(data.bookingDate, 0, 40) &&
        validString(data.bookingId, 0, 160) &&
        validString(data.calculationMode, 1, 80) &&
        validNumber(data.durationHours, 0, 1000) &&
        validNumber(data.mealAmount, 0, 1000000000) &&
        validString(data.note, 0, 2000) &&
        validNumber(data.overtimeAmount, 0, 1000000000) &&
        data.payeeRole in ['guard', 'recording_operator'] &&
        validString(data.paymentMethod, 1, 80) &&
        validString(data.personId, 0, 160) &&
        validString(data.personName, 1, 160) &&
        validString(data.postedAt, 0, 40) &&
        validString(data.postedBookkeepingEntryId, 0, 240) &&
        validString(data.postedByUid, 0, 128) &&
        validString(data.ruleId, 0, 240) &&
        validString(data.ruleName, 1, 240) &&
        validString(data.serviceLabel, 0, 240) &&
        validString(data.sourcePricingId, 0, 240) &&
        validString(data.sourcePricingLabel, 0, 240) &&
        validString(data.sourcePricingType, 0, 80) &&
        data.status in ['draft', 'reviewed', 'posted', 'void'] &&
        validString(data.title, 1, 240) &&
        validNumber(data.totalAmount, 0, 1000000000) &&
        validIsoTimestampString(data.createdAt) &&
        validIsoTimestampString(data.updatedAt);
    }

    function operatorFeePostedFieldsAreClear(
      data
    ) {
      return data.postedAt == '' &&
        data.postedBookkeepingEntryId == '' &&
        data.postedByUid == '';
    }

    function operatorFeeCreatesNonPosted(
      entryId
    ) {
      return canManageOperatorFees() &&
        validOperatorFeeEntry(
          request.resource.data,
          entryId
        ) &&
        request.resource.data.status in [
          'draft',
          'reviewed'
        ] &&
        operatorFeePostedFieldsAreClear(
          request.resource.data
        );
    }

    function operatorFeeUpdatesNonPosted(
      entryId
    ) {
      return canManageOperatorFees() &&
        validOperatorFeeEntry(
          request.resource.data,
          entryId
        ) &&
        resource.data.status != 'posted' &&
        request.resource.data.status in [
          'draft',
          'reviewed',
          'void'
        ] &&
        operatorFeePostedFieldsAreClear(
          request.resource.data
        );
    }

    function operatorFeeBookkeepingExistsAfter(
      entryId
    ) {
      let bookkeepingId =
        request.resource.data.postedBookkeepingEntryId;

      let bookkeepingPath =
        /databases/$(database)/documents/bookkeepingEntries/$(bookkeepingId);

      return bookkeepingId is string &&
        bookkeepingId.size() > 0 &&
        existsAfter(bookkeepingPath) &&
        getAfter(bookkeepingPath).data.id ==
          bookkeepingId &&
        getAfter(bookkeepingPath).data.type ==
          'expense' &&
        getAfter(bookkeepingPath).data.source ==
          'operatorFee' &&
        getAfter(bookkeepingPath).data.sourceFeeEntryId ==
          entryId &&
        getAfter(bookkeepingPath).data.sourceBookingId ==
          resource.data.bookingId &&
        getAfter(bookkeepingPath).data.amount ==
          resource.data.totalAmount;
    }

    function adminPostsOperatorFee(
      entryId
    ) {
      return canManageOperatorFees() &&
        validOperatorFeeEntry(
          request.resource.data,
          entryId
        ) &&
        resource.data.status == 'reviewed' &&
        request.resource.data.status == 'posted' &&
        request.resource.data.postedAt != '' &&
        request.resource.data.postedBookkeepingEntryId != '' &&
        request.resource.data.postedByUid ==
          request.auth.uid &&
        request.resource.data
          .diff(resource.data)
          .affectedKeys()
          .hasOnly([
            'postedAt',
            'postedBookkeepingEntryId',
            'postedByUid',
            'status',
            'updatedAt'
          ]) &&
        operatorFeeBookkeepingExistsAfter(
          entryId
        );
    }

    match /operatorFeeEntries/{entryId} {
      allow read: if canManageOperatorFees();

      allow create:
        if operatorFeeCreatesNonPosted(
          entryId
        );

      allow update:
        if operatorFeeUpdatesNonPosted(
          entryId
        ) ||
        adminPostsOperatorFee(
          entryId
        );

      allow delete:
        if canManageOperatorFees() &&
        resource.data.status != 'posted';
    }
`;

replaceOnce(
  FILES.rules,

  `    match /operatorFeeEntries/{entryId} {
      allow read, create, update, delete: if canManageOperatorFees();
    }
`,

  operatorFeeRules,

  'Operator Fee Firestore lifecycle rules',
);

/**
 * ============================================================
 * 8. BOOKKEEPING SOURCE VALIDATION
 * ============================================================
 */

replaceOnce(
  FILES.rules,

  `    function validGuardMealBookkeepingSource(data) {`,

  `    function validOperatorFeeBookkeepingSource(data) {
      return data.source != 'operatorFee' || (
        data.keys().hasAll([
          'sourceBookingId',
          'sourceFeeEntryId'
        ]) &&
        validString(
          data.sourceBookingId,
          1,
          160
        ) &&
        validString(
          data.sourceFeeEntryId,
          1,
          240
        )
      );
    }

    function validGuardMealBookkeepingSource(data) {`,

  'Operator Fee bookkeeping source validation',
);

replaceOnce(
  FILES.rules,

  `        validIsoTimestampString(data.createdAt) &&
        validIsoTimestampString(data.updatedAt) &&
        validGuardMealBookkeepingSource(data);`,

  `        validIsoTimestampString(data.createdAt) &&
        validIsoTimestampString(data.updatedAt) &&
        validOperatorFeeBookkeepingSource(data) &&
        validGuardMealBookkeepingSource(data);`,

  'register Operator Fee bookkeeping validation',
);

/**
 * ============================================================
 * 9. RECIPROCAL ATOMIC LINK + AUTO SOURCE LOCK
 * ============================================================
 */

const reconciliationRules = `    function isReconciledBookkeepingSource(
      data
    ) {
      return data.source in [
        'operatorFee',
        'guardAttendanceMeal'
      ];
    }

    function operatorFeeBookkeepingBecomesPostedAfter(
      data
    ) {
      let feeEntryId =
        data.sourceFeeEntryId;

      let feePath =
        /databases/$(database)/documents/operatorFeeEntries/$(feeEntryId);

      return data.source != 'operatorFee' || (
        feeEntryId is string &&
        feeEntryId.size() > 0 &&
        existsAfter(feePath) &&
        getAfter(feePath).data.status ==
          'posted' &&
        getAfter(feePath).data.postedBookkeepingEntryId ==
          data.id &&
        getAfter(feePath).data.bookingId ==
          data.sourceBookingId &&
        getAfter(feePath).data.totalAmount ==
          data.amount &&
        (
          !exists(feePath) ||
          get(feePath).data.status !=
            'posted'
        )
      );
    }

    function guardMealBookkeepingBecomesPostedAfter(
      data
    ) {
      let attendanceId =
        data.sourceAttendanceId;

      let attendancePath =
        /databases/$(database)/documents/guardAttendanceSessions/$(attendanceId);

      return data.source != 'guardAttendanceMeal' || (
        attendanceId is string &&
        attendanceId.size() > 0 &&
        existsAfter(attendancePath) &&
        getAfter(attendancePath).data.mealBookkeepingStatus ==
          'posted' &&
        getAfter(attendancePath).data.mealBookkeepingEntryId ==
          data.id &&
        getAfter(attendancePath).data.date ==
          data.sourceAttendanceDate &&
        getAfter(attendancePath).data.guardPersonId ==
          data.sourceGuardPersonId &&
        getAfter(attendancePath).data.mealAmount ==
          data.amount &&
        (
          !exists(attendancePath) ||
          !(
            'mealBookkeepingStatus' in
            get(attendancePath).data
          ) ||
          get(attendancePath).data.mealBookkeepingStatus !=
            'posted'
        )
      );
    }

    function reconciledBookkeepingWriteAllowed(
      data
    ) {
      return operatorFeeBookkeepingBecomesPostedAfter(
          data
        ) &&
        guardMealBookkeepingBecomesPostedAfter(
          data
        );
    }

`;

replaceOnce(
  FILES.rules,

  `    match /bookkeepingEntries/{entryId} {`,

  reconciliationRules +
    `    match /bookkeepingEntries/{entryId} {`,

  'atomic bookkeeping reconciliation helpers',
);

/**
 * ============================================================
 * 10. BOOKKEEPING WRITE BOUNDARY
 * ============================================================
 */

replaceOnce(
  FILES.rules,

  `    match /bookkeepingEntries/{entryId} {
      allow read: if isApproved() && canAccessBookkeepingData();
      allow create, update: if isApprovedAdmin() &&
        (canAccessBookkeepingData() || hasPermission('operator-fee')) &&
        validBookkeepingEntry(request.resource.data, entryId);
      allow delete: if isApprovedAdmin() && canAccessBookkeepingData();
    }`,

  `    match /bookkeepingEntries/{entryId} {
      allow read:
        if isApproved() &&
        canAccessBookkeepingData();

      allow create:
        if isApprovedAdmin() &&
        (
          canAccessBookkeepingData() ||
          hasPermission('operator-fee')
        ) &&
        validBookkeepingEntry(
          request.resource.data,
          entryId
        ) &&
        reconciledBookkeepingWriteAllowed(
          request.resource.data
        );

      allow update:
        if isApprovedAdmin() &&
        (
          canAccessBookkeepingData() ||
          hasPermission('operator-fee')
        ) &&
        validBookkeepingEntry(
          request.resource.data,
          entryId
        ) &&
        (
          (
            !isReconciledBookkeepingSource(
              resource.data
            ) &&
            !isReconciledBookkeepingSource(
              request.resource.data
            )
          ) ||
          (
            resource.data.source ==
              request.resource.data.source &&
            reconciledBookkeepingWriteAllowed(
              request.resource.data
            )
          )
        );

      allow delete:
        if isApprovedAdmin() &&
        canAccessBookkeepingData() &&
        !isReconciledBookkeepingSource(
          resource.data
        );
    }`,

  'lock reconciled bookkeeping sources',
);

/**
 * ============================================================
 * 11. CONTRACT TEST
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
    "data.source in [\\n        'operatorFee',\\n        'guardAttendanceMeal'",
    'resource.data.status != \\'posted\\'',
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
    '!isReconciledBookkeepingSource(\\n          resource.data\\n        )'
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
  '✅ Operator Fee Posting Reconciliation contract passed.\\n',
);
`;

stageNewFile(
  FILES.test,
  testSource,
);

/**
 * ============================================================
 * 12. PACKAGE TEST PIPELINE
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

const previousGate =
  'node scripts/guard-meal-reconciliation-contract-test.mjs';

const phase7a =
  'node scripts/operator-fee-posting-reconciliation-contract-test.mjs';

const commands =
  packageJson
    .scripts
    .test
    .split(
      '&&',
    )
    .map(
      (
        command,
      ) =>
        command.trim(),
    )
    .filter(
      Boolean,
    );

if (
  !commands.includes(
    previousGate,
  )
) {
  fail(
    'Phase 6C contract hilang dari npm test.',
  );
}

if (
  !commands.includes(
    phase7a,
  )
) {
  packageJson.scripts.test =
    [
      ...commands,
      phase7a,
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
 * 13. ARCHITECTURE DOC
 * ============================================================
 */

const docsMarker =
  '## OPF-5B - Atomic Posting Reconciliation';

let docs =
  read(
    FILES.docs,
  );

if (
  !docs.includes(
    docsMarker,
  )
) {
  docs =
    docs.trimEnd() +
    `

## OPF-5B - Atomic Posting Reconciliation

Booking-based Operator Fee posting is now reconciled atomically:

\`\`\`txt
reviewed operator fee
-> Firestore batch
   -> bookkeepingEntries/opfee__...
   -> operatorFeeEntries status = posted
\`\`\`

Financial guardrails:

\`\`\`txt
1. Bookkeeping expense and posted fee state succeed or fail together.
2. Posted Operator Fee entries are immutable from normal fee mutation flow.
3. Auto-generated bookkeeping sources operatorFee and guardAttendanceMeal cannot be manually deleted.
4. Auto-generated bookkeeping updates require their source document to transition to posted in the same atomic write.
5. Manual bookkeeping entries remain editable/deletable.
\`\`\`
`;

  stage(
    FILES.docs,
    docs,
  );
}

/**
 * ============================================================
 * FINAL VALIDATION
 * ============================================================
 */

const nextRepository =
  read(
    FILES.repository,
  );

for (
  const required
  of [
    'writeBatch',
    'postOperatorFeeEntryToBookkeeping',
    'buildOperatorFeePostedPatch',
  ]
) {
  if (
    !nextRepository.includes(
      required,
    )
  ) {
    fail(
      'Atomic Operator Fee core kehilangan: ' +
        required,
    );
  }
}

if (
  nextRepository.includes(
    'export async function markOperatorFeeEntryPosted'
  )
) {
  fail(
    'Non-atomic Operator Fee posted command masih ada.',
  );
}

const nextPage =
  read(
    FILES.page,
  );

for (
  const forbidden
  of [
    'createBookkeepingEntry',
    'markOperatorFeeEntryPosted',
    'createOperatorFeeBookkeepingPayload',
  ]
) {
  if (
    nextPage.includes(
      forbidden,
    )
  ) {
    fail(
      'Operator Fee page masih melakukan direct/non-atomic write: ' +
        forbidden,
    );
  }
}

if (
  !nextPage.includes(
    'postOperatorFeeEntryToBookkeeping'
  )
) {
  fail(
    'Operator Fee page belum memakai atomic posting command.',
  );
}

const nextRules =
  read(
    FILES.rules,
  );

for (
  const required
  of [
    'function adminPostsOperatorFee(',
    'function reconciledBookkeepingWriteAllowed(',
    'function operatorFeeBookkeepingBecomesPostedAfter(',
    'function guardMealBookkeepingBecomesPostedAfter(',
  ]
) {
  if (
    !nextRules.includes(
      required,
    )
  ) {
    fail(
      'Finance reconciliation rule kehilangan: ' +
        required,
    );
  }
}

/**
 * ============================================================
 * WRITE ONLY AFTER ALL VALIDATION PASSES
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
    '[phase-7a] Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ Phase 7A Atomic Crew Expense Reconciliation prepared.',
);
console.log('');
console.log('Operator Fee posting:');
console.log('  reviewed fee');
console.log('  -> atomic bookkeeping + posted state');
console.log('');
console.log('Reconciled bookkeeping:');
console.log('  operatorFee = locked');
console.log('  guardAttendanceMeal = locked');
console.log('  manual = editable/deletable');
console.log('');
console.log(
  'Firestore rules deployment required.',
);