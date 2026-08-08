import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BOOKING_STATUS_CONTRACT_VERSION,
} from '../src/domain/booking/bookingStatus.js';

import {
  normalizeBooking,
} from '../src/domain/booking/normalizeBooking.js';

import {
  getBookingPaymentStatus,
  getBookingRequestStatus,
  getBookingSessionStatus,
  getLegacyBookingPaymentStatus,
  isBookingCancelled,
  isBookingPaymentOpen,
  isBookingRequestActionable,
  isBookingScheduleActive,
} from '../src/domain/booking/bookingSelectors.js';

assert.equal(
  BOOKING_STATUS_CONTRACT_VERSION,
  1,
  'Phase 1 canonical booking contract version changed unexpectedly.',
);

const now = new Date(
  2026,
  7,
  8,
  10,
  0,
  0,
);

const compatibilityMatrix = [
  {
    name: 'manual legacy unpaid upcoming',
    booking: {
      id: 'manual-unpaid',
      source: 'admin',
      paymentStatus: 'pending',
      status: 'pending',
      date: '2026-08-09',
      startHour: 10,
      durationHours: 2,
      total: 300000,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'unpaid',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'pending',
      cancelled: false,
      paymentOpen: true,
      requestActionable: false,
    },
  },

  {
    name: 'client submitted unpaid request',
    booking: {
      id: 'submitted-request',
      source: 'clientPortal',
      bookingRequestStatus: 'submitted',
      paymentStatus: 'pending',
      status: 'pending',
      date: '2026-08-09',
      startHour: 12,
      durationHours: 2,
      total: 400000,
    },
    expected: {
      requestStatus: 'submitted',
      paymentStatus: 'unpaid',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'pending',
      cancelled: false,
      paymentOpen: true,
      requestActionable: true,
    },
  },

  {
    name: 'confirmed legacy DP',
    booking: {
      id: 'confirmed-dp',
      bookingRequestStatus: 'confirmed',
      paymentStatus: 'dp',
      status: 'dp',
      paidAmount: 150000,
      dpAmount: 150000,
      total: 500000,
      date: '2026-08-09',
      startHour: 14,
      durationHours: 2,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'partial',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'dp',
      cancelled: false,
      paymentOpen: true,
      requestActionable: false,
    },
  },

  {
    name: 'confirmed legacy paid completed session',
    booking: {
      id: 'paid-completed',
      bookingRequestStatus: 'confirmed',
      paymentStatus: 'lunas',
      status: 'lunas',
      total: 600000,
      date: '2026-08-07',
      startHour: 16,
      durationHours: 2,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'paid',
      sessionStatus: 'completed',
      legacyPaymentStatus: 'lunas',
      cancelled: false,
      paymentOpen: false,
      requestActionable: false,
    },
  },

  {
    name: 'cancellation requested keeps slot active',
    booking: {
      id: 'cancel-requested',
      bookingRequestStatus: 'cancellation_requested',
      paymentStatus: 'dp',
      status: 'dp',
      total: 500000,
      paidAmount: 200000,
      date: '2026-08-09',
      startHour: 17,
      durationHours: 2,
    },
    expected: {
      requestStatus: 'cancellation_requested',
      paymentStatus: 'partial',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'dp',
      cancelled: false,
      paymentOpen: true,
      requestActionable: true,
    },
  },

  {
    name: 'rejected client request',
    booking: {
      id: 'rejected-request',
      bookingRequestStatus: 'rejected',
      paymentStatus: 'pending',
      status: 'pending',
      date: '2026-08-09',
      startHour: 18,
      durationHours: 1,
    },
    expected: {
      requestStatus: 'rejected',
      paymentStatus: 'unpaid',
      sessionStatus: 'cancelled',
      legacyPaymentStatus: 'pending',
      cancelled: true,
      paymentOpen: true,
      requestActionable: false,
    },
  },

  {
    name: 'accepted cancellation',
    booking: {
      id: 'cancelled-booking',
      bookingRequestStatus: 'cancelled',
      paymentStatus: 'cancelled',
      status: 'cancelled',
      date: '2026-08-09',
      startHour: 19,
      durationHours: 1,
    },
    expected: {
      requestStatus: 'cancelled',
      paymentStatus: 'unpaid',
      sessionStatus: 'cancelled',
      legacyPaymentStatus: 'cancelled',
      cancelled: true,
      paymentOpen: true,
      requestActionable: false,
    },
  },

  {
    name: 'void invoice',
    booking: {
      id: 'void-booking',
      bookingRequestStatus: 'confirmed',
      paymentStatus: 'void',
      status: 'void',
      voidedAt: '2026-08-08T08:00:00.000Z',
      date: '2026-08-09',
      startHour: 20,
      durationHours: 1,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'void',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'void',
      cancelled: true,
      paymentOpen: false,
      requestActionable: false,
    },
  },

  {
    name: 'explicit no show',
    booking: {
      id: 'no-show',
      requestStatus: 'confirmed',
      paymentStatus: 'paid',
      sessionStatus: 'no_show',
      date: '2026-08-07',
      startHour: 10,
      durationHours: 2,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'paid',
      sessionStatus: 'no_show',
      legacyPaymentStatus: 'lunas',
      cancelled: false,
      paymentOpen: false,
      requestActionable: false,
    },
  },

  {
    name: 'canonical refunded payment remains independent from session',
    booking: {
      id: 'refunded-booking',
      requestStatus: 'confirmed',
      paymentStatus: 'refunded',
      sessionStatus: 'upcoming',
      date: '2026-08-09',
      startHour: 11,
      durationHours: 2,
    },
    expected: {
      requestStatus: 'confirmed',
      paymentStatus: 'refunded',
      sessionStatus: 'upcoming',
      legacyPaymentStatus: 'refunded',
      cancelled: false,
      paymentOpen: false,
      requestActionable: false,
    },
  },
];

for (const scenario of compatibilityMatrix) {
  const originalSnapshot = JSON.stringify(
    scenario.booking,
  );

  const normalized = normalizeBooking(
    scenario.booking,
    { now },
  );

  assert.equal(
    normalized.requestStatus,
    scenario.expected.requestStatus,
    scenario.name + ': normalized request status',
  );

  assert.equal(
    normalized.paymentStatus,
    scenario.expected.paymentStatus,
    scenario.name + ': normalized payment status',
  );

  assert.equal(
    normalized.sessionStatus,
    scenario.expected.sessionStatus,
    scenario.name + ': normalized session status',
  );

  assert.equal(
    getBookingRequestStatus(scenario.booking),
    scenario.expected.requestStatus,
    scenario.name + ': request selector',
  );

  assert.equal(
    getBookingPaymentStatus(scenario.booking),
    scenario.expected.paymentStatus,
    scenario.name + ': payment selector',
  );

  assert.equal(
    getBookingSessionStatus(
      scenario.booking,
      { now },
    ),
    scenario.expected.sessionStatus,
    scenario.name + ': session selector',
  );

  assert.equal(
    getLegacyBookingPaymentStatus(
      scenario.booking,
    ),
    scenario.expected.legacyPaymentStatus,
    scenario.name + ': legacy presentation adapter',
  );

  assert.equal(
    isBookingCancelled(scenario.booking),
    scenario.expected.cancelled,
    scenario.name + ': cancellation selector',
  );

  assert.equal(
    isBookingScheduleActive(scenario.booking),
    !scenario.expected.cancelled,
    scenario.name + ': schedule active selector',
  );

  assert.equal(
    isBookingPaymentOpen(scenario.booking),
    scenario.expected.paymentOpen,
    scenario.name + ': payment-open selector',
  );

  assert.equal(
    isBookingRequestActionable(
      scenario.booking,
    ),
    scenario.expected.requestActionable,
    scenario.name + ': actionable request selector',
  );

  assert.equal(
    JSON.stringify(scenario.booking),
    originalSnapshot,
    scenario.name + ': selector/normalizer mutated input',
  );
}

/**
 * Compatibility guard:
 * current write path must remain readable by the canonical read model.
 */

const legacyClientRequest = {
  bookingRequestStatus: 'submitted',
  paymentStatus: 'pending',
  status: 'pending',
  date: '2026-08-09',
  startHour: 10,
  durationHours: 2,
};

assert.deepEqual(
  {
    requestStatus:
      getBookingRequestStatus(
        legacyClientRequest,
      ),

    paymentStatus:
      getBookingPaymentStatus(
        legacyClientRequest,
      ),

    sessionStatus:
      getBookingSessionStatus(
        legacyClientRequest,
        { now },
      ),
  },
  {
    requestStatus: 'submitted',
    paymentStatus: 'unpaid',
    sessionStatus: 'upcoming',
  },
);

/**
 * Static architecture guard.
 *
 * Core status consumers must keep using bookingSelectors instead
 * of resurrecting ad-hoc mixed status helpers.
 */

const selectorConsumers = [
  'src/services/adminBookingRepository.js',
  'src/services/bookingCommunicationRepository.js',
  'src/pages/admin/SchedulePage.jsx',
  'src/pages/admin/BillingPage.jsx',
  'src/pages/ClientPortalPage.jsx',
  'src/components/client/ClientDashboardTab.jsx',
  'src/components/client/ClientCalendarTab.jsx',
];

for (const relativePath of selectorConsumers) {
  const source = readFileSync(
    resolve(relativePath),
    'utf8',
  );

  assert.equal(
    source.includes('bookingSelectors.js'),
    true,
    relativePath +
      ' must keep routing status decisions through bookingSelectors.',
  );
}

/**
 * Firestore compatibility guard.
 *
 * Phase 1 deliberately does NOT perform a destructive schema migration.
 */

const adminRepositorySource = readFileSync(
  resolve(
    'src/services/adminBookingRepository.js',
  ),
  'utf8',
);

assert.equal(
  adminRepositorySource.includes(
    "bookingRequestStatus: 'submitted'",
  ),
  true,
  'Client booking request legacy request field disappeared.',
);

assert.equal(
  adminRepositorySource.includes(
    "paymentStatus: 'pending'",
  ),
  true,
  'Client booking request legacy payment field disappeared.',
);

assert.equal(
  adminRepositorySource.includes(
    "status: 'pending'",
  ),
  true,
  'Client booking request legacy general status field disappeared.',
);

const communicationSource = readFileSync(
  resolve(
    'src/services/bookingCommunicationRepository.js',
  ),
  'utf8',
);

assert.equal(
  communicationSource.includes(
    "bookingRequestStatus: 'cancellation_requested'",
  ),
  true,
  'Cancellation compatibility write disappeared.',
);

assert.equal(
  communicationSource.includes(
    'bookingRequestStatus: status',
  ),
  true,
  'Admin request decision compatibility write disappeared.',
);

process.stdout.write(
  '✅ Phase 1 booking compatibility matrix passed.\n',
);
