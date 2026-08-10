import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_OPERATOR_FEE_SETTINGS,
  OPERATOR_FEE_PERSON_ROLES,
  createEstimatedOperatorFeeLines,
} from '../src/settings/operatorFeeSettings.js';

import {
  isGuardFeeLineEligibleByAttendance,
} from '../src/services/guardAttendanceRepository.js';

const guardPerson = DEFAULT_OPERATOR_FEE_SETTINGS.people.find(
  (person) =>
    person.role === OPERATOR_FEE_PERSON_ROLES.GUARD ||
    person.role === OPERATOR_FEE_PERSON_ROLES.BOTH,
);

const operatorPerson = DEFAULT_OPERATOR_FEE_SETTINGS.people.find(
  (person) =>
    person.role === OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR ||
    person.role === OPERATOR_FEE_PERSON_ROLES.BOTH,
);

assert.ok(guardPerson, 'Default Guard person harus tersedia untuk regression fixture.');
assert.ok(operatorPerson, 'Default Operator person harus tersedia untuk regression fixture.');

const booking = {
  bookingCode: 'BKG-RECORDING-ESTIMATE',
  date: '2026-08-11',
  durationHours: 6,
  id: 'booking-recording-estimate',
  recordingTypeId: 'recording-track',
  recordingTypeLabel: 'Recording Track',
};

const lines = createEstimatedOperatorFeeLines({
  assignedPeopleByRole: {
    [OPERATOR_FEE_PERSON_ROLES.GUARD]: guardPerson,
    [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR]: operatorPerson,
  },
  booking,
  includeUnassigned: true,
  settings: DEFAULT_OPERATOR_FEE_SETTINGS,
});

const guardLines = lines.filter(
  (line) => line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD,
);
const operatorLines = lines.filter(
  (line) => line.payeeRole === OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
);

assert.ok(
  guardLines.length > 0,
  'Recording yang match Fee Settings harus menghasilkan estimasi fee Guard.',
);

assert.ok(
  guardLines.every((line) => Number(line.amount) > 0),
  'Nominal fee Guard harus tetap terkalkulasi sebelum attendance approved.',
);

assert.ok(
  operatorLines.length > 0,
  'Recording yang match Fee Settings harus menghasilkan estimasi fee Operator.',
);

assert.equal(
  guardLines.some((line) => isGuardFeeLineEligibleByAttendance(line, [])),
  false,
  'Tanpa attendance approved, Guard fee belum boleh dianggap payable.',
);

const totalEstimatedFromRules = lines.reduce(
  (total, line) => total + Number(line.amount || 0),
  0,
);

const payableWithoutAttendance = lines
  .filter((line) => isGuardFeeLineEligibleByAttendance(line, []))
  .reduce((total, line) => total + Number(line.amount || 0), 0);

assert.ok(
  totalEstimatedFromRules > payableWithoutAttendance,
  'Estimasi total harus dapat lebih besar dari payable total saat Guard menunggu attendance.',
);

const pageSource = readFileSync(
  resolve('src/pages/admin/OperatorFeePage.jsx'),
  'utf8',
);

for (const required of [
  'const unpostedEstimatedAmount = estimatedLines.reduce',
  'const unpostedPayableAmount = estimatedLines.reduce',
  'const blockedEstimateAmount = blockedLines.reduce',
  'const unassignedEstimateAmount = unassignedLines.reduce',
  'const totalFee = postedSnapshotAmount + unpostedEstimatedAmount;',
  "label: 'Estimasi Total'",
  'termasuk fee menunggu eligibility',
  'Guard menunggu absen',
  '!isGuardFeeLineEligibleByAttendance(line, guardSessions)',
  '!blockedLines.length',
]) {
  assert.equal(
    pageSource.includes(required),
    true,
    'Estimate/payable reconciliation marker missing: ' + required,
  );
}

assert.equal(
  pageSource.includes(
    'const totalFee = postedSnapshotAmount + unpostedPayableAmount;'
  ),
  false,
  'Row total must not hide a matched Guard fee only because attendance is still pending.',
);

assert.equal(
  pageSource.includes(
    "row.status === 'reviewed' && row.canReconcile ? 1 : 0"
  ),
  true,
  'Ready-to-post count must remain gated by reconciliation eligibility.',
);

const rulesSource = readFileSync(
  resolve('firestore.rules'),
  'utf8',
);

for (const required of [
  'operatorFeeBookkeepingBecomesPostedAfter(',
  'guardMealBookkeepingBecomesPostedAfter(',
  '!isReconciledBookkeepingSource(',
]) {
  assert.equal(
    rulesSource.includes(required),
    true,
    'Bookkeeping security invariant missing: ' + required,
  );
}

process.stdout.write(
  '✅ Operator Fee estimate vs eligibility contract passed.\n',
);
