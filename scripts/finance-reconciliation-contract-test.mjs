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
  buildBookingIncomeTransactions,
  buildBookingPaymentPatch,
  buildBookingVoidPatch,
  canVoidBookingInvoice,
  getBookingFinanceSnapshot,
  getBookingFinanceTotals,
} from '../src/utils/bookingPaymentUtils.js';

const unpaid = {
  id:
    'invoice-unpaid',

  customer:
    'Unpaid Client',

  invoiceNumber:
    'INV-UNPAID',

  paymentStatus:
    'pending',

  total:
    200000,
};

const partial =
  buildBookingPaymentPatch(
    {
      id:
        'invoice-partial',

      customer:
        'Partial Client',

      invoiceNumber:
        'INV-PARTIAL',

      paymentStatus:
        'pending',

      total:
        200000,
    },
    {
      amount:
        50000,

      createdAt:
        '2026-08-09T01:00:00.000Z',

      date:
        '2026-08-09',

      id:
        'pay-partial',

      method:
        'transfer',
    },
  );

const paid =
  buildBookingPaymentPatch(
    {
      ...partial,

      id:
        'invoice-paid',

      invoiceNumber:
        'INV-PAID',
    },
    {
      amount:
        150000,

      createdAt:
        '2026-08-09T02:00:00.000Z',

      date:
        '2026-08-09',

      id:
        'pay-final',

      method:
        'qris',
    },
  );

const voidInvoice =
  buildBookingVoidPatch(
    {
      id:
        'invoice-void',

      paymentStatus:
        'pending',

      total:
        100000,
    },

    'Booking dibatalkan sebelum pembayaran',

    {
      now:
        '2026-08-09T03:00:00.000Z',
    },
  );

assert.equal(
  canVoidBookingInvoice(
    unpaid,
  ),
  true,
);

assert.equal(
  canVoidBookingInvoice(
    partial,
  ),
  false,
);

assert.equal(
  canVoidBookingInvoice(
    paid,
  ),
  false,
);

assert.equal(
  canVoidBookingInvoice(
    voidInvoice,
  ),
  false,
);

assert.throws(
  () =>
    buildBookingVoidPatch(
      partial,
      'Tidak jadi',
    ),

  /sudah memiliki pembayaran tidak bisa di-void/,
  'Partial invoice must never be voided after cash has been received.',
);

assert.throws(
  () =>
    buildBookingVoidPatch(
      paid,
      'Tidak jadi',
    ),

  /sudah memiliki pembayaran tidak bisa di-void/,
  'Paid invoice must use refund lifecycle instead of void.',
);

const partialSnapshot =
  getBookingFinanceSnapshot(
    partial,
  );

assert.equal(
  partialSnapshot.status,
  BOOKING_PAYMENT_STATUS.PARTIAL,
);

assert.equal(
  partialSnapshot.total,
  200000,
);

assert.equal(
  partialSnapshot.paid,
  50000,
);

assert.equal(
  partialSnapshot.cashReceived,
  50000,
);

assert.equal(
  partialSnapshot.outstanding,
  150000,
);

const incomeTransactions =
  buildBookingIncomeTransactions([
    unpaid,
    partial,
    paid,
    voidInvoice,
  ]);

assert.equal(
  incomeTransactions.some(
    (transaction) =>
      transaction.bookingId ===
      'invoice-partial',
  ),
  true,
);

assert.equal(
  incomeTransactions.every(
    (transaction) =>
      transaction.type ===
        'income' &&
      transaction.source ===
        'booking' &&
      transaction.amount > 0,
  ),
  true,
);

const totals =
  getBookingFinanceTotals([
    unpaid,
    partial,
    paid,
    voidInvoice,
  ]);

assert.equal(
  totals.totalBookings,
  4,
);

assert.equal(
  totals.openInvoices,
  2,
);

assert.equal(
  totals.paidInvoices,
  1,
);

assert.equal(
  totals.voidInvoices,
  1,
);

assert.equal(
  totals.outstanding,
  350000,
);

assert.equal(
  totals.cashReceived,
  250000,
);

const bookkeepingSource =
  readFileSync(
    resolve(
      'src/pages/admin/BookkeepingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  bookkeepingSource.includes(
    'buildBookingIncomeTransactions',
  ),
  true,
);

assert.equal(
  bookkeepingSource.includes(
    'getBookingOutstandingAmount',
  ),
  true,
);

assert.equal(
  bookkeepingSource.includes(
    'function getBookingPaymentHistory(booking)',
  ),
  false,
  'Bookkeeping must not own a second payment history implementation.',
);

assert.equal(
  bookkeepingSource.includes(
    'booking?.paidAmount || booking?.dpAmount',
  ),
  false,
  'Bookkeeping must not infer paid amount independently.',
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
    'buildBookingIncomeTransactions',
  ),
  true,
);

assert.equal(
  dashboardSource.includes(
    'getBookingFinanceTotals',
  ),
  true,
);

assert.equal(
  dashboardSource.includes(
    'function getBookingPaymentHistory(booking)',
  ),
  false,
  'Dashboard must not own a second payment history implementation.',
);

assert.equal(
  dashboardSource.includes(
    "['pending', 'dp'].includes(getBookingStatus(booking))",
  ),
  false,
  'Dashboard open invoice count must not depend on legacy status vocabulary.',
);

const billingSource =
  readFileSync(
    resolve(
      'src/pages/admin/BillingPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  billingSource.includes(
    'getBookingFinanceTotals',
  ),
  true,
);

assert.equal(
  billingSource.includes(
    'canVoidBookingInvoice(booking)',
  ),
  true,
);

assert.equal(
  billingSource.includes(
    "key: 'refunded'",
  ),
  true,
  'Refunded invoices must remain visible in Finance filters.',
);

assert.equal(
  billingSource.includes(
    "status !== 'lunas' && status !== 'void'",
  ),
  false,
  'Payment actions must use canonical open-payment semantics.',
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
    'payment-proof-command-center-contract-test.mjs',
  ),
  true,
  'Phase 5B contract must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'finance-reconciliation-contract-test.mjs',
  ),
  true,
  'Phase 5C contract must be registered.',
);

process.stdout.write(
  '✅ Finance Reconciliation contract passed.\n',
);
