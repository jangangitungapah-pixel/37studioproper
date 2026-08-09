import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(file) {
  return readFileSync(resolve(file), 'utf8');
}

const billingSource = read('src/pages/admin/BillingPage.jsx');
const commandSource = read('src/components/billing/PaymentProofCommandCenter.jsx');
const cssSource = read('src/styles/modules/billing.css');
const paymentCoreSource = read('src/utils/bookingPaymentUtils.js');
const proofRepositorySource = read('src/services/paymentProofRepository.js');
const bookingRepositorySource = read('src/services/adminBookingRepository.js');
const packageJson = JSON.parse(read('package.json'));

for (const required of [
  'data-billing-ui="ui-6-spatial"',
  'billing-editorial-header',
  'billing-finance-pulse',
  'billing-attention-object',
  'billing-operations-grid',
  'billing-command-shelf',
  'billing-ledger-surface',
  'billing-ledger-columns',
  'BillingLedgerState',
  'isBillingLoading',
  'billingLoadError',
  'isProofLoading',
  'proofLoadError',
  'PaymentProofCommandCenter',
  'PaginationControls',
]) {
  assert.equal(billingSource.includes(required), true, 'UI-6 Billing marker missing: ' + required);
}

for (const invariant of [
  'buildBookingPaymentPatch(',
  'buildBookingRefundPatch(',
  'buildBookingVoidPatch(',
  'canRefundBookingPayment(booking)',
  'canVoidBookingInvoice(booking)',
  'getBookingFinanceTotals',
  'getBookingOutstandingAmount(',
  'getBookingPaidAmount(',
  'getBookingRefundedAmount(booking)',
  'getBookingRefundableAmount',
  'getBookingRefundStatus',
  'getBookingPaymentStatus(',
  'isBookingPaymentOpen(',
  '.subscribePaymentProofs(',
  '.subscribeManualBookings(',
  "searchParams.get('paymentProofId')",
  "nextParams.set(\n        'paymentProofId'",
  'getReminderHref(',
  'getShareText(',
  'window.print()',
]) {
  assert.equal(billingSource.includes(invariant), true, 'Finance invariant missing: ' + invariant);
}

assert.equal(billingSource.includes('const paymentHistory = [...getPaymentHistory(booking), payment];'), false);
assert.equal(billingSource.includes("status !== 'lunas' && status !== 'void'"), false);

for (const required of [
  'proofStatusFilterOptions',
  "useState('pending')",
  "'pending'",
  "'approved'",
  "'rejected'",
  'data-proof-priority',
  'data-proof-status',
  'billing-proof-command-cta',
  'billing-proof-command-state',
  'reviewedByName',
  'reviewedAt',
  'PaginationControls',
  'getPaginationSlice',
]) {
  assert.equal(commandSource.includes(required), true, 'Proof queue marker missing: ' + required);
}

assert.equal(commandSource.includes('slice(0, 6)'), false, 'Proof history must not be capped.');

const cssMarker = 'UI-6 — Spatial Invoices & Payments Workspace';
assert.equal(cssSource.includes(cssMarker), true, 'UI-6 stylesheet marker missing.');
const ui6Css = cssSource.split(cssMarker)[1];

for (const required of [
  '--studio-surface-1',
  '--studio-surface-2',
  '--studio-text-primary',
  '--studio-edge-soft',
  '--studio-shadow-surface',
  '--studio-duration-fast',
  "data-theme='dark'",
  '@media (max-width: 767px)',
  '@media (max-width: 359px)',
  '@media (forced-colors: active)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.equal(ui6Css.includes(required), true, 'UI-6 CSS marker missing: ' + required);
}

assert.equal(ui6Css.includes('--auth-'), false, 'New UI-6 layer must consume semantic studio tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(ui6Css), false, 'New UI-6 layer must not add raw hex colors.');
assert.equal(cssSource.includes('background: #fff;'), true, 'Thermal receipt white paper must remain explicit.');
assert.equal(cssSource.includes('color: #111;'), true, 'Thermal receipt ink must remain explicit.');

assert.equal(paymentCoreSource.includes('export function buildBookingPaymentPatch('), true);
assert.equal(paymentCoreSource.includes('export function buildBookingRefundPatch('), true);
assert.equal(paymentCoreSource.includes('export function buildBookingVoidPatch('), true);
assert.equal(proofRepositorySource.includes('buildBookingPaymentPatch(booking, payment)'), true);
assert.equal(proofRepositorySource.includes('export function subscribePaymentProofs('), true);
assert.equal(bookingRepositorySource.includes('export function subscribeManualBookings('), true);
assert.equal(bookingRepositorySource.includes('export async function updateManualBooking('), true);

for (const legacyContract of [
  'payment-accounting-core-contract-test.mjs',
  'payment-proof-command-center-contract-test.mjs',
  'finance-reconciliation-contract-test.mjs',
  'refund-lifecycle-contract-test.mjs',
  'admin-spatial-invoices-payments-contract-test.mjs',
]) {
  assert.equal(packageJson.scripts.test.includes(legacyContract), true, 'Package test missing: ' + legacyContract);
}

for (const forbidden of ['@mui/', 'antd', 'bootstrap', '@chakra-ui/', '@mantine/']) {
  assert.equal(billingSource.includes(forbidden) || commandSource.includes(forbidden), false, 'Forbidden UI dependency: ' + forbidden);
}

process.stdout.write('✅ Admin Spatial Invoices & Payments UI-6 contract passed.\n');
