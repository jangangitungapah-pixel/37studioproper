import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = readFileSync(resolve('src/pages/admin/BookkeepingPage.jsx'), 'utf8');
const cssSource = readFileSync(resolve('src/styles/modules/bookkeeping.css'), 'utf8');
const repositorySource = readFileSync(resolve('src/services/bookkeepingRepository.js'), 'utf8');
const accountingSource = readFileSync(resolve('src/utils/bookingPaymentUtils.js'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const required of [
  "data-bookkeeping-ui=\"ui-7-spatial\"",
  'BookkeepingEditorialHeader',
  'BookkeepingSummary',
  'BookkeepingToolbar',
  'BookkeepingTransactionLedger',
  'bookkeeping-ledger-surface',
  'bookkeeping-ledger-group',
  'bookkeeping-source-badge',
  'getTransactionSourceMeta',
  "source === 'booking-refund'",
  "source === 'operatorFee'",
  "source === 'guardAttendanceMeal'",
  "const isManualEntry = transaction.source === 'manual';",
  'isBookingsLoading',
  'isEntriesLoading',
  'bookingLoadError',
  'entriesLoadError',
  '<Dialog.Root open',
  '<Dialog.Overlay className="bookkeeping-modal-backdrop"',
  '<Dialog.Content className="bookkeeping-modal-panel"',
  'downloadBookkeepingXlsx',
  'PaginationControls',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-7 page contract missing: ' + required);
}

for (const required of [
  'UI-7 — Spatial Bookkeeping Ledger',
  ".bookkeeping-page[data-bookkeeping-ui='ui-7-spatial']",
  '.bookkeeping-editorial-header',
  '.bookkeeping-finance-pulse',
  '.bookkeeping-command-shelf',
  '.bookkeeping-ledger-surface',
  '.bookkeeping-ledger-columns',
  '.bookkeeping-source-badge.is-reconciled',
  '.bookkeeping-ledger-state.is-error',
  "html[data-admin-theme-active='true'][data-theme='dark']",
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
  '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) {
  assert.equal(cssSource.includes(required), true, 'UI-7 CSS contract missing: ' + required);
}

for (const token of [
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-text-primary',
  '--studio-text-secondary',
  '--studio-text-tertiary',
  '--studio-edge-soft',
  '--studio-accent',
  '--studio-shadow-surface',
]) {
  assert.equal(cssSource.includes(token), true, 'UI-7 semantic token missing: ' + token);
}

assert.equal(cssSource.includes('--auth-'), false, 'UI-7 CSS must not depend on legacy auth tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(cssSource), false, 'UI-7 CSS must not add raw hex colors.');

for (const required of [
  'buildBookingFinanceTransactions',
  'getBookingOutstandingAmount',
  'adminBookingRepository.subscribeManualBookings',
  'bookkeepingRepository.subscribeBookkeepingEntries',
  'bookkeepingRepository.createBookkeepingEntry',
  'bookkeepingRepository.updateBookkeepingEntry',
  'bookkeepingRepository.deleteBookkeepingEntry',
  '{ limitCount: 150 }',
  'getPaginationSlice',
]) {
  assert.equal(pageSource.includes(required), true, 'UI-7 preserved behavior missing: ' + required);
}

assert.equal(pageSource.includes('buildBookingIncomeTransactions'), false, 'UI-7 must keep the combined finance transaction builder.');
assert.equal(pageSource.includes('function getBookingPaymentHistory(booking)'), false, 'UI-7 must not duplicate accounting history.');
assert.equal(pageSource.includes('booking?.paidAmount || booking?.dpAmount'), false, 'UI-7 must not infer paid amount independently.');
assert.equal(pageSource.includes('function formatShortDate(value)'), false, 'UI-7 must not keep the unused legacy date formatter.');

for (const required of [
  'subscribeBookkeepingEntries',
  'createBookkeepingEntry',
  'updateBookkeepingEntry',
  'deleteBookkeepingEntry',
  'sourceAttendanceId',
  'sourceAttendanceDate',
  'sourceGuardPersonId',
  'sourceBookingId',
  'sourceFeeEntryId',
]) {
  assert.equal(repositorySource.includes(required), true, 'UI-7 repository contract missing: ' + required);
}

for (const required of [
  'buildBookingFinanceTransactions',
  'buildBookingIncomeTransactions',
  'buildBookingRefundTransactions',
  "source:\n                'booking'",
  "source:\n              'booking-refund'",
]) {
  assert.equal(accountingSource.includes(required), true, 'UI-7 accounting core contract missing: ' + required);
}

for (const testFile of [
  'payment-accounting-core-contract-test.mjs',
  'finance-reconciliation-contract-test.mjs',
  'refund-lifecycle-contract-test.mjs',
  'guard-meal-reconciliation-contract-test.mjs',
  'operator-fee-posting-reconciliation-contract-test.mjs',
  'admin-spatial-bookkeeping-ledger-contract-test.mjs',
]) {
  assert.equal(packageJson.scripts.test.includes(testFile), true, 'UI-7 npm test registration missing: ' + testFile);
}

process.stdout.write('✅ Admin Spatial Bookkeeping Ledger UI-7 contract passed.\n');
