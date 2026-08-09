import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(file) {
  return readFileSync(resolve(file), 'utf8').replace(/\r\n?/g, '\n');
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


// UI-6 visual layout repair contract — start
for (const required of [
  'function BillingFinanceHeader({ proofs })',
  '<BillingFinanceHeader proofs={paymentProofs} />',
]) {
  assert.equal(billingSource.includes(required), true, 'UI-6 compact header marker missing: ' + required);
}

for (const required of [
  'data-proof-volume',
  "data-proof-volume={stats.total ? 'populated' : 'empty'}",
  "'Queue akan aktif saat client mengirim bukti transfer baru.'",
  '!isLoading && !loadError && stats.total ? (',
]) {
  assert.equal(commandSource.includes(required), true, 'UI-6 compact proof marker missing: ' + required);
}

assert.equal(
  commandSource.includes('slice(0, 6)'),
  false,
  'Proof history must remain uncapped after layout repair.',
);

const layoutRepairMarker = 'UI-6 Visual Layout Repair — Dense Finance Command Surface';
assert.equal(cssSource.includes(layoutRepairMarker), true, 'UI-6 visual layout repair marker missing.');
const layoutRepairCss = cssSource.split(layoutRepairMarker)[1];

for (const required of [
  ".billing-proof-command-center[data-proof-volume='empty']",
  '.billing-operations-grid',
  '.billing-cash-summary',
  '.billing-cash-grid',
  '.billing-reminder-row',
  '.billing-command-shelf',
  '.billing-ledger-columns',
  '.billing-row-actions',
  '@media (max-width: 1120px)',
  '@media (max-width: 767px)',
  '@media (max-width: 359px)',
]) {
  assert.equal(layoutRepairCss.includes(required), true, 'UI-6 layout CSS marker missing: ' + required);
}

assert.equal(layoutRepairCss.includes('--auth-'), false, 'Layout repair must use semantic studio tokens.');
assert.equal(/#[0-9a-f]{3,8}\b/i.test(layoutRepairCss), false, 'Layout repair must not add raw hex colors.');
// UI-6 visual layout repair contract — end

// UI-6 operations density repair contract — start
const operationsDensityMarker = 'UI-6 Operations Density Repair — Compact Cashflow & Collection';
assert.equal(cssSource.includes(operationsDensityMarker), true, 'UI-6 operations density marker missing.');
const operationsDensityCss = cssSource
  .split(operationsDensityMarker)[1]
  .split('End UI-6 Operations Density Repair')[0];

for (const required of [
  '.billing-operations-grid',
  'grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr)',
  '.billing-cash-summary',
  'grid-template-columns: repeat(4, minmax(0, 1fr))',
  '.billing-reminder-card',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '.billing-reminder-row > button',
  'flex-wrap: nowrap',
  'white-space: normal',
  'overflow-wrap: anywhere',
  '@media (max-width: 1120px)',
  '@media (max-width: 900px)',
  '@media (max-width: 767px)',
  '@media (max-width: 520px)',
]) {
  assert.equal(
    operationsDensityCss.includes(required),
    true,
    'UI-6 balanced operations CSS missing: ' + required,
  );
}

// UI-6 operations typography contract — start
function getOperationsRule(selector) {
  const selectorNeedle = selector.endsWith(',')
    ? selector
    : selector + ' {';
  const selectorIndex = selector.endsWith(',')
    ? operationsDensityCss.indexOf(selectorNeedle)
    : operationsDensityCss.lastIndexOf(selectorNeedle);

  assert.notEqual(
    selectorIndex,
    -1,
    'UI-6 typography selector missing: ' + selector,
  );

  const openIndex = operationsDensityCss.indexOf(
    '{',
    selectorIndex,
  );
  const closeIndex = operationsDensityCss.indexOf(
    '}',
    openIndex,
  );

  assert.notEqual(
    openIndex,
    -1,
    'UI-6 typography rule opening missing: ' + selector,
  );
  assert.notEqual(
    closeIndex,
    -1,
    'UI-6 typography rule closing missing: ' + selector,
  );

  return operationsDensityCss.slice(
    openIndex,
    closeIndex + 1,
  );
}

for (const [selector, expected] of [
  [
    '.billing-cash-summary header small',
    'font-size: 0.53rem',
  ],
  [
    '.billing-cash-summary header strong',
    'font-size: 0.76rem',
  ],
  [
    '.billing-cash-summary header span',
    'font-size: 0.56rem',
  ],
  [
    '.billing-cash-grid strong',
    'font-size: 0.62rem',
  ],
  [
    '.billing-reminder-card header strong',
    'font-size: 0.76rem',
  ],
  [
    '.billing-reminder-card header em',
    'font-size: 0.56rem',
  ],
  [
    '.billing-reminder-row strong',
    'font-size: 0.64rem',
  ],
  [
    '.billing-reminder-row small',
    'font-size: 0.54rem',
  ],
  [
    '.billing-reminder-row a,',
    'font-size: 0.54rem',
  ],
]) {
  assert.equal(
    getOperationsRule(selector).includes(expected),
    true,
    'UI-6 typography scale missing: ' +
      selector +
      ' -> ' +
      expected,
  );
}
// UI-6 operations typography contract — end

for (const forbidden of [
  'grid-template-columns: minmax(0, 1.25fr) minmax(410px, 0.75fr)',
  'grid-template-columns: minmax(154px, 0.62fr) minmax(0, 1.38fr)',
]) {
  assert.equal(
    operationsDensityCss.includes(forbidden),
    false,
    'UI-6 clipping layout must be removed: ' + forbidden,
  );
}

assert.equal(
  operationsDensityCss.includes('--auth-'),
  false,
  'Operations repair must use semantic studio tokens.',
);

assert.equal(
  /#[0-9a-f]{3,8}\b/i.test(operationsDensityCss),
  false,
  'Operations repair must not add raw hex colors.',
);
// UI-6 operations density repair contract — end

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
