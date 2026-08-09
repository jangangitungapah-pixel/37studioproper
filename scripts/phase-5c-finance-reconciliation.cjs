const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  paymentUtils: path.join(
    ROOT,
    'src',
    'utils',
    'bookingPaymentUtils.js',
  ),

  billing: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'BillingPage.jsx',
  ),

  bookkeeping: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'BookkeepingPage.jsx',
  ),

  dashboard: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'DashboardPage.jsx',
  ),

  test: path.join(
    ROOT,
    'scripts',
    'finance-reconciliation-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),
};

const staged = new Map();

function fail(message) {
  console.error('');
  console.error(
    '[phase-5c] ' +
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
  if (!needle) {
    return 0;
  }

  let count = 0;
  let cursor = 0;

  while (true) {
    const index =
      source.indexOf(
        needle,
        cursor,
      );

    if (index < 0) {
      return count;
    }

    count += 1;

    cursor =
      index +
      needle.length;
  }
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
      '[phase-5c] Already applied: ' +
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
    '[phase-5c] Updated: ' +
      label,
  );
}

function replaceExpected(
  file,
  before,
  after,
  expectedCount,
  label,
) {
  const source =
    read(file);

  const count =
    countOccurrences(
      source,
      before,
    );

  if (
    count === 0 &&
    source.includes(after)
  ) {
    console.log(
      '[phase-5c] Already applied: ' +
        label,
    );

    return;
  }

  if (
    count !== expectedCount
  ) {
    fail(
      label +
        ': expected ' +
        expectedCount +
        ' anchors, found ' +
        count,
    );
  }

  stage(
    file,
    source
      .split(before)
      .join(after),
  );

  console.log(
    '[phase-5c] Updated: ' +
      label,
  );
}

function replaceRange(
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
    '[phase-5c] Updated: ' +
      label,
  );
}

function stageNewFile(
  file,
  content,
) {
  const normalized =
    normalize(content);

  if (fs.existsSync(file)) {
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
        '[phase-5c] Already correct: ' +
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
    '[phase-5c] Prepared: ' +
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
    'payment-proof-command-center-contract-test.mjs',
  )
) {
  fail(
    'Phase 5B belum menjadi baseline.',
  );
}

const utilsBaseline =
  read(
    FILES.paymentUtils,
  );

for (
  const required
  of [
    'getBookingPaymentSummary',
    'buildBookingPaymentPatch',
    'buildBookingVoidPatch',
    'getBookingOutstandingAmount',
  ]
) {
  if (
    !utilsBaseline.includes(
      required,
    )
  ) {
    fail(
      'Payment core kehilangan baseline: ' +
        required,
    );
  }
}

const bookkeepingBaseline =
  read(
    FILES.bookkeeping,
  );

if (
  !bookkeepingBaseline.includes(
    'function getBookingPaymentHistory(booking)',
  ) ||
  !bookkeepingBaseline.includes(
    'function getBookingReceivableAmount(booking)',
  )
) {
  fail(
    'Expected duplicated Bookkeeping accounting belum ditemukan.',
  );
}

const dashboardBaseline =
  read(
    FILES.dashboard,
  );

if (
  !dashboardBaseline.includes(
    'function getBookingPaymentHistory(booking)',
  ) ||
  !dashboardBaseline.includes(
    'function getBookingOutstanding(booking)',
  )
) {
  fail(
    'Expected duplicated Dashboard accounting belum ditemukan.',
  );
}

/**
 * ============================================================
 * 1. SHARED FINANCE RECONCILIATION CORE
 * ============================================================
 */

const financeCore = String.raw`export function getBookingCashReceivedAmount(
  booking,
) {
  return getBookingPaymentHistoryTotal(
    booking,
  );
}

export function getBookingFinanceSnapshot(
  booking,
) {
  const summary =
    getBookingPaymentSummary(
      booking,
    );

  const cashReceived =
    getBookingCashReceivedAmount(
      booking,
    );

  return {
    cashReceived,

    hasPayments:
      cashReceived > 0,

    isOpen:
      summary.isOpen,

    isPaid:
      summary.status ===
      BOOKING_PAYMENT_STATUS.PAID,

    isRefunded:
      summary.status ===
      BOOKING_PAYMENT_STATUS.REFUNDED,

    isVoid:
      summary.status ===
      BOOKING_PAYMENT_STATUS.VOID,

    outstanding:
      summary.outstanding,

    paid:
      summary.paid,

    paymentHistory:
      summary.paymentHistory,

    status:
      summary.status,

    total:
      summary.total,
  };
}

export function canVoidBookingInvoice(
  booking,
) {
  const finance =
    getBookingFinanceSnapshot(
      booking,
    );

  if (
    finance.isVoid ||
    finance.isRefunded
  ) {
    return false;
  }

  return (
    finance.paid <= 0 &&
    finance.cashReceived <= 0
  );
}

export function buildBookingIncomeTransactions(
  bookings,
) {
  const safeBookings =
    Array.isArray(
      bookings,
    )
      ? bookings
      : [];

  return safeBookings.flatMap(
    (
      booking,
    ) => {
      const bookingId =
        booking?.id ||
        booking?.bookingId ||
        booking?.bookingCode ||
        'unknown';

      return getBookingPaymentHistory(
        booking,
      )
        .filter(
          (
            payment,
          ) =>
            toMoney(
              payment?.amount,
            ) > 0,
        )
        .map(
          (
            payment,
            index,
          ) => {
            const paymentId =
              payment?.id ||
              payment?.proofId ||
              String(index);

            return {
              amount:
                toMoney(
                  payment?.amount,
                ),

              bookingId,

              customer:
                booking?.customer ||
                booking?.customerName ||
                booking?.name ||
                'Customer',

              date:
                payment?.date ||
                payment?.createdAt ||
                payment?.paidAt ||
                booking?.date ||
                booking?.createdAt ||
                '',

              id:
                'booking-' +
                bookingId +
                '-' +
                paymentId,

              invoiceNumber:
                booking?.invoiceNumber ||
                '',

              method:
                cleanPaymentText(
                  payment?.method ||
                  payment?.paymentMethod ||
                  booking?.lastPaymentMethod ||
                  booking?.paymentMethod ||
                  'other',
                ),

              note:
                booking?.invoiceNumber ||
                booking?.bookingCode ||
                'Pembayaran booking',

              source:
                'booking',

              title:
                'Booking - ' +
                (
                  booking?.customer ||
                  booking?.customerName ||
                  booking?.name ||
                  'Customer'
                ),

              type:
                'income',
            };
          },
        );
    },
  );
}

export function getBookingFinanceTotals(
  bookings,
) {
  const safeBookings =
    Array.isArray(
      bookings,
    )
      ? bookings
      : [];

  return safeBookings.reduce(
    (
      totals,
      booking,
    ) => {
      const finance =
        getBookingFinanceSnapshot(
          booking,
        );

      totals.totalBookings +=
        1;

      totals.cashReceived +=
        finance.cashReceived;

      totals.outstanding +=
        finance.outstanding;

      if (
        !finance.isVoid
      ) {
        totals.grossBilled +=
          finance.total;
      }

      if (
        finance.isOpen
      ) {
        totals.openInvoices +=
          1;
      }

      if (
        finance.isPaid
      ) {
        totals.paidInvoices +=
          1;
      }

      if (
        finance.isVoid
      ) {
        totals.voidInvoices +=
          1;
      }

      if (
        finance.isRefunded
      ) {
        totals.refundedInvoices +=
          1;
      }

      return totals;
    },
    {
      cashReceived:
        0,

      grossBilled:
        0,

      openInvoices:
        0,

      outstanding:
        0,

      paidInvoices:
        0,

      refundedInvoices:
        0,

      totalBookings:
        0,

      voidInvoices:
        0,
    },
  );
}

`;

replaceOnce(
  FILES.paymentUtils,

  'export function assertBookingPaymentCanApply(',

  financeCore +
    'export function assertBookingPaymentCanApply(',

  'finance reconciliation helpers',
);

/**
 * ============================================================
 * 2. VOID LIFECYCLE GUARDRAILS
 * ============================================================
 */

const voidGuardBefore = String.raw`  if (
    summary.status ===
    BOOKING_PAYMENT_STATUS.VOID
  ) {
    throw new Error(
      'Invoice sudah void.',
    );
  }

  const now =
`;

const voidGuardAfter = String.raw`  if (
    summary.status ===
    BOOKING_PAYMENT_STATUS.VOID
  ) {
    throw new Error(
      'Invoice sudah void.',
    );
  }

  if (
    summary.status ===
    BOOKING_PAYMENT_STATUS.REFUNDED
  ) {
    throw new Error(
      'Invoice refund tidak bisa di-void.',
    );
  }

  if (
    summary.paid > 0 ||
    getBookingPaymentHistoryTotal(
      booking,
    ) > 0
  ) {
    throw new Error(
      'Invoice yang sudah memiliki pembayaran tidak bisa di-void. Gunakan refund.',
    );
  }

  const now =
`;

replaceOnce(
  FILES.paymentUtils,

  voidGuardBefore,

  voidGuardAfter,

  'paid invoice void guard',
);

/**
 * ============================================================
 * 3. BOOKKEEPING -> SHARED CORE
 * ============================================================
 */

replaceOnce(
  FILES.bookkeeping,

  "import { bookkeepingRepository } from '../../services/bookkeepingRepository.js';",

  [
    "import { bookkeepingRepository } from '../../services/bookkeepingRepository.js';",
    'import {',
    '  buildBookingIncomeTransactions,',
    '  getBookingBillingTotal,',
    '  getBookingOutstandingAmount,',
    '  getBookingPaidAmount as getAccountingPaidAmount,',
    "} from '../../utils/bookingPaymentUtils.js';",
  ].join('\n'),

  'Bookkeeping finance core imports',
);

const bookkeepingFinanceReplacement = String.raw`function getBookingTotal(
  booking,
) {
  return getBookingBillingTotal(
    booking,
  );
}

function getBookingPaidAmount(
  booking,
) {
  return getAccountingPaidAmount(
    booking,
  );
}

function getBookingReceivableAmount(
  booking,
) {
  return getBookingOutstandingAmount(
    booking,
  );
}

function buildIncomeTransactions(
  bookings,
) {
  return buildBookingIncomeTransactions(
    bookings,
  );
}

`;

replaceRange(
  FILES.bookkeeping,

  'function getPaymentAmount(payment) {',

  'function getEntryCategoryOptions(type) {',

  bookkeepingFinanceReplacement,

  'Bookkeeping duplicate accounting -> shared core',
);

/**
 * ============================================================
 * 4. DASHBOARD -> SHARED CORE
 * ============================================================
 */

replaceOnce(
  FILES.dashboard,

  "import { inventoryRepository } from '../../services/inventoryRepository.js';",

  [
    "import { inventoryRepository } from '../../services/inventoryRepository.js';",
    'import {',
    '  getLegacyBookingPaymentStatus,',
    "} from '../../domain/booking/bookingSelectors.js';",
    'import {',
    '  buildBookingIncomeTransactions,',
    '  getBookingFinanceTotals,',
    "} from '../../utils/bookingPaymentUtils.js';",
  ].join('\n'),

  'Dashboard finance core imports',
);

const dashboardFinanceReplacement = String.raw`function getBookingStatus(
  booking,
) {
  return getLegacyBookingPaymentStatus(
    booking,
  );
}

function buildBookkeepingTransactions(
  bookings,
  entries,
) {
  const bookingPayments =
    buildBookingIncomeTransactions(
      bookings,
    );

  const manualEntries =
    entries
      .filter(
        (
          entry,
        ) =>
          entry.type ===
            'income' ||
          entry.type ===
            'expense',
      )
      .map(
        (
          entry,
        ) => ({
          amount:
            toNumber(
              entry.amount,
            ),

          date:
            entry.date ||
            entry.createdAt,

          id:
            'entry-' +
            entry.id,

          source:
            'manual',

          title:
            entry.title,

          type:
            entry.type ===
            'income'
              ? 'income'
              : 'expense',
        }),
      );

  return [
    ...bookingPayments,
    ...manualEntries,
  ];
}

`;

replaceRange(
  FILES.dashboard,

  'function getBookingStatus(booking) {',

  'function getInventoryStatus(item) {',

  dashboardFinanceReplacement,

  'Dashboard duplicate accounting -> shared core',
);

replaceOnce(
  FILES.dashboard,

  [
    "  const openBookings = bookings.filter((booking) => ['pending', 'dp'].includes(getBookingStatus(booking)));",
    '  const outstanding = openBookings.reduce((sum, booking) => sum + getBookingOutstanding(booking), 0);',
  ].join('\n'),

  [
    '  const financeTotals = getBookingFinanceTotals(bookings);',
  ].join('\n'),

  'Dashboard canonical finance totals',
);

replaceOnce(
  FILES.dashboard,

  [
    '    openInvoices: openBookings.length,',
    '    outstanding,',
  ].join('\n'),

  [
    '    openInvoices: financeTotals.openInvoices,',
    '    outstanding: financeTotals.outstanding,',
  ].join('\n'),

  'Dashboard reconciled invoice metrics',
);

/**
 * ============================================================
 * 5. BILLING -> RECONCILIATED TOTALS + LIFECYCLE UI
 * ============================================================
 */

replaceOnce(
  FILES.billing,

  [
    '  buildBookingPaymentPatch,',
    '  buildBookingVoidPatch,',
    '  getBookingBillingTotal,',
  ].join('\n'),

  [
    '  buildBookingPaymentPatch,',
    '  buildBookingVoidPatch,',
    '  canVoidBookingInvoice,',
    '  getBookingBillingTotal,',
    '  getBookingFinanceTotals,',
  ].join('\n'),

  'Billing reconciliation imports',
);

replaceOnce(
  FILES.billing,

  "  { key: 'void', label: 'Void', description: 'Invoice dibatalkan' },",

  [
    "  { key: 'void', label: 'Void', description: 'Invoice dibatalkan' },",
    "  { key: 'refunded', label: 'Refund', description: 'Pembayaran sudah dikembalikan' },",
  ].join('\n'),

  'Billing refunded filter',
);

const billingStatsReplacement = String.raw`function getBillingStats(
  bookings,
) {
  const totals =
    getBookingFinanceTotals(
      bookings,
    );

  return {
    open:
      totals.openInvoices,

    outstanding:
      totals.outstanding,

    paid:
      totals.paidInvoices,

    refunded:
      totals.refundedInvoices,

    total:
      totals.totalBookings,

    totalAmount:
      totals.grossBilled,

    void:
      totals.voidInvoices,
  };
}

`;

replaceRange(
  FILES.billing,

  'function getBillingStats(bookings) {',

  'function getCashStats(bookings, range = \'today\') {',

  billingStatsReplacement,

  'Billing summary -> reconciliation core',
);

replaceExpected(
  FILES.billing,

  "status !== 'lunas' && status !== 'void' ? (",

  'isOpenBilling(booking) ? (',

  2,

  'Billing payment actions use canonical open state',
);

replaceExpected(
  FILES.billing,

  "status !== 'void' ? (",

  'canVoidBookingInvoice(booking) ? (',

  2,

  'Billing void actions respect lifecycle guard',
);

/**
 * ============================================================
 * 6. PHASE 5C CONTRACT
 * ============================================================
 */

const testSource = String.raw`import assert from 'node:assert/strict';
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
`;

stageNewFile(
  FILES.test,
  testSource,
);

/**
 * ============================================================
 * 7. PACKAGE PIPELINE
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

const phase5b =
  'node scripts/payment-proof-command-center-contract-test.mjs';

const phase5c =
  'node scripts/finance-reconciliation-contract-test.mjs';

const commands =
  packageJson
    .scripts
    .test
    .split('&&')
    .map(
      (
        command,
      ) =>
        command.trim(),
    )
    .filter(Boolean);

if (
  !commands.includes(
    phase5b,
  )
) {
  fail(
    'Phase 5B contract hilang dari npm test.',
  );
}

if (
  !commands.includes(
    phase5c,
  )
) {
  packageJson.scripts.test =
    [
      ...commands,
      phase5c,
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
 * FINAL VALIDATION
 * ============================================================
 */

const nextUtils =
  read(
    FILES.paymentUtils,
  );

for (
  const required
  of [
    'getBookingFinanceSnapshot',
    'getBookingFinanceTotals',
    'buildBookingIncomeTransactions',
    'canVoidBookingInvoice',
    'Gunakan refund.',
  ]
) {
  if (
    !nextUtils.includes(
      required,
    )
  ) {
    fail(
      'Payment core kehilangan 5C contract: ' +
        required,
    );
  }
}

const nextBookkeeping =
  read(
    FILES.bookkeeping,
  );

if (
  nextBookkeeping.includes(
    'function getBookingPaymentHistory(booking)',
  )
) {
  fail(
    'Duplicate Bookkeeping payment accounting masih ada.',
  );
}

const nextDashboard =
  read(
    FILES.dashboard,
  );

if (
  nextDashboard.includes(
    'function getBookingPaymentHistory(booking)',
  )
) {
  fail(
    'Duplicate Dashboard payment accounting masih ada.',
  );
}

const nextBilling =
  read(
    FILES.billing,
  );

if (
  !nextBilling.includes(
    'canVoidBookingInvoice(booking)',
  )
) {
  fail(
    'Billing belum memakai invoice lifecycle guard.',
  );
}

/**
 * ============================================================
 * WRITE
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
    '[phase-5c] Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ Phase 5C Finance Reconciliation prepared.',
);
console.log('');
console.log('Shared finance core now owns:');
console.log('  booking payment transactions');
console.log('  cash received');
console.log('  paid amount');
console.log('  outstanding / receivable');
console.log('  finance totals');
console.log('  invoice void eligibility');
console.log('');
console.log('Consumers reconciled:');
console.log('  Billing');
console.log('  Bookkeeping');
console.log('  Dashboard');
console.log('');
console.log('Lifecycle guard:');
console.log('  unpaid + no cash -> may void');
console.log('  partial -> cannot void');
console.log('  paid -> cannot void');
console.log('  refunded -> cannot void');
console.log('');
console.log('Paid invoices must use future refund lifecycle.');
console.log('');
console.log('No Firestore schema migration.');
console.log('No new payment collection.');
console.log('No UI overhaul.');