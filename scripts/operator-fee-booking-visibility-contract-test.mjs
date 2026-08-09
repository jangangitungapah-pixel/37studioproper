import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  OPERATOR_FEE_ENTRY_STATUSES,
  OPERATOR_FEE_VISIBILITY_STATUSES,
  getBookingOperatorFeeVisibility,
} from '../src/services/operatorFeeRepository.js';

const booking = {
  bookingCode:
    'BKG-001',

  id:
    'booking-1',
};

const draftVisibility =
  getBookingOperatorFeeVisibility(
    [
      {
        amount:
          50000,

        bookingCode:
          'BKG-001',

        bookingId:
          'booking-1',

        id:
          'fee-1',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.DRAFT,

        totalAmount:
          50000,
      },
    ],
    booking,
  );

assert.equal(
  draftVisibility.status,
  OPERATOR_FEE_VISIBILITY_STATUSES.DRAFT,
);

assert.equal(
  draftVisibility.label,
  'Fee Draft',
);

assert.equal(
  draftVisibility.totalAmount,
  50000,
);

const reviewedVisibility =
  getBookingOperatorFeeVisibility(
    [
      {
        amount:
          50000,

        bookingId:
          'booking-1',

        id:
          'fee-1',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,

        totalAmount:
          50000,
      },

      {
        amount:
          25000,

        bookingId:
          'booking-1',

        id:
          'fee-2',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,

        totalAmount:
          25000,
      },
    ],
    booking,
  );

assert.equal(
  reviewedVisibility.status,
  OPERATOR_FEE_VISIBILITY_STATUSES.REVIEWED,
);

assert.equal(
  reviewedVisibility.label,
  'Fee Siap Post',
);

assert.equal(
  reviewedVisibility.totalAmount,
  75000,
);

const postedVisibility =
  getBookingOperatorFeeVisibility(
    [
      {
        amount:
          50000,

        bookingId:
          'booking-1',

        id:
          'fee-1',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,

        totalAmount:
          50000,
      },
    ],
    booking,
  );

assert.equal(
  postedVisibility.status,
  OPERATOR_FEE_VISIBILITY_STATUSES.POSTED,
);

assert.equal(
  postedVisibility.label,
  'Fee Posted',
);

const emptyVisibility =
  getBookingOperatorFeeVisibility(
    [],
    booking,
  );

assert.equal(
  emptyVisibility.status,
  OPERATOR_FEE_VISIBILITY_STATUSES.ESTIMATE,
);

assert.equal(
  emptyVisibility.label,
  'Fee Belum Direview',
);

assert.equal(
  emptyVisibility.entryCount,
  0,
);

const voidOnlyVisibility =
  getBookingOperatorFeeVisibility(
    [
      {
        bookingId:
          'booking-1',

        id:
          'fee-void',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.VOID,
      },
    ],
    booking,
  );

assert.equal(
  voidOnlyVisibility.status,
  OPERATOR_FEE_VISIBILITY_STATUSES.ESTIMATE,
);

assert.equal(
  voidOnlyVisibility.entryCount,
  0,
);

const unrelatedVisibility =
  getBookingOperatorFeeVisibility(
    [
      {
        bookingId:
          'other-booking',

        id:
          'other-fee',

        status:
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      },
    ],
    booking,
  );

assert.equal(
  unrelatedVisibility.entryCount,
  0,
);

const adminSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminSource.includes(
    '<SchedulePage currentUser={currentUser} />'
  ),
  true,
  'Schedule must receive the canonical admin account.',
);

const scheduleSource =
  readFileSync(
    resolve(
      'src/pages/admin/SchedulePage.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'getBookingOperatorFeeVisibility',
    'subscribeOperatorFeeEntries',
    'canViewOperatorFee',
    'resolveOperatorFeeVisibility',
    'schedule-booking-fee-indicator',
    'schedule-upcoming-fee',
    'operatorFeeVisibility={',
    "'operator-fee'",
  ]
) {
  assert.equal(
    scheduleSource.includes(
      required,
    ),
    true,
    'Schedule Operator Fee visibility contract missing: ' +
      required,
  );
}

for (
  const forbidden
  of [
    'upsertOperatorFeeEntry',
    'postOperatorFeeEntryToBookkeeping',
    'markOperatorFeeEntryReviewed',
    'createOperatorFeeBookkeepingPayload',
  ]
) {
  assert.equal(
    scheduleSource.includes(
      forbidden,
    ),
    false,
    'Schedule must remain read-only for Operator Fee: ' +
      forbidden,
  );
}

const subscriptionGateIndex =
  scheduleSource.indexOf(
    '!canViewOperatorFee'
  );

const subscriptionIndex =
  scheduleSource.indexOf(
    'subscribeOperatorFeeEntries('
  );

assert.equal(
  subscriptionGateIndex >= 0 &&
    subscriptionGateIndex <
      subscriptionIndex,
  true,
  'Operator Fee subscription must be gated by permission.',
);

const drawerSource =
  readFileSync(
    resolve(
      'src/components/booking/BookingDetailDrawer.jsx',
    ),
    'utf8',
  );

assert.equal(
  drawerSource.includes(
    'operatorFeeVisibility = null'
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    "'fee-' +"
  ),
  true,
);

assert.equal(
  drawerSource.includes(
    'operatorFeeVisibility.label'
  ),
  true,
);

const scheduleCss =
  readFileSync(
    resolve(
      'src/styles/modules/schedule.css',
    ),
    'utf8',
  );

for (
  const required
  of [
    '.schedule-booking-fee-indicator',
    '.schedule-upcoming-fee',
    '.schedule-booking-fee-indicator.is-draft',
    '.schedule-booking-fee-indicator.is-reviewed',
    '.schedule-booking-fee-indicator.is-posted',
  ]
) {
  assert.equal(
    scheduleCss.includes(
      required,
    ),
    true,
    'Schedule fee CSS missing: ' +
      required,
  );
}

const drawerCss =
  readFileSync(
    resolve(
      'src/styles/modules/booking-detail-drawer.css',
    ),
    'utf8',
  );

for (
  const required
  of [
    '.booking-detail-drawer-status.is-fee-draft',
    '.booking-detail-drawer-status.is-fee-reviewed',
    '.booking-detail-drawer-status.is-fee-posted',
  ]
) {
  assert.equal(
    drawerCss.includes(
      required,
    ),
    true,
    'Booking drawer fee CSS missing: ' +
      required,
  );
}

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
    'operator-fee-posting-reconciliation-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'operator-fee-booking-visibility-contract-test.mjs',
  ),
  true,
);

process.stdout.write(
  '✅ Operator Fee Booking Visibility contract passed.\n',
);
