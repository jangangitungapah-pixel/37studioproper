const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  repository: path.join(
    ROOT,
    'src',
    'services',
    'operatorFeeRepository.js',
  ),

  schedule: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'SchedulePage.jsx',
  ),

  adminPage: path.join(
    ROOT,
    'src',
    'pages',
    'AdminPage.jsx',
  ),

  drawer: path.join(
    ROOT,
    'src',
    'components',
    'booking',
    'BookingDetailDrawer.jsx',
  ),

  scheduleCss: path.join(
    ROOT,
    'src',
    'styles',
    'modules',
    'schedule.css',
  ),

  drawerCss: path.join(
    ROOT,
    'src',
    'styles',
    'modules',
    'booking-detail-drawer.css',
  ),

  test: path.join(
    ROOT,
    'scripts',
    'operator-fee-booking-visibility-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),

  docs: path.join(
    ROOT,
    'docs',
    'operator-fee-architecture.md',
  ),
};

const staged = new Map();

function fail(message) {
  console.error('');
  console.error(
    '❌ [phase-7b] ' +
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
  return source
    .split(needle)
    .length -
    1;
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
      'ℹ️ Already applied: ' +
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
    '✅ Staged: ' +
      label,
  );
}

function insertBeforeUnique(
  file,
  anchor,
  insertion,
  alreadyMarker,
  label,
) {
  const source =
    read(file);

  if (
    alreadyMarker &&
    source.includes(
      alreadyMarker,
    )
  ) {
    console.log(
      'ℹ️ Already applied: ' +
        label,
    );

    return;
  }

  const count =
    countOccurrences(
      source,
      anchor,
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
      anchor,
      insertion +
        anchor,
    ),
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function stageNewFile(
  file,
  content,
) {
  const normalized =
    normalize(content);

  if (
    fs.existsSync(file)
  ) {
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
        'ℹ️ Already correct: ' +
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
    '✅ Staged new file: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

/**
 * ============================================================
 * BASELINE VALIDATION
 * ============================================================
 */

const packageBaseline =
  read(
    FILES.packageJson,
  );

if (
  !packageBaseline.includes(
    'operator-fee-posting-reconciliation-contract-test.mjs',
  )
) {
  fail(
    'Phase 7A contract belum ada di npm test.',
  );
}

if (
  !read(
    FILES.repository,
  ).includes(
    'postOperatorFeeEntryToBookkeeping'
  )
) {
  fail(
    'Atomic Operator Fee repository Phase 7A belum ditemukan.',
  );
}

if (
  read(
    FILES.schedule,
  ).includes(
    'postOperatorFeeEntryToBookkeeping'
  )
) {
  fail(
    'Schedule sudah memiliki Operator Fee write path. Abort.',
  );
}

/**
 * ============================================================
 * 1. SHARED READ-ONLY OPERATOR FEE VISIBILITY
 * ============================================================
 */

const visibilityHelpers = `export const OPERATOR_FEE_VISIBILITY_STATUSES =
  Object.freeze({
    DRAFT:
      'draft',

    ESTIMATE:
      'estimate',

    POSTED:
      'posted',

    REVIEWED:
      'reviewed',
  });

function getOperatorFeeBookingIdentity(
  booking = {},
) {
  return {
    bookingCode:
      cleanText(
        booking?.bookingCode ||
          booking?.invoiceNumber ||
          booking?.id,
      ),

    bookingId:
      cleanText(
        booking?.id ||
          booking?.bookingId ||
          booking?.bookingCode,
      ),
  };
}

export function getOperatorFeeEntriesForBooking(
  entries = [],
  booking = {},
) {
  const {
    bookingCode,
    bookingId,
  } =
    getOperatorFeeBookingIdentity(
      booking,
    );

  const sourceEntries =
    Array.isArray(
      entries,
    )
      ? entries
      : [];

  return sourceEntries
    .map(
      (
        entry,
      ) =>
        normalizeOperatorFeeEntry(
          entry,
        ),
    )
    .filter(
      (
        entry,
      ) =>
        entry.status !==
          OPERATOR_FEE_ENTRY_STATUSES.VOID &&
        (
          (
            bookingId &&
            entry.bookingId ===
              bookingId
          ) ||
          (
            bookingCode &&
            entry.bookingCode ===
              bookingCode
          )
        ),
    );
}

export function getBookingOperatorFeeVisibility(
  entries = [],
  booking = {},
) {
  const relatedEntries =
    getOperatorFeeEntriesForBooking(
      entries,
      booking,
    );

  let status =
    OPERATOR_FEE_VISIBILITY_STATUSES.ESTIMATE;

  if (
    relatedEntries.length
  ) {
    const statuses =
      relatedEntries.map(
        (
          entry,
        ) =>
          entry.status,
      );

    if (
      statuses.every(
        (
          entryStatus,
        ) =>
          entryStatus ===
          OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.POSTED;
    } else if (
      statuses.every(
        (
          entryStatus,
        ) =>
          [
            OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
            OPERATOR_FEE_ENTRY_STATUSES.POSTED,
          ].includes(
            entryStatus,
          ),
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.REVIEWED;
    } else if (
      statuses.some(
        (
          entryStatus,
        ) =>
          [
            OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
            OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
            OPERATOR_FEE_ENTRY_STATUSES.POSTED,
          ].includes(
            entryStatus,
          ),
      )
    ) {
      status =
        OPERATOR_FEE_VISIBILITY_STATUSES.DRAFT;
    }
  }

  const statusMeta = {
    draft: {
      label:
        'Fee Draft',

      shortLabel:
        'Fee Draft',
    },

    estimate: {
      label:
        'Fee Belum Direview',

      shortLabel:
        'Fee?',
    },

    posted: {
      label:
        'Fee Posted',

      shortLabel:
        'Fee Posted',
    },

    reviewed: {
      label:
        'Fee Siap Post',

      shortLabel:
        'Fee Ready',
    },
  }[status];

  return {
    entryCount:
      relatedEntries.length,

    label:
      statusMeta.label,

    shortLabel:
      statusMeta.shortLabel,

    status,

    totalAmount:
      relatedEntries.reduce(
        (
          total,
          entry,
        ) =>
          total +
          Number(
            entry.totalAmount ||
              entry.amount ||
              0,
          ),
        0,
      ),
  };
}

`;

insertBeforeUnique(
  FILES.repository,

  'export function subscribeOperatorFeeEntries(callback, onError) {',

  visibilityHelpers,

  'export const OPERATOR_FEE_VISIBILITY_STATUSES',

  'shared booking Operator Fee visibility',
);

/**
 * ============================================================
 * 2. ADMIN PAGE PASSES CURRENT USER
 * ============================================================
 */

replaceOnce(
  FILES.adminPage,

  `  return <SchedulePage />;`,

  `  return <SchedulePage currentUser={currentUser} />;`,

  'Schedule receives current admin account',
);

/**
 * ============================================================
 * 3. SCHEDULE IMPORTS
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';
`,

  `import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';
import {
  getBookingOperatorFeeVisibility,
  subscribeOperatorFeeEntries,
} from '../../services/operatorFeeRepository.js';
import {
  hasAdminPagePermission,
} from '../../utils/adminPermissions.js';
`,

  'Schedule Operator Fee visibility imports',
);

/**
 * ============================================================
 * 4. CALENDAR BOOKING BLOCK
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `function CalendarBookingBlock({ block, onBookingClick }) {`,

  `function CalendarBookingBlock({
  block,
  onBookingClick,
  operatorFeeVisibility,
}) {`,

  'Calendar booking fee visibility prop',
);

replaceOnce(
  FILES.schedule,

  `      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>
        <b>{priceLabel}</b>
      </span>`,

  `      <span className="schedule-booking-meta">
        <span>{startLabel} • {durationLabel}</span>

        {operatorFeeVisibility ? (
          <span
            aria-label={operatorFeeVisibility.label}
            className={
              'schedule-booking-fee-indicator is-' +
              operatorFeeVisibility.status
            }
            role="img"
            title={operatorFeeVisibility.label}
          />
        ) : null}

        <b>{priceLabel}</b>
      </span>`,

  'Calendar booking fee indicator',
);

/**
 * ============================================================
 * 5. UPCOMING BOOKINGS
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `function ScheduleUpcomingTable({ bookings, onBookingClick }) {`,

  `function ScheduleUpcomingTable({
  bookings,
  getOperatorFeeVisibility,
  onBookingClick,
}) {`,

  'Upcoming booking fee resolver prop',
);

replaceOnce(
  FILES.schedule,

  `            const serviceLabel = booking.packageLabel || booking.sessionLabel || booking.title || 'Sesi Studio';

            return (`,

  `            const serviceLabel = booking.packageLabel || booking.sessionLabel || booking.title || 'Sesi Studio';

            const operatorFeeVisibility =
              getOperatorFeeVisibility
                ? getOperatorFeeVisibility(
                    booking,
                  )
                : null;

            return (`,

  'Upcoming booking resolves fee visibility',
);

replaceOnce(
  FILES.schedule,

  `                <span className="schedule-upcoming-meta">
                  <span>{formatBookingDateLabel(booking)}</span>
                  <b>{getUpcomingScheduleTimeLabel(booking)}</b>
                </span>`,

  `                <span className="schedule-upcoming-meta">
                  <span>{formatBookingDateLabel(booking)}</span>

                  <b>{getUpcomingScheduleTimeLabel(booking)}</b>

                  {operatorFeeVisibility ? (
                    <i
                      className={
                        'schedule-upcoming-fee is-' +
                        operatorFeeVisibility.status
                      }
                    >
                      {operatorFeeVisibility.shortLabel}
                    </i>
                  ) : null}
                </span>`,

  'Upcoming fee status badge',
);

/**
 * ============================================================
 * 6. CALENDAR GRID
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `function CalendarGrid({
  activeStatuses,
  bookings,
  onSlotClick,`,

  `function CalendarGrid({
  activeStatuses,
  bookings,
  getOperatorFeeVisibility,
  onSlotClick,`,

  'CalendarGrid fee resolver prop',
);

replaceOnce(
  FILES.schedule,

  `          {bookingBlocks.map((block) => (
            <CalendarBookingBlock
              block={block}
              key={block.booking.id || block.dayKey + '-' + block.startIndex + '-' + block.booking.customer}
              onBookingClick={onBookingClick}
            />
          ))}`,

  `          {bookingBlocks.map((block) => (
            <CalendarBookingBlock
              block={block}
              key={block.booking.id || block.dayKey + '-' + block.startIndex + '-' + block.booking.customer}
              onBookingClick={onBookingClick}
              operatorFeeVisibility={
                getOperatorFeeVisibility
                  ? getOperatorFeeVisibility(
                      block.booking,
                    )
                  : null
              }
            />
          ))}`,

  'CalendarGrid passes fee visibility',
);

/**
 * ============================================================
 * 7. SCHEDULE PAGE ACCOUNT + STATE
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `export default function SchedulePage() {`,

  `export default function SchedulePage({
  currentUser,
}) {`,

  'Schedule currentUser prop',
);

replaceOnce(
  FILES.schedule,

  `  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);`,

  `  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  const [operatorFeeEntries, setOperatorFeeEntries] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);`,

  'Schedule Operator Fee entries state',
);

replaceOnce(
  FILES.schedule,

  `  const [todayFocusRequest, setTodayFocusRequest] = useState(0);

  // One-time local storage migration to Firestore`,

  `  const [todayFocusRequest, setTodayFocusRequest] = useState(0);

  const canViewOperatorFee =
    hasAdminPagePermission(
      currentUser,
      'operator-fee',
    );

  // One-time local storage migration to Firestore`,

  'Schedule Operator Fee permission gate',
);

/**
 * ============================================================
 * 8. PERMISSION-GATED READ SUBSCRIPTION
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `  const rangeLabel = formatRangeLabel(selectedDate, viewMode);`,

  `  useEffect(() => {
    if (
      isScheduleQaPreview ||
      !canViewOperatorFee
    ) {
      return undefined;
    }

    return subscribeOperatorFeeEntries(
      (
        nextEntries,
      ) => {
        setOperatorFeeEntries(
          Array.isArray(
            nextEntries,
          )
            ? nextEntries
            : [],
        );
      },
      (
        error,
      ) => {
        console.error(
          '[schedule] Gagal membaca Operator Fee visibility:',
          error,
        );
      },
    );
  }, [
    canViewOperatorFee,
  ]);

  function resolveOperatorFeeVisibility(
    booking,
  ) {
    if (
      !canViewOperatorFee
    ) {
      return null;
    }

    return getBookingOperatorFeeVisibility(
      operatorFeeEntries,
      booking,
    );
  }

  const rangeLabel = formatRangeLabel(selectedDate, viewMode);`,

  'Schedule permission-gated Operator Fee subscription',
);

/**
 * ============================================================
 * 9. SCHEDULE RENDER WIRING
 * ============================================================
 */

replaceOnce(
  FILES.schedule,

  `        <ScheduleUpcomingTable
          bookings={bookings}
          onBookingClick={openBookingDetail}
        />`,

  `        <ScheduleUpcomingTable
          bookings={bookings}
          getOperatorFeeVisibility={resolveOperatorFeeVisibility}
          onBookingClick={openBookingDetail}
        />`,

  'Upcoming list receives fee resolver',
);

replaceOnce(
  FILES.schedule,

  `          <CalendarGrid
            activeStatuses={activeStatuses}
            bookings={bookings}
            onBookingClick={openBookingDetail}`,

  `          <CalendarGrid
            activeStatuses={activeStatuses}
            bookings={bookings}
            getOperatorFeeVisibility={resolveOperatorFeeVisibility}
            onBookingClick={openBookingDetail}`,

  'Calendar receives fee resolver',
);

replaceOnce(
  FILES.schedule,

  `      <BookingDetailDrawer
        booking={selectedBookingDetail}
        isOpen={Boolean(selectedBookingDetail)}
        onClose={closeBookingDetail}
        onEdit={editBookingFromDetail}
      />`,

  `      <BookingDetailDrawer
        booking={selectedBookingDetail}
        isOpen={Boolean(selectedBookingDetail)}
        onClose={closeBookingDetail}
        onEdit={editBookingFromDetail}
        operatorFeeVisibility={
          selectedBookingDetail
            ? resolveOperatorFeeVisibility(
                selectedBookingDetail,
              )
            : null
        }
      />`,

  'Booking drawer receives fee visibility',
);

/**
 * ============================================================
 * 10. BOOKING DETAIL DRAWER
 * ============================================================
 */

replaceOnce(
  FILES.drawer,

  `  onEdit,
  onRequestStatusChange,
  user,
}) {`,

  `  onEdit,
  onRequestStatusChange,
  operatorFeeVisibility = null,
  user,
}) {`,

  'Booking drawer optional Operator Fee visibility prop',
);

replaceOnce(
  FILES.drawer,

  `          <StatusChip
            label={
              SESSION_STATUS_LABELS[
                sessionStatus
              ] ||
              sessionStatus
            }
            tone={
              'session-' +
              sessionStatus
            }
          />
        </section>`,

  `          <StatusChip
            label={
              SESSION_STATUS_LABELS[
                sessionStatus
              ] ||
              sessionStatus
            }
            tone={
              'session-' +
              sessionStatus
            }
          />

          {operatorFeeVisibility ? (
            <StatusChip
              label={
                operatorFeeVisibility.label
              }
              tone={
                'fee-' +
                operatorFeeVisibility.status
              }
            />
          ) : null}
        </section>`,

  'Booking drawer fee status chip',
);

/**
 * ============================================================
 * 11. SCHEDULE CSS
 * ============================================================
 */

replaceOnce(
  FILES.scheduleCss,

  `.schedule-booking-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  color: var(--auth-text-muted);
  font-size: var(--studio-text-xs);
}`,

  `.schedule-booking-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  color: var(--auth-text-muted);
  font-size: var(--studio-text-xs);
}

.schedule-booking-meta > b {
  grid-column: 3;
}

.schedule-booking-fee-indicator {
  width: 7px;
  height: 7px;
  display: inline-block;
  border: 1px solid var(--auth-border-strong);
  border-radius: 999px;
  background: var(--auth-text-muted);
  flex: 0 0 auto;
}

.schedule-booking-fee-indicator.is-draft {
  border-color: var(--auth-warning);
  background: var(--auth-warning);
}

.schedule-booking-fee-indicator.is-reviewed {
  border-color: var(--auth-info);
  background: var(--auth-info);
}

.schedule-booking-fee-indicator.is-posted {
  border-color: var(--auth-success);
  background: var(--auth-success);
}

.schedule-upcoming-fee {
  width: fit-content;
  justify-self: end;
  border: 1px solid var(--auth-border);
  border-radius: var(--studio-radius-full);
  background: var(--auth-bg-soft);
  color: var(--auth-text-muted);
  padding: 2px 6px;
  font-size: 0.625rem;
  font-style: normal;
  font-weight: 680;
  line-height: 1.2;
}

.schedule-upcoming-fee.is-draft {
  border-color:
    color-mix(
      in srgb,
      var(--auth-warning) 32%,
      var(--auth-border)
    );
  background: var(--auth-warning-soft);
  color: var(--auth-warning);
}

.schedule-upcoming-fee.is-reviewed {
  border-color:
    color-mix(
      in srgb,
      var(--auth-info) 32%,
      var(--auth-border)
    );
  background: var(--auth-info-soft);
  color: var(--auth-info);
}

.schedule-upcoming-fee.is-posted {
  border-color:
    color-mix(
      in srgb,
      var(--auth-success) 32%,
      var(--auth-border)
    );
  background: var(--auth-success-soft);
  color: var(--auth-success);
}`,

  'Schedule Operator Fee visibility styles',
);

/**
 * ============================================================
 * 12. DRAWER CSS
 *
 * Anchor intentionally includes the first property so it does
 * not collide with responsive .booking-detail-drawer-tabs blocks.
 * ============================================================
 */

replaceOnce(
  FILES.drawerCss,

  `.booking-detail-drawer-tabs {
  flex: 0 0 auto;`,

  `.booking-detail-drawer-status.is-fee-draft {
  border-color:
    color-mix(
      in srgb,
      var(--auth-warning) 34%,
      var(--auth-border)
    );
  background: var(--auth-warning-soft);
  color: var(--auth-warning);
}

.booking-detail-drawer-status.is-fee-reviewed {
  border-color:
    color-mix(
      in srgb,
      var(--auth-info) 34%,
      var(--auth-border)
    );
  background: var(--auth-info-soft);
  color: var(--auth-info);
}

.booking-detail-drawer-status.is-fee-posted {
  border-color:
    color-mix(
      in srgb,
      var(--auth-success) 34%,
      var(--auth-border)
    );
  background: var(--auth-success-soft);
  color: var(--auth-success);
}

.booking-detail-drawer-tabs {
  flex: 0 0 auto;`,

  'Booking drawer Operator Fee status styles',
);

/**
 * ============================================================
 * 13. CONTRACT TEST
 * ============================================================
 */

const testSource = `import assert from 'node:assert/strict';

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
  '✅ Operator Fee Booking Visibility contract passed.\\n',
);
`;

stageNewFile(
  FILES.test,
  testSource,
);

/**
 * ============================================================
 * 14. REGISTER TEST
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

const phase7a =
  'node scripts/operator-fee-posting-reconciliation-contract-test.mjs';

const phase7b =
  'node scripts/operator-fee-booking-visibility-contract-test.mjs';

const testCommands =
  String(
    packageJson
      ?.scripts
      ?.test ||
      '',
  )
    .split(
      '&&',
    )
    .map(
      (
        command,
      ) =>
        command.trim(),
    )
    .filter(
      Boolean,
    );

if (
  !testCommands.includes(
    phase7a,
  )
) {
  fail(
    'Phase 7A contract hilang dari npm test.',
  );
}

if (
  !testCommands.includes(
    phase7b,
  )
) {
  packageJson.scripts.test =
    [
      ...testCommands,
      phase7b,
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

  console.log(
    '✅ Staged: register Phase 7B contract in npm test',
  );
}

/**
 * ============================================================
 * 15. ARCHITECTURE DOC
 * ============================================================
 */

let docs =
  read(
    FILES.docs,
  );

const docsMarker =
  '## OPF-6 - Schedule & Booking Fee Visibility';

if (
  !docs.includes(
    docsMarker,
  )
) {
  docs =
    docs.trimEnd() +
    `

## OPF-6 - Schedule & Booking Fee Visibility

Read-only Operator Fee visibility is exposed to authorized Schedule users:

\`\`\`txt
Schedule booking
-> Fee Belum Direview
-> Fee Draft
-> Fee Siap Post
-> Fee Posted

Booking Detail Drawer
-> same Operator Fee lifecycle badge
\`\`\`

Permission boundary:

\`\`\`txt
schedule + operator-fee
-> may read internal fee status

schedule without operator-fee
-> does not subscribe to operatorFeeEntries
-> does not expose internal fee status
\`\`\`

Write ownership remains unchanged:

\`\`\`txt
Schedule
-> read only

Operator Fee page / repository
-> review + posting write owner
\`\`\`

This phase does not change Firestore rules.
`;

  stage(
    FILES.docs,
    docs,
  );

  console.log(
    '✅ Staged: OPF-6 architecture documentation',
  );
}

/**
 * ============================================================
 * FINAL VALIDATION BEFORE ANY WRITE
 * ============================================================
 */

const nextRepository =
  read(
    FILES.repository,
  );

for (
  const required
  of [
    'OPERATOR_FEE_VISIBILITY_STATUSES',
    'getOperatorFeeEntriesForBooking',
    'getBookingOperatorFeeVisibility',
    'postOperatorFeeEntryToBookkeeping',
  ]
) {
  if (
    !nextRepository.includes(
      required,
    )
  ) {
    fail(
      'Repository contract kehilangan: ' +
        required,
    );
  }
}

const nextSchedule =
  read(
    FILES.schedule,
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
  ]
) {
  if (
    !nextSchedule.includes(
      required,
    )
  ) {
    fail(
      'Schedule visibility kehilangan: ' +
        required,
    );
  }
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
  if (
    nextSchedule.includes(
      forbidden,
    )
  ) {
    fail(
      'Schedule memiliki write ownership terlarang: ' +
        forbidden,
    );
  }
}

const nextAdmin =
  read(
    FILES.adminPage,
  );

if (
  !nextAdmin.includes(
    '<SchedulePage currentUser={currentUser} />'
  )
) {
  fail(
    'AdminPage belum meneruskan currentUser ke Schedule.',
  );
}

const nextDrawer =
  read(
    FILES.drawer,
  );

for (
  const required
  of [
    'operatorFeeVisibility = null',
    'operatorFeeVisibility.label',
    "'fee-' +",
  ]
) {
  if (
    !nextDrawer.includes(
      required,
    )
  ) {
    fail(
      'Booking Drawer visibility kehilangan: ' +
        required,
    );
  }
}

const nextScheduleCss =
  read(
    FILES.scheduleCss,
  );

for (
  const required
  of [
    '.schedule-booking-fee-indicator',
    '.schedule-upcoming-fee',
    '.schedule-booking-fee-indicator.is-posted',
  ]
) {
  if (
    !nextScheduleCss.includes(
      required,
    )
  ) {
    fail(
      'Schedule CSS kehilangan: ' +
        required,
    );
  }
}

const nextDrawerCss =
  read(
    FILES.drawerCss,
  );

for (
  const required
  of [
    '.booking-detail-drawer-status.is-fee-draft',
    '.booking-detail-drawer-status.is-fee-reviewed',
    '.booking-detail-drawer-status.is-fee-posted',
  ]
) {
  if (
    !nextDrawerCss.includes(
      required,
    )
  ) {
    fail(
      'Drawer CSS kehilangan: ' +
        required,
    );
  }
}

const nextPackage =
  read(
    FILES.packageJson,
  );

if (
  !nextPackage.includes(
    'operator-fee-booking-visibility-contract-test.mjs',
  )
) {
  fail(
    'Phase 7B contract belum terdaftar di package.json.',
  );
}

/**
 * Ensure 7B did NOT touch Firestore rules.
 */
if (
  staged.has(
    path.join(
      ROOT,
      'firestore.rules',
    ),
  )
) {
  fail(
    'Phase 7B tidak boleh mengubah firestore.rules.',
  );
}

/**
 * ============================================================
 * WRITE LAST
 * ============================================================
 */

console.log('');
console.log(
  '✅ All Phase 7B validations passed.',
);
console.log(
  'Writing staged files...',
);
console.log('');

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
    '✅ Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ Phase 7B Operator Fee Booking Visibility prepared.',
);
console.log('');
console.log('Visibility:');
console.log('  Fee Belum Direview');
console.log('  Fee Draft');
console.log('  Fee Siap Post');
console.log('  Fee Posted');
console.log('');
console.log('Security boundary:');
console.log('  operator-fee permission required');
console.log('  Schedule remains read-only');
console.log('');
console.log('No Firestore rules change.');
console.log('No finance write change.');