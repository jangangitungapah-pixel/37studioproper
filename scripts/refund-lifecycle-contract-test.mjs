import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  BOOKING_PAYMENT_STATUS,
} from '../src/domain/booking/bookingStatus.js';

import {
  assertBookingRefundCanApply,
  buildBookingFinanceTransactions,
  buildBookingPaymentPatch,
  buildBookingRefundPatch,
  buildBookingRefundTransactions,
  buildBookingVoidPatch,
  canRefundBookingPayment,
  getBookingFinanceSnapshot,
  getBookingFinanceTotals,
  getBookingRefundableAmount,
  getBookingRefundedAmount,
  getBookingRefundStatus,
} from '../src/utils/bookingPaymentUtils.js';

const paidBooking =
  buildBookingPaymentPatch(
    {
      id:
        'refund-booking',

      customer:
        'Refund Client',

      invoiceNumber:
        'INV-REFUND',

      paymentHistory:
        [],

      paymentStatus:
        'pending',

      total:
        200000,
    },

    {
      amount:
        200000,

      createdAt:
        '2026-08-09T04:00:00.000Z',

      date:
        '2026-08-09',

      id:
        'pay-refund-source',

      method:
        'transfer',
    },
  );

assert.equal(
  getBookingRefundableAmount(
    paidBooking,
  ),
  200000,
);

assert.equal(
  canRefundBookingPayment(
    paidBooking,
  ),
  true,
);

const partialRefund =
  buildBookingRefundPatch(
    paidBooking,

    {
      amount:
        50000,

      createdAt:
        '2026-08-09T05:00:00.000Z',

      date:
        '2026-08-09',

      id:
        'refund-partial',

      method:
        'transfer',

      reason:
        'Kompensasi sebagian',
    },
  );

assert.equal(
  getBookingRefundedAmount(
    partialRefund,
  ),
  50000,
);

assert.equal(
  getBookingRefundableAmount(
    partialRefund,
  ),
  150000,
);

assert.equal(
  getBookingRefundStatus(
    partialRefund,
  ),
  'partial',
);

const partialSnapshot =
  getBookingFinanceSnapshot(
    partialRefund,
  );

assert.equal(
  partialSnapshot.status,
  BOOKING_PAYMENT_STATUS.PAID,
  'Partial refund must not silently rewrite invoice payment obligation.',
);

assert.equal(
  partialSnapshot.cashReceived,
  200000,
);

assert.equal(
  partialSnapshot.cashRefunded,
  50000,
);

assert.equal(
  partialSnapshot.netCashReceived,
  150000,
);

assert.equal(
  partialSnapshot.outstanding,
  0,
);

assert.throws(
  () =>
    assertBookingRefundCanApply(
      partialRefund,

      {
        amount:
          150001,

        reason:
          'Refund berlebih',
      },
    ),

  /tidak boleh melebihi saldo pembayaran/,
);

const fullRefund =
  buildBookingRefundPatch(
    partialRefund,

    {
      amount:
        150000,

      createdAt:
        '2026-08-09T06:00:00.000Z',

      date:
        '2026-08-09',

      id:
        'refund-final',

      method:
        'transfer',

      reason:
        'Pengembalian saldo akhir',
    },
  );

const fullSnapshot =
  getBookingFinanceSnapshot(
    fullRefund,
  );

assert.equal(
  fullRefund.paymentStatus,
  'refunded',
);

assert.equal(
  fullRefund.status,
  'refunded',
);

assert.equal(
  fullSnapshot.status,
  BOOKING_PAYMENT_STATUS.REFUNDED,
);

assert.equal(
  fullSnapshot.refundStatus,
  'full',
);

assert.equal(
  fullSnapshot.cashReceived,
  200000,
);

assert.equal(
  fullSnapshot.cashRefunded,
  200000,
);

assert.equal(
  fullSnapshot.netCashReceived,
  0,
);

assert.equal(
  fullSnapshot.outstanding,
  0,
);

assert.equal(
  canRefundBookingPayment(
    fullRefund,
  ),
  false,
);

assert.throws(
  () =>
    buildBookingPaymentPatch(
      fullRefund,

      {
        amount:
          1,

        id:
          'payment-after-refund',
      },
    ),

  /invoice refund/,
  'A fully refunded invoice must reject new payments.',
);

assert.throws(
  () =>
    buildBookingRefundPatch(
      {
        id:
          'unpaid-refund',

        paymentStatus:
          'pending',

        total:
          100000,
      },

      {
        amount:
          50000,

        reason:
          'Tidak ada cash',
      },
    ),

  /belum memiliki pembayaran/,
);

const voidBooking =
  buildBookingVoidPatch(
    {
      id:
        'void-refund',

      paymentStatus:
        'pending',

      total:
        100000,
    },

    'Invoice batal',
  );

assert.throws(
  () =>
    buildBookingRefundPatch(
      voidBooking,

      {
        amount:
          1,

        reason:
          'Tidak boleh',
      },
    ),

  /Invoice void tidak bisa direfund/,
);

const refundTransactions =
  buildBookingRefundTransactions([
    fullRefund,
  ]);

assert.equal(
  refundTransactions.length,
  2,
);

assert.equal(
  refundTransactions.every(
    (
      transaction,
    ) =>
      transaction.type ===
        'expense' &&
      transaction.source ===
        'booking-refund',
  ),
  true,
);

assert.equal(
  refundTransactions.reduce(
    (
      total,
      transaction,
    ) =>
      total +
      transaction.amount,
    0,
  ),
  200000,
);

const financeTransactions =
  buildBookingFinanceTransactions([
    fullRefund,
  ]);

assert.equal(
  financeTransactions.filter(
    (
      transaction,
    ) =>
      transaction.type ===
      'income',
  ).length,
  1,
);

assert.equal(
  financeTransactions.filter(
    (
      transaction,
    ) =>
      transaction.type ===
      'expense',
  ).length,
  2,
);

const totals =
  getBookingFinanceTotals([
    fullRefund,
  ]);

assert.equal(
  totals.cashReceived,
  200000,
);

assert.equal(
  totals.cashRefunded,
  200000,
);

assert.equal(
  totals.netCashReceived,
  0,
);

assert.equal(
  totals.refundedInvoices,
  1,
);

assert.equal(
  totals.outstanding,
  0,
);

const partialTotals =
  getBookingFinanceTotals([
    partialRefund,
  ]);

assert.equal(
  partialTotals.partialRefundInvoices,
  1,
);

const billingSource =
  readFileSync(
    resolve(
      'src/pages/admin/BillingPage.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'buildBookingRefundPatch',
    'RefundPaymentModal',
    'canRefundBookingPayment(booking)',
    "activeFilter === 'refund_activity'",
    'getBookingRefundedAmount(booking)',
    'refundPayment(',
    'onRefundPayment={setSelectedRefundBooking}',
  ]
) {
  assert.equal(
    billingSource.includes(
      required,
    ),
    true,
    'Billing refund contract missing: ' +
      required,
  );
}

const bookkeepingSource =
  readFileSync(
    resolve(
      'src/pages/admin/BookkeepingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  bookkeepingSource.includes(
    'buildBookingFinanceTransactions',
  ),
  true,
);

assert.equal(
  bookkeepingSource.includes(
    'buildBookingIncomeTransactions',
  ),
  false,
  'Bookkeeping must consume combined payment/refund transactions.',
);

assert.equal(
  bookkeepingSource.includes(
    'booking-refund',
  ),
  true,
  'Refund cash-out must be searchable in Bookkeeping.',
);

const dashboardSource =
  readFileSync(
    resolve(
      'src/pages/admin/DashboardPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  dashboardSource.includes(
    'buildBookingFinanceTransactions',
  ),
  true,
);

assert.equal(
  dashboardSource.includes(
    'buildBookingIncomeTransactions',
  ),
  false,
  'Dashboard cashflow must consume refund expenses too.',
);

const rulesSource =
  readFileSync(
    resolve(
      'firestore.rules',
    ),
    'utf8',
  );

assert.equal(
  rulesSource.includes(
    "'lunas', 'refunded', 'void'",
  ),
  true,
  'Firestore booking status vocabulary must permit refunded.',
);

assert.equal(
  rulesSource.includes(
    "['refundHistory']",
  ),
  true,
);

assert.equal(
  rulesSource.includes(
    "['refundedAmount']",
  ),
  true,
);

assert.equal(
  rulesSource.includes(
    "['refundStatus']",
  ),
  true,
);

const financeContractSource =
  readFileSync(
    resolve(
      'scripts/finance-reconciliation-contract-test.mjs',
    ),
    'utf8',
  );

assert.equal(
  financeContractSource.includes(
    "'buildBookingFinanceTransactions'",
  ),
  true,
  'Phase 5C consumer contract must evolve with 5D reconciliation.',
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
    'finance-reconciliation-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'refund-lifecycle-contract-test.mjs',
  ),
  true,
  'Phase 5D gate must be registered.',
);

process.stdout.write(
  '✅ Refund Lifecycle contract passed.\n',
);
