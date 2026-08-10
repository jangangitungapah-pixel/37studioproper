import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_OPERATOR_FEE_SETTINGS,
  OPERATOR_FEE_PERSON_ROLES,
  createEstimatedOperatorFeeLines,
} from '../src/settings/operatorFeeSettings.js';

import {
  OPERATOR_FEE_ENTRY_STATUSES,
  getCanonicalOperatorFeeEntry,
  getOperatorFeeDuplicateRuleIds,
  getOperatorFeeEntriesForBookingRule,
  makeOperatorFeeRuleEntryId,
} from '../src/services/operatorFeeRepository.js';

const booking = {
  bookingCode: 'BKG-INTEGRITY',
  date: '2026-08-11',
  durationHours: 6,
  id: 'booking-integrity',
  recordingTypeId: 'recording-track',
  recordingTypeLabel: 'Recording Track',
};

const unassignedLines = createEstimatedOperatorFeeLines({
  assignedPeopleByRole: {},
  booking,
  includeUnassigned: true,
  settings: DEFAULT_OPERATOR_FEE_SETTINGS,
});

assert.ok(
  unassignedLines.length > 0,
  'Matching fee rules must remain visible before crew assignment.',
);

assert.equal(
  unassignedLines.some((line) => line.requiresAssignment),
  true,
  'Unassigned fee rules must be explicitly marked instead of silently disappearing.',
);

const guardPerson = DEFAULT_OPERATOR_FEE_SETTINGS.people.find(
  (person) => person.role === OPERATOR_FEE_PERSON_ROLES.GUARD,
);
const operatorPerson = DEFAULT_OPERATOR_FEE_SETTINGS.people.find(
  (person) => person.role === OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
);

const assignedLines = createEstimatedOperatorFeeLines({
  assignedPeopleByRole: {
    [OPERATOR_FEE_PERSON_ROLES.GUARD]: guardPerson,
    [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR]: operatorPerson,
  },
  booking,
  includeUnassigned: true,
  settings: DEFAULT_OPERATOR_FEE_SETTINGS,
});

assert.equal(
  assignedLines.every((line) => line.requiresAssignment === false),
  true,
  'Assigned rule lines must be reviewable.',
);

const canonicalId = makeOperatorFeeRuleEntryId({
  bookingId: booking.id,
  ruleId: 'rule-1',
});

assert.equal(
  canonicalId,
  'booking-integrity__rule__rule-1',
  'New fee identity must be stable for booking + rule and independent of assignee.',
);

const legacyEntries = [
  {
    id: 'legacy-person-a',
    amount: 50000,
    bookingCode: booking.bookingCode,
    bookingId: booking.id,
    personId: 'person-a',
    personName: 'Person A',
    ruleId: 'rule-1',
    ruleName: 'Rule 1',
    status: OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
    totalAmount: 50000,
    updatedAt: '2026-08-11T01:00:00.000Z',
  },
  {
    id: 'legacy-person-b',
    amount: 50000,
    bookingCode: booking.bookingCode,
    bookingId: booking.id,
    personId: 'person-b',
    personName: 'Person B',
    ruleId: 'rule-1',
    ruleName: 'Rule 1',
    status: OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
    totalAmount: 50000,
    updatedAt: '2026-08-11T02:00:00.000Z',
  },
];

assert.equal(
  getOperatorFeeEntriesForBookingRule(
    legacyEntries,
    booking,
    'rule-1',
  ).length,
  2,
  'Legacy person-dependent duplicate entries must be detected by booking + rule.',
);

assert.equal(
  getCanonicalOperatorFeeEntry(
    legacyEntries,
    booking,
    'rule-1',
  )?.id,
  'legacy-person-b',
  'Reviewed entry must outrank Draft when selecting a canonical legacy entry.',
);

assert.deepEqual(
  getOperatorFeeDuplicateRuleIds(
    legacyEntries,
    booking,
  ),
  ['rule-1'],
  'Duplicate rule identities must be surfaced for consolidation.',
);

const postedWins = [
  ...legacyEntries,
  {
    ...legacyEntries[0],
    id: 'legacy-posted',
    personId: 'person-c',
    personName: 'Person C',
    status: OPERATOR_FEE_ENTRY_STATUSES.POSTED,
    updatedAt: '2026-08-11T03:00:00.000Z',
  },
];

assert.equal(
  getCanonicalOperatorFeeEntry(
    postedWins,
    booking,
    'rule-1',
  )?.id,
  'legacy-posted',
  'Posted snapshot must always be canonical and immutable.',
);

const pageSource = readFileSync(
  resolve('src/pages/admin/OperatorFeePage.jsx'),
  'utf8',
);

for (const required of [
  'getApprovedGuardCandidates',
  'attendanceGuardCandidates.length === 1',
  'getPersistedPersonIdForRole',
  'includeUnassigned: true',
  'requiresAssignment',
  'getCanonicalOperatorFeeEntry',
  'getOperatorFeeEntriesForBookingRule',
  'getOperatorFeeDuplicateRuleIds',
  'makeOperatorFeeRuleEntryId',
  'syncRowEntries',
  'voidOperatorFeeEntry',
  'hardPostedDuplicateRuleIds',
  'postedDriftLines',
  'postedSnapshotTotal',
  'unpostedPayableAmount',
  'row.canReconcile',
  'Duplicate Posted terdeteksi',
  'Review/Post hanya aktif jika satu booking sudah konsisten.',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'Fee ledger page integrity marker missing: ' + required,
  );
}

assert.equal(
  pageSource.includes('function getDefaultPersonId(settings, role)'),
  false,
  'Operator Fee must not silently assign the first active crew anymore.',
);

const settingsPanelSource = readFileSync(
  resolve('src/components/settings/OperatorFeeSettingsPanel.jsx'),
  'utf8',
);

for (const required of [
  'togglePersonActive',
  'toggleRuleActive',
  'Identitas tidak dihapus agar histori fee dan attendance tetap utuh',
  'Rule tidak dihapus agar histori fee tetap dapat diaudit',
  'Source of truth uang makan adalah attendance Guard',
  'Uang makan tidak dihitung ulang dari booking fee',
]) {
  assert.equal(
    settingsPanelSource.includes(required),
    true,
    'Fee Settings integrity marker missing: ' + required,
  );
}

assert.equal(
  settingsPanelSource.includes(
    'people: current.people.filter((person) => person.id !== personId)'
  ),
  false,
  'Crew identities must no longer be hard-deleted from Fee Settings.',
);

assert.equal(
  settingsPanelSource.includes(
    'rules: current.rules.filter((rule) => rule.id !== ruleId)'
  ),
  false,
  'Fee rule identities must no longer be hard-deleted from Fee Settings.',
);

const bookkeepingPageSource = readFileSync(
  resolve('src/pages/admin/BookkeepingPage.jsx'),
  'utf8',
);

assert.equal(
  bookkeepingPageSource.includes(
    "const isManualEntry = transaction.source === 'manual';"
  ),
  true,
  'Reconciled Bookkeeping entries must remain read-only in UI.',
);

const rulesSource = readFileSync(
  resolve('firestore.rules'),
  'utf8',
);

for (const required of [
  "data.source in [\n        'operatorFee',\n        'guardAttendanceMeal'",
  'operatorFeeBookkeepingBecomesPostedAfter(',
  'guardMealBookkeepingBecomesPostedAfter(',
  '!isReconciledBookkeepingSource(',
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Finance ledger security invariant missing: ' + required,
  );
}

const packageJson = JSON.parse(
  readFileSync(resolve('package.json'), 'utf8'),
);

assert.equal(
  packageJson.scripts.test.includes(
    'node scripts/fee-ledger-integrity-contract-test.mjs'
  ),
  true,
  'Fee ledger integrity contract must be registered in npm test.',
);

process.stdout.write(
  '✅ Fee Settings → Guard/Operator Fee → Bookkeeping integrity contract passed.\n',
);
