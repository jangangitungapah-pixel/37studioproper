const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const PACKAGE_FILE = path.join(ROOT, 'package.json');

const STATUS_FILE = path.join(
  ROOT,
  'src',
  'domain',
  'booking',
  'bookingStatus.js',
);

const NORMALIZER_FILE = path.join(
  ROOT,
  'src',
  'domain',
  'booking',
  'normalizeBooking.js',
);

const TEST_FILE = path.join(
  ROOT,
  'scripts',
  'booking-normalization-test.mjs',
);

function fail(message) {
  console.error('');
  console.error(`[phase-1c] ${message}`);
  console.error('');
  process.exit(1);
}

function normalizeLineEndings(value) {
  return String(value).replace(/\r\n/g, '\n');
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const backupPath = `${filePath}.bak-${stamp}`;

  fs.copyFileSync(filePath, backupPath);

  console.log(
    `[phase-1c] Backup: ${path.relative(ROOT, backupPath)}`,
  );

  return backupPath;
}

function writeNewFileSafely(filePath, content) {
  const normalizedContent = normalizeLineEndings(content);

  if (fs.existsSync(filePath)) {
    const currentContent = normalizeLineEndings(
      fs.readFileSync(filePath, 'utf8'),
    );

    if (currentContent === normalizedContent) {
      console.log(
        `[phase-1c] Already correct: ${path.relative(ROOT, filePath)}`,
      );

      return;
    }

    fail(
      `${path.relative(ROOT, filePath)} sudah ada dengan isi berbeda. ` +
      'Patch dibatalkan agar implementasi existing tidak tertimpa.',
    );
  }

  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    filePath,
    normalizedContent,
    'utf8',
  );

  console.log(
    `[phase-1c] Created: ${path.relative(ROOT, filePath)}`,
  );
}

if (!fs.existsSync(PACKAGE_FILE)) {
  fail(
    'package.json tidak ditemukan. Jalankan script dari root repository.',
  );
}

if (!fs.existsSync(STATUS_FILE)) {
  fail(
    'src/domain/booking/bookingStatus.js tidak ditemukan. ' +
    'Phase 1B belum tersedia di branch lokal.',
  );
}

const statusSource = normalizeLineEndings(
  fs.readFileSync(STATUS_FILE, 'utf8'),
);

const requiredPhase1BAnchors = [
  'BOOKING_REQUEST_STATUS',
  'BOOKING_PAYMENT_STATUS',
  'BOOKING_SESSION_STATUS',
  'LEGACY_PAYMENT_STATUS_MAP',
  'isBookingRequestStatus',
  'isBookingPaymentStatus',
  'isBookingSessionStatus',
];

for (const anchor of requiredPhase1BAnchors) {
  if (!statusSource.includes(anchor)) {
    fail(
      `Phase 1B contract tidak lengkap. Anchor "${anchor}" tidak ditemukan.`,
    );
  }
}

const normalizerSource = `import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_REQUEST_STATUS,
  BOOKING_SESSION_STATUS,
  LEGACY_PAYMENT_STATUS_MAP,
  isBookingPaymentStatus,
  isBookingRequestStatus,
  isBookingSessionStatus,
} from './bookingStatus.js';

/**
 * Booking normalization layer.
 *
 * Tugas file ini:
 * 1. membaca dokumen booking legacy maupun canonical;
 * 2. menghasilkan tiga dimensi status canonical;
 * 3. tidak melakukan write ke Firestore;
 * 4. tidak memutasi object input;
 * 5. mempertahankan field legacy selama compatibility phase.
 */

function cleanStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-\\\\s]+/g, '_');
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getPaymentHistoryTotal(booking) {
  const history = Array.isArray(booking?.paymentHistory)
    ? booking.paymentHistory
    : [];

  return history.reduce(
    (sum, payment) =>
      sum + Math.max(0, toFiniteNumber(payment?.amount)),
    0,
  );
}

function getPaymentEvidenceAmount(booking) {
  return Math.max(
    0,
    toFiniteNumber(booking?.paidAmount),
    toFiniteNumber(booking?.dpAmount),
    getPaymentHistoryTotal(booking),
  );
}

function getBookingTotal(booking) {
  return Math.max(
    0,
    toFiniteNumber(
      booking?.total ??
      booking?.subtotal ??
      booking?.invoiceAmount,
    ),
  );
}

function normalizeRequestAlias(value) {
  const status = cleanStatus(value);

  const aliases = {
    draft: BOOKING_REQUEST_STATUS.DRAFT,

    submitted: BOOKING_REQUEST_STATUS.SUBMITTED,
    pending_request: BOOKING_REQUEST_STATUS.SUBMITTED,
    awaiting_confirmation: BOOKING_REQUEST_STATUS.SUBMITTED,

    confirmed: BOOKING_REQUEST_STATUS.CONFIRMED,
    approved: BOOKING_REQUEST_STATUS.CONFIRMED,
    accepted: BOOKING_REQUEST_STATUS.CONFIRMED,

    rejected: BOOKING_REQUEST_STATUS.REJECTED,
    denied: BOOKING_REQUEST_STATUS.REJECTED,
    declined: BOOKING_REQUEST_STATUS.REJECTED,

    cancellation_requested:
      BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED,
    cancel_requested:
      BOOKING_REQUEST_STATUS.CANCELLATION_REQUESTED,

    cancelled: BOOKING_REQUEST_STATUS.CANCELLED,
    canceled: BOOKING_REQUEST_STATUS.CANCELLED,
  };

  return aliases[status] || '';
}

function normalizeSessionAlias(value) {
  const status = cleanStatus(value);

  const aliases = {
    upcoming: BOOKING_SESSION_STATUS.UPCOMING,
    scheduled: BOOKING_SESSION_STATUS.UPCOMING,

    in_progress: BOOKING_SESSION_STATUS.IN_PROGRESS,
    active: BOOKING_SESSION_STATUS.IN_PROGRESS,
    ongoing: BOOKING_SESSION_STATUS.IN_PROGRESS,

    completed: BOOKING_SESSION_STATUS.COMPLETED,
    complete: BOOKING_SESSION_STATUS.COMPLETED,
    finished: BOOKING_SESSION_STATUS.COMPLETED,
    done: BOOKING_SESSION_STATUS.COMPLETED,

    no_show: BOOKING_SESSION_STATUS.NO_SHOW,
    noshow: BOOKING_SESSION_STATUS.NO_SHOW,
    absent: BOOKING_SESSION_STATUS.NO_SHOW,

    cancelled: BOOKING_SESSION_STATUS.CANCELLED,
    canceled: BOOKING_SESSION_STATUS.CANCELLED,
  };

  return aliases[status] || '';
}

function getCurrentDateParts(now) {
  const date = now instanceof Date
    ? now
    : new Date(now || Date.now());

  const safeDate = Number.isNaN(date.getTime())
    ? new Date()
    : date;

  return {
    dateKey:
      String(safeDate.getFullYear()) +
      '-' +
      String(safeDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(safeDate.getDate()).padStart(2, '0'),

    minuteOfDay:
      safeDate.getHours() * 60 +
      safeDate.getMinutes(),
  };
}

function getScheduleDateKey(booking) {
  const value = String(booking?.date || '').trim();

  if (/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(value)) {
    return value;
  }

  return '';
}

function getScheduleStartMinute(booking) {
  const startHour = Number(booking?.startHour);

  if (Number.isFinite(startHour)) {
    return Math.max(
      0,
      Math.round(startHour * 60),
    );
  }

  const rawTime = String(
    booking?.startTime ||
    booking?.startTimeLabel ||
    '',
  ).trim();

  const match = rawTime.match(
    /^(\\\\d{1,2})[:.](\\\\d{2})/,
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function getDurationMinutes(booking) {
  const duration = Number(
    booking?.durationHours ??
    booking?.duration ??
    1,
  );

  if (!Number.isFinite(duration) || duration <= 0) {
    return 60;
  }

  return Math.max(
    1,
    Math.round(duration * 60),
  );
}

/**
 * Request normalization.
 *
 * Priority:
 * canonical requestStatus
 * -> legacy bookingRequestStatus
 * -> safe compatibility default.
 *
 * Persisted legacy bookings without request status are treated as confirmed.
 * This avoids accidentally demoting historical/manual bookings into a new
 * pending request merely because the old schema did not have requestStatus.
 */
export function normalizeRequestStatus(booking = {}) {
  const canonicalStatus = cleanStatus(
    booking?.requestStatus,
  );

  if (isBookingRequestStatus(canonicalStatus)) {
    return canonicalStatus;
  }

  const legacyStatus = normalizeRequestAlias(
    booking?.bookingRequestStatus,
  );

  if (legacyStatus) {
    return legacyStatus;
  }

  return BOOKING_REQUEST_STATUS.CONFIRMED;
}

/**
 * Payment normalization.
 *
 * Priority:
 * explicit void marker
 * -> canonical paymentStatus
 * -> legacy paymentStatus/status
 * -> numeric payment evidence
 * -> unpaid.
 */
export function normalizePaymentStatus(booking = {}) {
  const rawPaymentStatus = cleanStatus(
    booking?.paymentStatus,
  );

  const rawLegacyStatus = cleanStatus(
    booking?.status,
  );

  if (
    booking?.voidedAt ||
    rawPaymentStatus === 'void' ||
    rawLegacyStatus === 'void'
  ) {
    return BOOKING_PAYMENT_STATUS.VOID;
  }

  if (isBookingPaymentStatus(rawPaymentStatus)) {
    return rawPaymentStatus;
  }

  if (LEGACY_PAYMENT_STATUS_MAP[rawPaymentStatus]) {
    return LEGACY_PAYMENT_STATUS_MAP[rawPaymentStatus];
  }

  if (LEGACY_PAYMENT_STATUS_MAP[rawLegacyStatus]) {
    return LEGACY_PAYMENT_STATUS_MAP[rawLegacyStatus];
  }

  if (
    rawPaymentStatus === 'refund' ||
    rawPaymentStatus === 'refunded' ||
    rawLegacyStatus === 'refund' ||
    rawLegacyStatus === 'refunded'
  ) {
    return BOOKING_PAYMENT_STATUS.REFUNDED;
  }

  const paidAmount = getPaymentEvidenceAmount(booking);
  const total = getBookingTotal(booking);

  if (
    total > 0 &&
    paidAmount >= total
  ) {
    return BOOKING_PAYMENT_STATUS.PAID;
  }

  if (paidAmount > 0) {
    return BOOKING_PAYMENT_STATUS.PARTIAL;
  }

  return BOOKING_PAYMENT_STATUS.UNPAID;
}

/**
 * Session normalization.
 *
 * Explicit session status wins.
 * Rejected/cancelled requests cannot represent an active scheduled session.
 * Otherwise status is derived from booking date/time relative to "now".
 *
 * options.now exists so tests/selectors can be deterministic.
 */
export function normalizeSessionStatus(
  booking = {},
  options = {},
) {
  const canonicalStatus = cleanStatus(
    booking?.sessionStatus,
  );

  if (isBookingSessionStatus(canonicalStatus)) {
    return canonicalStatus;
  }

  const explicitAlias =
    normalizeSessionAlias(booking?.sessionStatus) ||
    normalizeSessionAlias(booking?.sessionState);

  if (explicitAlias) {
    return explicitAlias;
  }

  const legacyGeneralStatus = normalizeSessionAlias(
    booking?.status,
  );

  if (legacyGeneralStatus) {
    return legacyGeneralStatus;
  }

  const requestStatus = normalizeRequestStatus(booking);

  if (
    requestStatus === BOOKING_REQUEST_STATUS.REJECTED ||
    requestStatus === BOOKING_REQUEST_STATUS.CANCELLED
  ) {
    return BOOKING_SESSION_STATUS.CANCELLED;
  }

  const scheduleDate = getScheduleDateKey(booking);

  if (!scheduleDate) {
    return BOOKING_SESSION_STATUS.UPCOMING;
  }

  const current = getCurrentDateParts(options.now);

  if (scheduleDate > current.dateKey) {
    return BOOKING_SESSION_STATUS.UPCOMING;
  }

  if (scheduleDate < current.dateKey) {
    return BOOKING_SESSION_STATUS.COMPLETED;
  }

  const startMinute = getScheduleStartMinute(booking);

  if (startMinute === null) {
    return BOOKING_SESSION_STATUS.UPCOMING;
  }

  const endMinute =
    startMinute +
    getDurationMinutes(booking);

  if (current.minuteOfDay < startMinute) {
    return BOOKING_SESSION_STATUS.UPCOMING;
  }

  if (current.minuteOfDay < endMinute) {
    return BOOKING_SESSION_STATUS.IN_PROGRESS;
  }

  return BOOKING_SESSION_STATUS.COMPLETED;
}

/**
 * Main read-model adapter.
 *
 * paymentStatus intentionally becomes canonical in the returned object.
 * The original legacy values remain available under statusSource.
 *
 * Input object itself is never modified.
 */
export function normalizeBooking(
  booking,
  options = {},
) {
  if (
    !booking ||
    typeof booking !== 'object' ||
    Array.isArray(booking)
  ) {
    return null;
  }

  const requestStatus =
    normalizeRequestStatus(booking);

  const paymentStatus =
    normalizePaymentStatus(booking);

  const sessionStatus =
    normalizeSessionStatus(
      {
        ...booking,
        requestStatus,
      },
      options,
    );

  return {
    ...booking,

    bookingStatusContractVersion: 1,

    requestStatus,
    paymentStatus,
    sessionStatus,

    statusSource: {
      requestStatus:
        booking.requestStatus ??
        booking.bookingRequestStatus ??
        '',

      paymentStatus:
        booking.paymentStatus ??
        booking.status ??
        '',

      sessionStatus:
        booking.sessionStatus ??
        booking.sessionState ??
        '',
    },
  };
}

export function normalizeBookings(
  bookings,
  options = {},
) {
  if (!Array.isArray(bookings)) {
    return [];
  }

  return bookings
    .map((booking) =>
      normalizeBooking(booking, options),
    )
    .filter(Boolean);
}
`;

const testSource = `import assert from 'node:assert/strict';

import {
  normalizeBooking,
  normalizeBookings,
  normalizePaymentStatus,
  normalizeRequestStatus,
  normalizeSessionStatus,
} from '../src/domain/booking/normalizeBooking.js';

/**
 * Request status compatibility.
 */
assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'submitted',
  }),
  'submitted',
);

assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'approved',
  }),
  'confirmed',
);

assert.equal(
  normalizeRequestStatus({
    bookingRequestStatus: 'canceled',
  }),
  'cancelled',
);

assert.equal(
  normalizeRequestStatus({
    requestStatus: 'cancellation_requested',
    bookingRequestStatus: 'confirmed',
  }),
  'cancellation_requested',
);

/**
 * Persisted legacy/manual bookings had no request dimension.
 * Compatibility default must remain confirmed.
 */
assert.equal(
  normalizeRequestStatus({
    paymentStatus: 'pending',
    source: 'admin',
  }),
  'confirmed',
);

/**
 * Legacy payment vocabulary.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'pending',
  }),
  'unpaid',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'dp',
  }),
  'partial',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'lunas',
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    status: 'lunas',
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    status: 'void',
  }),
  'void',
);

/**
 * Canonical payment values must pass through untouched.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'refunded',
  }),
  'refunded',
);

assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'partial',
  }),
  'partial',
);

/**
 * Numeric fallback handles partially-modernized documents.
 */
assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paidAmount: 200000,
  }),
  'partial',
);

assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paymentHistory: [
      { amount: 250000 },
      { amount: 350000 },
    ],
  }),
  'paid',
);

assert.equal(
  normalizePaymentStatus({
    total: 600000,
    paymentHistory: [],
  }),
  'unpaid',
);

/**
 * Void marker has highest payment priority.
 */
assert.equal(
  normalizePaymentStatus({
    paymentStatus: 'paid',
    voidedAt: '2026-08-08T10:00:00.000Z',
  }),
  'void',
);

/**
 * Session status is derived independently from payment.
 */
const todayMorning = new Date(
  2026,
  7,
  8,
  9,
  0,
  0,
);

const todayDuringSession = new Date(
  2026,
  7,
  8,
  11,
  0,
  0,
);

const todayAfterSession = new Date(
  2026,
  7,
  8,
  14,
  0,
  0,
);

const scheduledBooking = {
  date: '2026-08-08',
  startHour: 10,
  durationHours: 3,
};

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayMorning },
  ),
  'upcoming',
);

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayDuringSession },
  ),
  'in_progress',
);

assert.equal(
  normalizeSessionStatus(
    scheduledBooking,
    { now: todayAfterSession },
  ),
  'completed',
);

/**
 * Future/past date handling.
 */
assert.equal(
  normalizeSessionStatus(
    {
      date: '2026-08-09',
      startHour: 10,
      durationHours: 2,
    },
    { now: todayAfterSession },
  ),
  'upcoming',
);

assert.equal(
  normalizeSessionStatus(
    {
      date: '2026-08-07',
      startHour: 10,
      durationHours: 2,
    },
    { now: todayMorning },
  ),
  'completed',
);

/**
 * Explicit session values beat schedule inference.
 */
assert.equal(
  normalizeSessionStatus(
    {
      sessionStatus: 'no_show',
      date: '2026-08-09',
    },
    { now: todayMorning },
  ),
  'no_show',
);

/**
 * Rejected/cancelled request cannot remain an active session.
 */
assert.equal(
  normalizeSessionStatus(
    {
      bookingRequestStatus: 'rejected',
      date: '2026-08-09',
      startHour: 10,
    },
    { now: todayMorning },
  ),
  'cancelled',
);

assert.equal(
  normalizeSessionStatus(
    {
      bookingRequestStatus: 'cancelled',
      date: '2026-08-09',
      startHour: 10,
    },
    { now: todayMorning },
  ),
  'cancelled',
);

/**
 * Full booking normalization.
 *
 * Legacy source:
 * request=submitted
 * payment=dp
 * session schedule still upcoming
 */
{
  const original = {
    id: 'booking-normalize-001',
    bookingCode: 'BKG-20260809-TEST1',
    customer: 'Normalization Customer',
    source: 'clientPortal',

    bookingRequestStatus: 'submitted',

    paymentStatus: 'dp',
    status: 'dp',

    total: 600000,
    dpAmount: 200000,
    paidAmount: 200000,

    date: '2026-08-09',
    startHour: 10,
    durationHours: 2,
  };

  const snapshot = JSON.stringify(original);

  const normalized = normalizeBooking(
    original,
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.requestStatus,
    'submitted',
  );

  assert.equal(
    normalized.paymentStatus,
    'partial',
  );

  assert.equal(
    normalized.sessionStatus,
    'upcoming',
  );

  assert.equal(
    normalized.bookingStatusContractVersion,
    1,
  );

  assert.equal(
    normalized.statusSource.requestStatus,
    'submitted',
  );

  assert.equal(
    normalized.statusSource.paymentStatus,
    'dp',
  );

  assert.equal(
    normalized.customer,
    'Normalization Customer',
    'Non-status legacy booking fields must remain compatible.',
  );

  assert.equal(
    normalized.status,
    'dp',
    'Legacy general status must remain available during compatibility phase.',
  );

  assert.equal(
    JSON.stringify(original),
    snapshot,
    'normalizeBooking must not mutate its input.',
  );

  assert.notEqual(
    normalized,
    original,
    'normalizeBooking must return a new read-model object.',
  );
}

/**
 * Manual legacy booking defaults to confirmed request while preserving
 * independent unpaid payment state.
 */
{
  const normalized = normalizeBooking(
    {
      id: 'manual-legacy',
      paymentStatus: 'pending',
      status: 'pending',
      date: '2026-08-09',
      startHour: 12,
      durationHours: 1,
    },
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.requestStatus,
    'confirmed',
  );

  assert.equal(
    normalized.paymentStatus,
    'unpaid',
  );

  assert.equal(
    normalized.sessionStatus,
    'upcoming',
  );
}

/**
 * normalizeBookings should be safe for invalid collections/items.
 */
assert.deepEqual(
  normalizeBookings(null),
  [],
);

{
  const normalized = normalizeBookings(
    [
      null,
      {
        id: 'one',
        paymentStatus: 'pending',
      },
      false,
      {
        id: 'two',
        paymentStatus: 'lunas',
      },
    ],
    {
      now: todayMorning,
    },
  );

  assert.equal(
    normalized.length,
    2,
  );

  assert.equal(
    normalized[0].paymentStatus,
    'unpaid',
  );

  assert.equal(
    normalized[1].paymentStatus,
    'paid',
  );
}

process.stdout.write(
  '✅ Booking normalization compatibility contract passed.\\n',
);
`;

writeNewFileSafely(
  NORMALIZER_FILE,
  normalizerSource,
);

writeNewFileSafely(
  TEST_FILE,
  testSource,
);

let packageJson;

try {
  packageJson = JSON.parse(
    fs.readFileSync(PACKAGE_FILE, 'utf8'),
  );
} catch (error) {
  fail(
    `package.json tidak valid: ${error.message}`,
  );
}

if (
  !packageJson.scripts ||
  typeof packageJson.scripts.test !== 'string'
) {
  fail(
    'scripts.test tidak ditemukan di package.json.',
  );
}

const phase1ATest =
  'node scripts/booking-lifecycle-regression-test.mjs';

const phase1BTest =
  'node scripts/booking-domain-status-test.mjs';

const phase1CTest =
  'node scripts/booking-normalization-test.mjs';

const commands = packageJson.scripts.test
  .split('&&')
  .map((command) => command.trim())
  .filter(Boolean);

if (!commands.includes(phase1ATest)) {
  fail(
    'Phase 1A regression test tidak ditemukan di npm test.',
  );
}

if (!commands.includes(phase1BTest)) {
  fail(
    'Phase 1B domain status test tidak ditemukan di npm test.',
  );
}

if (!commands.includes(phase1CTest)) {
  backupFile(PACKAGE_FILE);

  packageJson.scripts.test = [
    ...commands,
    phase1CTest,
  ].join(' && ');

  fs.writeFileSync(
    PACKAGE_FILE,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );

  console.log(
    '[phase-1c] Updated: package.json',
  );
} else {
  console.log(
    '[phase-1c] package.json already contains normalization test.',
  );
}

console.log('');
console.log('✅ Phase 1C Booking Normalization Layer prepared.');
console.log('');
console.log('Read path:');
console.log('  legacy booking');
console.log('      ↓');
console.log('  normalizeBooking()');
console.log('      ↓');
console.log('  requestStatus / paymentStatus / sessionStatus');
console.log('');
console.log('Compatibility rules:');
console.log('  pending -> unpaid');
console.log('  dp      -> partial');
console.log('  lunas   -> paid');
console.log('');
console.log('Persisted legacy booking without request status -> confirmed');
console.log('Rejected/cancelled request -> cancelled session');
console.log('Session time is derived without touching Firestore');
console.log('');
console.log('No repository consumer migrated yet.');
console.log('No Firestore writes changed.');
console.log('No UI changed.');