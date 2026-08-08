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
  getBookingPaymentStatus,
} from '../src/domain/booking/bookingSelectors.js';
import {
  assertBookingPaymentCanApply,
  buildBookingPaymentPatch,
  buildBookingVoidPatch,
  getBookingOutstandingAmount,
  getBookingPaidAmount,
  getBookingPaymentSummary,
} from '../src/utils/bookingPaymentUtils.js';

const legacyPartial = {
  id:
    'booking-payment-core',

  total:
    200000,

  paymentStatus:
    'dp',

  dpAmount:
    50000,

  invoiceAmount:
    150000,

  paymentHistory: [],
};

const initialSummary =
  getBookingPaymentSummary(
    legacyPartial,
  );

assert.equal(
  initialSummary.status,
  BOOKING_PAYMENT_STATUS.PARTIAL,
);

assert.equal(
  initialSummary.total,
  200000,
);

assert.equal(
  initialSummary.paid,
  50000,
);

assert.equal(
  initialSummary.outstanding,
  150000,
);

const secondPayment =
  buildBookingPaymentPatch(
    legacyPartial,
    {
      amount:
        50000,

      createdAt:
        '2026-08-08T10:00:00.000Z',

      date:
        '2026-08-08',

      id:
        'pay-second',

      method:
        'transfer',

      note:
        'Second payment',
    },
  );

assert.equal(
  secondPayment.paymentStatus,
  'dp',
  'Compatibility write remains legacy DP.',
);

assert.equal(
  getBookingPaymentStatus(
    secondPayment,
  ),
  BOOKING_PAYMENT_STATUS.PARTIAL,
);

assert.equal(
  getBookingPaidAmount(
    secondPayment,
  ),
  100000,
);

assert.equal(
  getBookingOutstandingAmount(
    secondPayment,
  ),
  100000,
);

const finalPayment =
  buildBookingPaymentPatch(
    secondPayment,
    {
      amount:
        100000,

      createdAt:
        '2026-08-08T11:00:00.000Z',

      date:
        '2026-08-08',

      id:
        'pay-final',

      method:
        'qris',

      note:
        'Final payment',
    },
  );

assert.equal(
  finalPayment.paymentStatus,
  'lunas',
);

assert.equal(
  getBookingPaymentStatus(
    finalPayment,
  ),
  BOOKING_PAYMENT_STATUS.PAID,
);

assert.equal(
  getBookingOutstandingAmount(
    finalPayment,
  ),
  0,
);

assert.throws(
  () =>
    buildBookingPaymentPatch(
      legacyPartial,
      {
        amount:
          150001,

        id:
          'pay-over',
      },
    ),

  /tidak boleh melebihi sisa tagihan/,
  'Core must reject overpayment from every payment source.',
);

assert.throws(
  () =>
    assertBookingPaymentCanApply(
      finalPayment,
      {
        amount:
          1,
      },
    ),

  /sudah lunas/,
);

const voidBooking =
  buildBookingVoidPatch(
    legacyPartial,
    'Invoice duplikat',
    {
      now:
        '2026-08-08T12:00:00.000Z',
    },
  );

assert.equal(
  voidBooking.paymentStatus,
  'void',
);

assert.equal(
  getBookingPaymentStatus(
    voidBooking,
  ),
  BOOKING_PAYMENT_STATUS.VOID,
);

assert.equal(
  getBookingOutstandingAmount(
    voidBooking,
  ),
  0,
);

assert.equal(
  voidBooking.previousInvoiceAmount,
  150000,
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
    'buildBookingPaymentPatch(',
  ),
  true,
);

assert.equal(
  billingSource.includes(
    'buildBookingVoidPatch(',
  ),
  true,
);

assert.equal(
  billingSource.includes(
    'const paymentHistory = [...getPaymentHistory(booking), payment];',
  ),
  false,
  'BillingPage must not maintain a second payment accounting implementation.',
);

assert.equal(
  billingSource.includes(
    'const totalPaid = paymentHistory.reduce',
  ),
  false,
);

assert.equal(
  billingSource.includes(
    'isBookingPaymentOpen(',
  ),
  true,
  'Open billing decisions must come from canonical selectors.',
);

const proofRepositorySource =
  readFileSync(
    resolve(
      'src/services/paymentProofRepository.js',
    ),
    'utf8',
  );

assert.equal(
  proofRepositorySource.includes(
    'buildBookingPaymentPatch(booking, payment)',
  ),
  true,
  'Payment proof approval must share the same accounting core.',
);

const portalSource =
  readFileSync(
    resolve(
      'src/pages/ClientPortalPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  portalSource.includes(
    'function getOutstandingAmountForBooking',
  ),
  false,
  'Client Portal must not maintain a separate outstanding calculator.',
);

assert.equal(
  portalSource.includes(
    'getBookingOutstandingAmount(',
  ),
  true,
);

const clientBillingSource =
  readFileSync(
    resolve(
      'src/components/client/ClientBillingTab.jsx',
    ),
    'utf8',
  );

assert.equal(
  clientBillingSource.includes(
    'getBookingOutstandingAmount(b)',
  ),
  true,
);

assert.equal(
  clientBillingSource.includes(
    "status === 'dp'",
  ),
  false,
  'Client payment amount must not be calculated from legacy status vocabulary.',
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
    'client-portal-visual-overhaul-contract-test.mjs',
  ),
  true,
  'Phase 4D gate must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'payment-accounting-core-contract-test.mjs',
  ),
  true,
  'Phase 5A gate must be registered.',
);

process.stdout.write(
  '✅ Payment Accounting Core contract passed.\n',
);
