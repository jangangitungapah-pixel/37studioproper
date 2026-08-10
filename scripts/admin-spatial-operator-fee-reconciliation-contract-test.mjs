import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/OperatorFeePage.jsx'), 'utf8');
const mealPanelSource = readFileSync(
  resolve('src/components/operator-fee/GuardMealReconciliationPanel.jsx'),
  'utf8',
);
const cssSource = readFileSync(resolve('src/styles/modules/operator-fee.css'), 'utf8');
const repositorySource = readFileSync(resolve('src/services/operatorFeeRepository.js'), 'utf8');
const settingsSource = readFileSync(resolve('src/settings/operatorFeeSettings.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  'data-operator-fee-ui="ui-8-spatial"',
  'OperatorFeeEditorialHeader',
  'OperatorFeePulse',
  'OperatorFeeBulkActions',
  'OperatorFeeCommandShelf',
  'OperatorFeeLedgerState',
  'getStatusLabel',
  'getStatusTone',
  'operator-fee-ledger-header',
  'operator-fee-ledger-columns',
  'operator-fee-queue-detail',
  'GuardMealReconciliationPanel',
  'isQueueLoading',
  'queueLoadError',
  'loadingState.guardSessions',
  'loadErrors.guardSessions',
  "row.status === 'posted'",
  "statusFilter !== 'attention'",
  'Review Semua',
  'Post Reviewed',
  'Simpan Draft',
  'Mark Reviewed',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-8 page contract missing: ' + required);
}

for (const required of [
  'subscribeManualBookings',
  'subscribeOperatorFeeEntries',
  'subscribeGuardAttendanceSessions',
  'isGuardFeeLineEligibleByAttendance',
  'createEstimatedOperatorFeeLines',
  'upsertOperatorFeeEntry',
  'voidOperatorFeeEntry',
  'getCanonicalOperatorFeeEntry',
  'getOperatorFeeDuplicateRuleIds',
  'makeOperatorFeeRuleEntryId',
  'syncRowEntries',
  'includeUnassigned: true',
  'postOperatorFeeEntryToBookkeeping',
  "hasAdminPagePermission(currentUser, 'operator-fee')",
  'reviewMany',
  'postMany',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-8 preserved behavior missing: ' + required);
}

for (const forbidden of [
  'createBookkeepingEntry',
  'markOperatorFeeEntryPosted',
  'createOperatorFeeBookkeepingPayload',
]) {
  assert.equal(
    pageSource.includes(forbidden),
    false,
    'UI-8 page must not own accounting write: ' + forbidden,
  );
}

for (const required of [
  'operator-fee-meal-surface',
  'GuardMealState',
  'Uang Makan dari Absen',
  'Post Semua Uang Makan',
  'postGuardMealToBookkeeping',
  'Menunggu Selesai Jaga',
  'Post Uang Makan',
  'GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED',
  'GUARD_ATTENDANCE_STATUSES.CLOSED',
  'GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED',
]) {
  assert.equal(mealPanelSource.includes(required), true, 'UI-8 meal contract missing: ' + required);
}

for (const required of [
  'UI-8 — Spatial Operator Fee Reconciliation Workspace',
  ".operator-fee-queue[data-operator-fee-ui='ui-8-spatial']",
  '.operator-fee-editorial-header',
  '.operator-fee-pulse',
  '.operator-fee-bulk-actions',
  '.operator-fee-command-shelf',
  '.operator-fee-ledger-header',
  '.operator-fee-ledger-state.is-error',
  '.operator-fee-queue-row.is-posted',
  '.operator-fee-meal-surface',
  '.operator-fee-meal-state.is-error',
  "html[data-admin-theme-active='true'][data-theme='dark']",
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-8 CSS contract missing: ' + required);
}

for (const required of [
  'UI-8 Visual QA — compact mobile operations',
  '.operator-fee-pulse-metric:nth-child(2n)',
  '.operator-fee-pulse-metric:nth-last-child(-n + 2)',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'grid-template-columns: repeat(3, minmax(0, 1fr))',
  '.operator-fee-meal-pulse em { overflow: visible; text-overflow: clip; white-space: normal; }',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-8 mobile visual QA contract missing: ' + required);
}

const ui8Css = cssSource.slice(
  cssSource.indexOf('UI-8 — Spatial Operator Fee Reconciliation Workspace'),
);

for (const token of [
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-text-primary',
  '--studio-text-secondary',
  '--studio-text-tertiary',
  '--studio-edge-soft',
  '--studio-accent',
  '--studio-shadow-surface',
  '--studio-success',
  '--studio-warning',
  '--studio-info',
]) {
  assert.equal(ui8Css.includes(token), true, 'UI-8 semantic token missing: ' + token);
}

assert.equal(ui8Css.includes('--auth-'), false, 'UI-8 spatial layer must not depend on legacy auth tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(ui8Css), false, 'UI-8 spatial layer must not add raw hex colors.');

for (const required of [
  "DRAFT: 'draft'",
  "REVIEWED: 'reviewed'",
  "POSTED: 'posted'",
  "VOID: 'void'",
  'buildOperatorFeePostedPatch',
  'postOperatorFeeEntryToBookkeeping',
  'writeBatch',
  'await batch.commit()',
  'markOperatorFeeEntryReviewed',
  'voidOperatorFeeEntry',
]) {
  assert.equal(repositorySource.includes(required), true, 'UI-8 repository contract missing: ' + required);
}

for (const required of [
  'createEstimatedOperatorFeeLines',
  'formatOperatorFeeCurrency',
  'OPERATOR_FEE_PERSON_ROLES',
]) {
  assert.equal(settingsSource.includes(required), true, 'UI-8 calculation contract missing: ' + required);
}

for (const testFile of [
  'operator-fee-mapping-test.mjs',
  'guard-meal-reconciliation-contract-test.mjs',
  'operator-fee-posting-reconciliation-contract-test.mjs',
  'operator-fee-booking-visibility-contract-test.mjs',
  'admin-spatial-operator-fee-reconciliation-contract-test.mjs',
]) {
  assert.equal(packageJson.scripts.test.includes(testFile), true, 'UI-8 npm test registration missing: ' + testFile);
}

process.stdout.write('✅ Admin Spatial Operator Fee Reconciliation UI-8 contract passed.\n');
