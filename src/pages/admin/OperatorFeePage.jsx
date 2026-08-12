import { useEffect, useMemo, useState } from 'react';
import '../../styles/modules/operator-fee.css';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  HandCoins,
  Headphones,
  LoaderCircle,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserRound,
  WalletCards,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import GuardMealReconciliationPanel from '../../components/operator-fee/GuardMealReconciliationPanel.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  isGuardFeeLineEligibleByAttendance,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
import {
  OPERATOR_FEE_ENTRIES_COLLECTION,
  OPERATOR_FEE_ENTRY_STATUSES,
  getCanonicalOperatorFeeEntry,
  getOperatorFeeDuplicateRuleIds,
  getOperatorFeeEntriesForBookingRule,
  makeOperatorFeeRuleEntryId,
  postOperatorFeeEntryToBookkeeping,
  subscribeOperatorFeeEntries,
  upsertOperatorFeeEntry,
  voidOperatorFeeEntry,
} from '../../services/operatorFeeRepository.js';
import {
  OPERATOR_FEE_PERSON_ROLES,
  createEstimatedOperatorFeeLines,
  formatOperatorFeeCurrency,
  useOperatorFeeSettings,
} from '../../settings/operatorFeeSettings.js';
import { hasAdminPagePermission } from '../../utils/adminPermissions.js';

const periodOptions = [
  { key: 'today', label: 'Hari Ini', description: 'Booking hari ini' },
  { key: 'month', label: 'Bulan Ini', description: 'Booking bulan berjalan' },
  { key: 'all', label: 'Semua', description: 'Semua booking aktif' },
];

const statusOptions = [
  { key: 'attention', label: 'Perlu Aksi', description: 'Estimate, draft, reviewed' },
  { key: 'all', label: 'Semua Status', description: 'Semua fee' },
  { key: 'estimate', label: 'Estimate', description: 'Belum direview' },
  { key: 'draft', label: 'Draft', description: 'Draft belum review' },
  { key: 'reviewed', label: 'Siap Post', description: 'Sudah reviewed' },
  { key: 'posted', label: 'Posted', description: 'Sudah masuk pembukuan' },
];

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();

  return text || fallback;
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getBookingId(booking) {
  return cleanText(booking?.id || booking?.bookingId || booking?.bookingCode, 'booking');
}

function getBookingCode(booking) {
  return cleanText(booking?.bookingCode || booking?.invoiceNumber || booking?.id, 'BKG');
}

function getBookingCustomer(booking) {
  return cleanText(booking?.customer || booking?.customerName || booking?.name, 'Customer');
}

function getBookingServiceLabel(booking) {
  return cleanText(
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.sessionLabel ||
    booking?.title,
    'Booking Studio'
  );
}

function getBookingDateValue(booking) {
  if (!booking?.date) return null;

  const date = new Date(String(booking.date).includes('T') ? booking.date : booking.date + 'T00:00:00');

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatBookingDate(value) {
  if (!value) return '-';

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function getBookingDurationLabel(booking) {
  const duration = toNumber(booking?.durationHours || booking?.duration);

  return duration > 0 ? duration + ' jam' : 'Tanpa blok';
}

// Check if booking status represents an active schedule
function isBookingActive(booking) {
  const status = cleanText(booking?.paymentStatus || booking?.status, 'pending').toLowerCase();
  const requestStatus = cleanText(booking?.bookingRequestStatus).toLowerCase();

  if (['void', 'cancelled', 'canceled', 'deleted'].includes(status)) return false;
  if (['rejected', 'cancelled'].includes(requestStatus)) return false;

  return true;
}

// Check if date falls in selected filter period
function isDateInPeriod(dateValue, period) {
  if (period === 'all') return true;
  if (!dateValue) return false;

  const now = new Date();

  if (period === 'today') {
    return dateValue.getFullYear() === now.getFullYear() &&
      dateValue.getMonth() === now.getMonth() &&
      dateValue.getDate() === now.getDate();
  }

  if (period === 'month') {
    return dateValue.getFullYear() === now.getFullYear() &&
      dateValue.getMonth() === now.getMonth();
  }

  return true;
}

function getPeopleOptions(settings, role, selectedPersonId = '') {
  const allowedRoles = role === OPERATOR_FEE_PERSON_ROLES.GUARD
    ? [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.BOTH]
    : [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, OPERATOR_FEE_PERSON_ROLES.BOTH];

  const people = settings.people
    .filter(
      (person) =>
        allowedRoles.includes(person.role) &&
        (person.active || person.id === selectedPersonId)
    )
    .map((person) => ({
      key: person.id,
      label: person.name + (person.active ? '' : ' · nonaktif'),
      description: person.active
        ? person.defaultPaymentMethod || 'cash'
        : 'Histori · pilih crew aktif untuk assignment baru',
    }));

  return [
    { key: 'none', label: 'Belum dipilih', description: 'Assignment wajib sebelum review.' },
    ...people,
  ];
}

function getPersonById(settings, personId) {
  return settings.people.find((person) => person.id === personId) || null;
}

function getEntriesByBooking(entries, booking) {
  const bookingId = getBookingId(booking);
  const bookingCode = getBookingCode(booking);

  return entries.filter((entry) =>
    entry.bookingId === bookingId ||
    entry.bookingCode === bookingCode
  );
}

function getActiveRuleIds(lines = []) {
  return new Set(lines.map((line) => line.ruleId).filter(Boolean));
}

function getEntryStatusPriority(status) {
  if (status === OPERATOR_FEE_ENTRY_STATUSES.POSTED) return 4;
  if (status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED) return 3;
  if (status === OPERATOR_FEE_ENTRY_STATUSES.DRAFT) return 2;
  return 0;
}

function getPersistedPersonIdForRole(entries, booking, role) {
  return getEntriesByBooking(entries, booking)
    .filter(
      (entry) =>
        entry.status !== OPERATOR_FEE_ENTRY_STATUSES.VOID &&
        entry.payeeRole === role &&
        entry.personId
    )
    .sort((first, second) => {
      const priority =
        getEntryStatusPriority(second.status) -
        getEntryStatusPriority(first.status);

      if (priority) return priority;

      return String(second.updatedAt || second.createdAt || '')
        .localeCompare(String(first.updatedAt || first.createdAt || ''));
    })[0]?.personId || '';
}

function getApprovedGuardCandidates(settings, sessions, booking) {
  const date = cleanText(booking?.date);

  if (!date) return [];

  const approvedPersonIds = new Set(
    sessions
      .filter(
        (session) =>
          session.date === date &&
          session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED &&
          [
            GUARD_ATTENDANCE_STATUSES.ACTIVE,
            GUARD_ATTENDANCE_STATUSES.CLOSED,
          ].includes(session.status) &&
          session.guardPersonId
      )
      .map((session) => session.guardPersonId)
  );

  return settings.people.filter(
    (person) =>
      person.active &&
      approvedPersonIds.has(person.id) &&
      [
        OPERATOR_FEE_PERSON_ROLES.GUARD,
        OPERATOR_FEE_PERSON_ROLES.BOTH,
      ].includes(person.role)
  );
}

function getBookingFeeStatus(
  entries,
  booking,
  lines,
  {
    assignmentDirty = false,
    hasUnassigned = false,
  } = {},
) {
  const ruleIds = [...getActiveRuleIds(lines)];

  if (!ruleIds.length) return 'estimate';

  const statuses = ruleIds.map((ruleId) =>
    getCanonicalOperatorFeeEntry(entries, booking, ruleId)?.status || 'estimate'
  );
  const hasPersistedEntry = statuses.some((status) => status !== 'estimate');

  if (statuses.every((status) => status === OPERATOR_FEE_ENTRY_STATUSES.POSTED)) {
    return 'posted';
  }

  if (assignmentDirty || hasUnassigned) {
    return hasPersistedEntry ? 'draft' : 'estimate';
  }

  if (
    statuses.every((status) =>
      [
        OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
        OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      ].includes(status)
    )
  ) {
    return 'reviewed';
  }

  if (
    statuses.some((status) =>
      [
        OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
        OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
        OPERATOR_FEE_ENTRY_STATUSES.POSTED,
      ].includes(status)
    )
  ) {
    return 'draft';
  }

  return 'estimate';
}

function getStatusLabel(status) {
  if (status === 'posted') return 'Posted';
  if (status === 'reviewed') return 'Siap Post';
  if (status === 'draft') return 'Draft';

  return 'Perlu Review';
}

function getStatusTone(status) {
  if (status === 'posted') return 'success';
  if (status === 'reviewed') return 'info';
  if (status === 'draft') return 'warning';

  return 'muted';
}

function buildEntryFromLine(
  line,
  booking,
  person,
  existingEntry = null,
  status = OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
) {
  return {
    ...line,
    id:
      existingEntry?.id ||
      makeOperatorFeeRuleEntryId({
        bookingId: getBookingId(booking),
        ruleId: line.ruleId,
      }),
    amount: line.amount,
    bookingCode: getBookingCode(booking),
    bookingDate: cleanText(booking?.date),
    bookingId: getBookingId(booking),
    createdAt: existingEntry?.createdAt,
    mealAmount: 0,
    note: existingEntry?.note || 'Generated from Operator Fee page.',
    overtimeAmount: 0,
    paymentMethod: person?.defaultPaymentMethod || existingEntry?.paymentMethod || 'cash',
    personId: cleanText(person?.id || line.personId),
    personName: cleanText(person?.name || line.personName, 'Crew Studio'),
    status,
    totalAmount: line.amount,
  };
}

function getSearchBlob(row) {
  const booking = row.booking;

  return [
    getBookingCode(booking),
    getBookingCustomer(booking),
    getBookingServiceLabel(booking),
    row.guardPerson?.name,
    row.operatorPerson?.name,
    row.lines.map((line) => line.ruleName).join(' '),
    row.blockedLines.map((line) => line.ruleName).join(' '),
  ].join(' ').toLowerCase();
}

function getRowPrimaryAction(row) {
  if (row.hardPostedDuplicateRuleIds.length) return 'Audit';
  if (row.unassignedLines.length) return 'Assign';
  if (row.blockedLines.length) return 'Absen';
  if (!row.lines.length) return 'No Rule';
  if (row.status === 'posted') return 'Posted';
  if (row.status === 'reviewed') return 'Post';
  if (row.status === 'draft') return 'Review';

  return 'Review';
}

function OperatorFeeEditorialHeader({ period, summary }) {
  const periodLabel = periodOptions.find((option) => option.key === period)?.label || 'Periode';

  return (
    <header className="operator-fee-editorial-header">
      <div className="operator-fee-heading">
        <span className="operator-fee-kicker">Crew reconciliation</span>
        <h2 id="operator-fee-title">Operator Fee</h2>
        <p>
          Review fee crew, pastikan assignment tepat, lalu post ke pembukuan tanpa
          memutus jejak rekonsiliasi.
        </p>
      </div>

      <div className="operator-fee-period-context" aria-label={'Konteks ' + periodLabel}>
        <span className="operator-fee-period-icon" aria-hidden="true">
          <CalendarDays size={16} />
        </span>
        <span>
          <small>{periodLabel}</small>
          <strong>{summary.totalRows} booking</strong>
          <em>{summary.needsReview + summary.readyPost} antrean aktif</em>
        </span>
      </div>
    </header>
  );
}

function OperatorFeePulse({ summary }) {
  const metrics = [
    {
      key: 'review',
      icon: ClipboardCheck,
      label: 'Perlu Review',
      value: String(summary.needsReview),
      meta: formatOperatorFeeCurrency(summary.estimate + summary.draft),
      tone: 'warning',
    },
    {
      key: 'post',
      icon: WalletCards,
      label: 'Siap Post',
      value: String(summary.readyPost),
      meta: formatOperatorFeeCurrency(summary.reviewed),
      tone: 'info',
    },
    {
      key: 'posted',
      icon: CheckCircle2,
      label: 'Posted',
      value: formatOperatorFeeCurrency(summary.posted),
      meta: 'sudah masuk pembukuan',
      tone: 'success',
    },
    {
      key: 'total',
      icon: Banknote,
      label: 'Estimasi Total',
      value: formatOperatorFeeCurrency(summary.total),
      meta: summary.totalRows + ' booking · termasuk fee menunggu eligibility',
      tone: 'neutral',
    },
  ];

  return (
    <section className="operator-fee-pulse" aria-label="Ringkasan operator fee">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className={'operator-fee-pulse-metric is-' + metric.tone} key={metric.key}>
            <span className="operator-fee-pulse-icon" aria-hidden="true">
              <Icon size={15} />
            </span>
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <em>{metric.meta}</em>
            </span>
          </article>
        );
      })}
    </section>
  );
}

function OperatorFeeBulkActions({
  busyKey,
  onPostMany,
  onReviewMany,
  postableCount,
  reviewableCount,
}) {
  return (
    <section className="operator-fee-bulk-actions" aria-label="Aksi rekonsiliasi massal">
      <div>
        <span className="operator-fee-bulk-icon" aria-hidden="true">
          <HandCoins size={16} />
        </span>
        <span>
          <small>Approval queue</small>
          <strong>Selesaikan antrean secara berurutan</strong>
          <em>Review lebih dulu, lalu post fee yang sudah siap.</em>
        </span>
      </div>

      <div className="operator-fee-bulk-buttons">
        <button
          disabled={busyKey !== '' || !reviewableCount}
          type="button"
          onClick={onReviewMany}
        >
          {busyKey === 'bulk-review' ? (
            <LoaderCircle className="auth-spin" size={14} />
          ) : (
            <ClipboardCheck size={14} />
          )}
          <span>
            Review Semua
            <small>{reviewableCount} booking</small>
          </span>
        </button>

        <button
          className="is-primary"
          disabled={busyKey !== '' || !postableCount}
          type="button"
          onClick={onPostMany}
        >
          {busyKey === 'bulk-post' ? (
            <LoaderCircle className="auth-spin" size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>
            Post Reviewed
            <small>{postableCount} booking</small>
          </span>
        </button>
      </div>
    </section>
  );
}

function OperatorFeeCommandShelf({
  filteredCount,
  onPeriodChange,
  onReset,
  onSearchChange,
  onStatusChange,
  period,
  searchQuery,
  statusFilter,
  totalCount,
}) {
  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'attention';

  return (
    <section className="operator-fee-command-shelf" aria-label="Filter operator fee">
      <label className="operator-fee-search-shell">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Cari operator fee"
          placeholder="Cari customer, booking, layanan, atau crew..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="operator-fee-filter-select">
        <StudioSelect
          label="Periode"
          options={periodOptions}
          selectedKey={period}
          onChange={onPeriodChange}
        />
      </div>

      <div className="operator-fee-filter-select">
        <StudioSelect
          label="Status"
          options={statusOptions}
          selectedKey={statusFilter}
          onChange={onStatusChange}
        />
      </div>

      <div className="operator-fee-filter-context" aria-live="polite">
        <span>
          <strong>{filteredCount}</strong>
          <small>dari {totalCount} booking</small>
        </span>
        {hasActiveFilters ? (
          <button type="button" onClick={onReset}>
            Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}

function OperatorFeeLedgerState({ type }) {
  if (type === 'loading') {
    return (
      <div className="operator-fee-ledger-state is-loading" role="status">
        <span className="operator-fee-state-icon" aria-hidden="true">
          <LoaderCircle className="auth-spin" size={19} />
        </span>
        <strong>Menyusun antrean fee...</strong>
        <span>Booking, attendance, dan entry rekonsiliasi sedang disinkronkan.</span>
        <div className="operator-fee-state-skeleton" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="operator-fee-ledger-state is-error" role="alert">
        <span className="operator-fee-state-icon" aria-hidden="true">
          <AlertTriangle size={19} />
        </span>
        <strong>Antrean belum berhasil dimuat</strong>
        <span>Cek koneksi atau akses Firestore, lalu muat ulang halaman.</span>
      </div>
    );
  }

  return (
    <div className="operator-fee-ledger-state is-empty">
      <span className="operator-fee-state-icon" aria-hidden="true">
        <UserRound size={19} />
      </span>
      <strong>Tidak ada fee di filter ini</strong>
      <span>Ubah periode, status, atau pencarian untuk melihat antrean lain.</span>
    </div>
  );
}

export default function OperatorFeePage({ currentUser }) {
  const settings = useOperatorFeeSettings();
  const [bookings, setBookings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [guardSessions, setGuardSessions] = useState([]);
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignments, setAssignments] = useState({});
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [loadingState, setLoadingState] = useState({
    bookings: true,
    entries: true,
    guardSessions: true,
  });
  const [loadErrors, setLoadErrors] = useState({
    bookings: '',
    entries: '',
    guardSessions: '',
  });
  const canManageOperatorFee = hasAdminPagePermission(currentUser, 'operator-fee');

  useEffect(() => {
    if (!canManageOperatorFee) return undefined;

    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (nextBookings) => {
        setBookings(Array.isArray(nextBookings) ? nextBookings : []);
        setLoadingState((current) => ({ ...current, bookings: false }));
        setLoadErrors((current) => ({ ...current, bookings: '' }));
      },
      (error) => {
        console.error('[operator-fee] Gagal membaca booking:', error);
        setMessage('Gagal membaca booking untuk Operator Fee.');
        setLoadingState((current) => ({ ...current, bookings: false }));
        setLoadErrors((current) => ({ ...current, bookings: 'booking' }));
      }
    );

    return unsubscribe;
  }, [canManageOperatorFee]);

  useEffect(() => {
    if (!canManageOperatorFee) return undefined;

    const unsubscribe = subscribeOperatorFeeEntries(
      (nextEntries) => {
        setEntries(Array.isArray(nextEntries) ? nextEntries : []);
        setLoadingState((current) => ({ ...current, entries: false }));
        setLoadErrors((current) => ({ ...current, entries: '' }));
      },
      (error) => {
        console.error('[operator-fee] Gagal membaca operator fee entries:', error);
        setMessage('Gagal membaca ' + OPERATOR_FEE_ENTRIES_COLLECTION + '.');
        setLoadingState((current) => ({ ...current, entries: false }));
        setLoadErrors((current) => ({ ...current, entries: 'entries' }));
      }
    );

    return unsubscribe;
  }, [canManageOperatorFee]);

  useEffect(() => {
    if (!canManageOperatorFee) return undefined;

    return subscribeGuardAttendanceSessions(
      {},
      (nextSessions) => {
        setGuardSessions(Array.isArray(nextSessions) ? nextSessions : []);
        setLoadingState((current) => ({ ...current, guardSessions: false }));
        setLoadErrors((current) => ({ ...current, guardSessions: '' }));
      },
      (error) => {
        console.error('[operator-fee] Gagal membaca absen penjaga:', error);
        setMessage('Gagal membaca mapping absen penjaga untuk Operator Fee.');
        setLoadingState((current) => ({ ...current, guardSessions: false }));
        setLoadErrors((current) => ({ ...current, guardSessions: 'attendance' }));
      }
    );
  }, [canManageOperatorFee]);

  const activeBookings = useMemo(() => {
    return bookings
      .filter(isBookingActive)
      .filter((booking) => isDateInPeriod(getBookingDateValue(booking), period))
      .sort((first, second) => {
        const firstDate = getBookingDateValue(first)?.getTime() || 0;
        const secondDate = getBookingDateValue(second)?.getTime() || 0;

        return firstDate - secondDate;
      });
  }, [bookings, period]);

  const rows = useMemo(() => {
    return activeBookings.map((booking) => {
      const bookingId = getBookingId(booking);
      const assignment = assignments[bookingId] || {};
      const persistedGuardId = getPersistedPersonIdForRole(
        entries,
        booking,
        OPERATOR_FEE_PERSON_ROLES.GUARD,
      );
      const persistedOperatorId = getPersistedPersonIdForRole(
        entries,
        booking,
        OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
      );
      const attendanceGuardCandidates = getApprovedGuardCandidates(
        settings,
        guardSessions,
        booking,
      );
      const automaticGuardId =
        attendanceGuardCandidates.length === 1
          ? attendanceGuardCandidates[0].id
          : '';
      const hasGuardOverride = Object.prototype.hasOwnProperty.call(assignment, 'guardId');
      const hasOperatorOverride = Object.prototype.hasOwnProperty.call(assignment, 'operatorId');
      const guardId =
        (hasGuardOverride ? assignment.guardId : '') ||
        persistedGuardId ||
        automaticGuardId ||
        'none';
      const operatorId =
        (hasOperatorOverride ? assignment.operatorId : '') ||
        persistedOperatorId ||
        'none';
      const guardPerson = getPersonById(settings, guardId);
      const operatorPerson = getPersonById(settings, operatorId);
      const estimatedLines = createEstimatedOperatorFeeLines({
        assignedPeopleByRole: {
          [OPERATOR_FEE_PERSON_ROLES.GUARD]: guardPerson,
          [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR]: operatorPerson,
        },
        booking,
        includeUnassigned: true,
        settings,
      });
      const unassignedLines = estimatedLines.filter((line) => line.requiresAssignment);
      const assignedLines = estimatedLines.filter((line) => !line.requiresAssignment);
      const lines = assignedLines.filter((line) =>
        isGuardFeeLineEligibleByAttendance(line, guardSessions)
      );
      const blockedLines = assignedLines.filter((line) =>
        !isGuardFeeLineEligibleByAttendance(line, guardSessions)
      );
      const activeRuleIds = getActiveRuleIds(estimatedLines);
      const duplicateRuleIds = getOperatorFeeDuplicateRuleIds(entries, booking)
        .filter((ruleId) => activeRuleIds.has(ruleId));
      const hardPostedDuplicateRuleIds = duplicateRuleIds.filter(
        (ruleId) =>
          getOperatorFeeEntriesForBookingRule(entries, booking, ruleId)
            .filter((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED)
            .length > 1
      );
      const assignmentDirty = Boolean(
        (
          persistedGuardId &&
          guardId !== 'none' &&
          guardId !== persistedGuardId
        ) ||
        (
          persistedOperatorId &&
          operatorId !== 'none' &&
          operatorId !== persistedOperatorId
        )
      );
      const postedDriftLines = assignedLines.filter((line) => {
        const postedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).find((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        if (!postedEntry) return false;

        return (
          Number(postedEntry.totalAmount || postedEntry.amount || 0) !==
            Number(line.amount || 0) ||
          (
            line.personId &&
            postedEntry.personId &&
            line.personId !== postedEntry.personId
          )
        );
      });
      const status = getBookingFeeStatus(
        entries,
        booking,
        estimatedLines,
        {
          assignmentDirty,
          hasUnassigned: Boolean(unassignedLines.length),
        },
      );
      const postedSnapshotAmount = estimatedLines.reduce((total, line) => {
        const postedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).find((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        return postedEntry
          ? total + Number(postedEntry.totalAmount || postedEntry.amount || 0)
          : total;
      }, 0);
      const unpostedEstimatedAmount = estimatedLines.reduce((total, line) => {
        const hasPostedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        if (hasPostedEntry) {
          return total;
        }

        return total + toNumber(line.amount);
      }, 0);
      const unpostedPayableAmount = estimatedLines.reduce((total, line) => {
        const hasPostedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        if (
          hasPostedEntry ||
          line.requiresAssignment ||
          !isGuardFeeLineEligibleByAttendance(line, guardSessions)
        ) {
          return total;
        }

        return total + toNumber(line.amount);
      }, 0);
      const blockedEstimateAmount = blockedLines.reduce((total, line) => {
        const hasPostedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        return hasPostedEntry
          ? total
          : total + toNumber(line.amount);
      }, 0);
      const unassignedEstimateAmount = unassignedLines.reduce((total, line) => {
        const hasPostedEntry = getOperatorFeeEntriesForBookingRule(
          entries,
          booking,
          line.ruleId,
        ).some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        return hasPostedEntry
          ? total
          : total + toNumber(line.amount);
      }, 0);
      const totalFee = postedSnapshotAmount + unpostedEstimatedAmount;
      const canReconcile = Boolean(
        estimatedLines.length &&
        !unassignedLines.length &&
        !blockedLines.length &&
        !hardPostedDuplicateRuleIds.length &&
        lines.length === estimatedLines.length
      );

      return {
        allRuleLines: estimatedLines,
        assignmentDirty,
        attendanceGuardCandidates,
        blockedEstimateAmount,
        blockedLines,
        booking,
        bookingId,
        canReconcile,
        duplicateRuleIds,
        guardId,
        guardPerson,
        hardPostedDuplicateRuleIds,
        lines,
        operatorId,
        operatorPerson,
        postedDriftLines,
        postedSnapshotAmount,
        status,
        totalFee,
        unassignedEstimateAmount,
        unassignedLines,
        unpostedEstimatedAmount,
        unpostedPayableAmount,
      };
    });
  }, [activeBookings, assignments, entries, guardSessions, settings]);

  const filteredRows = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const statusMatches = statusFilter === 'all'
        ? true
        : statusFilter === 'attention'
          ? row.status !== 'posted'
          : row.status === statusFilter;

      const searchMatches = !cleanQuery || getSearchBlob(row).includes(cleanQuery);

      return statusMatches && searchMatches;
    });
  }, [rows, searchQuery, statusFilter]);

  const actionRows = useMemo(
    () => filteredRows.filter((row) => row.canReconcile && row.status !== 'posted'),
    [filteredRows]
  );
  const reviewableRows = useMemo(
    () => actionRows.filter((row) => row.status === 'estimate' || row.status === 'draft'),
    [actionRows]
  );
  const postableRows = useMemo(
    () => filteredRows.filter((row) => row.canReconcile && row.status === 'reviewed'),
    [filteredRows]
  );

  const postedSnapshotTotal = useMemo(
    () =>
      entries
        .filter((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED)
        .filter((entry) =>
          isDateInPeriod(
            getBookingDateValue({
              date: entry.bookingDate,
            }),
            period,
          )
        )
        .reduce(
          (total, entry) =>
            total + Number(entry.totalAmount || entry.amount || 0),
          0,
        ),
    [entries, period]
  );

  const summary = useMemo(() => {
    const current = rows.reduce((result, row) => ({
      draft:
        result.draft +
        (row.status === 'draft' ? row.unpostedEstimatedAmount : 0),
      estimate:
        result.estimate +
        (row.status === 'estimate' ? row.unpostedEstimatedAmount : 0),
      integrityWarnings:
        result.integrityWarnings +
        (
          row.duplicateRuleIds.length ||
          row.postedDriftLines.length
            ? 1
            : 0
        ),
      reviewed:
        result.reviewed +
        (
          row.status === 'reviewed' && row.canReconcile
            ? row.unpostedPayableAmount
            : 0
        ),
      unpostedTotal:
        result.unpostedTotal +
        row.unpostedEstimatedAmount,
      needsReview:
        result.needsReview +
        (row.status === 'estimate' || row.status === 'draft' ? 1 : 0),
      readyPost:
        result.readyPost +
        (row.status === 'reviewed' && row.canReconcile ? 1 : 0),
      totalRows: result.totalRows + 1,
      unassignedBookings:
        result.unassignedBookings +
        (row.unassignedLines.length ? 1 : 0),
    }), {
      draft: 0,
      estimate: 0,
      integrityWarnings: 0,
      readyPost: 0,
      reviewed: 0,
      totalRows: 0,
      needsReview: 0,
      unassignedBookings: 0,
      unpostedTotal: 0,
    });

    return {
      ...current,
      posted: postedSnapshotTotal,
      total: postedSnapshotTotal + current.unpostedTotal,
    };
  }, [postedSnapshotTotal, rows]);

  function updateAssignment(bookingId, field, value) {
    setAssignments((current) => ({
      ...current,
      [bookingId]: {
        ...(current[bookingId] || {}),
        [field]: value,
      },
    }));

    if (message) setMessage('');
  }

  function createEntryPayloads(row, status = OPERATOR_FEE_ENTRY_STATUSES.DRAFT) {
    return row.lines.map((line) => {
      const person = line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD
        ? row.guardPerson
        : row.operatorPerson;
      const existingEntry = getCanonicalOperatorFeeEntry(
        entries,
        row.booking,
        line.ruleId,
      );

      return buildEntryFromLine(
        line,
        row.booking,
        person,
        existingEntry?.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED
          ? null
          : existingEntry,
        status,
      );
    });
  }

  function getReconciliationBlockMessage(row) {
    if (row.hardPostedDuplicateRuleIds.length) {
      return 'Ada duplicate fee yang sudah Posted untuk booking ini. Posting diblokir agar Pembukuan tidak double-count.';
    }

    if (row.unassignedLines.length) {
      return 'Assign semua PIC Guard/Operator terlebih dahulu sebelum Review.';
    }

    if (row.blockedLines.length) {
      return 'Fee Guard masih menunggu attendance approved pada tanggal booking.';
    }

    if (!row.lines.length) {
      return 'Belum ada rule fee yang cocok untuk booking ini.';
    }

    return '';
  }

  async function syncRowEntries(row, status) {
    const blockMessage = getReconciliationBlockMessage(row);

    if (blockMessage) {
      throw new Error(blockMessage);
    }

    let consolidatedCount = 0;
    const payloadByRuleId = new Map(
      createEntryPayloads(row, status)
        .map((payload) => [payload.ruleId, payload])
    );

    for (const line of row.lines) {
      const relatedEntries = getOperatorFeeEntriesForBookingRule(
        entries,
        row.booking,
        line.ruleId,
      );
      const postedEntries = relatedEntries.filter(
        (entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED
      );

      if (postedEntries.length > 1) {
        throw new Error(
          'Duplicate Posted terdeteksi untuk rule ' + line.ruleName + '. Posting diblokir.'
        );
      }

      if (postedEntries.length === 1) {
        for (const duplicate of relatedEntries) {
          if (
            duplicate.id !== postedEntries[0].id &&
            duplicate.status !== OPERATOR_FEE_ENTRY_STATUSES.POSTED
          ) {
            await voidOperatorFeeEntry(
              duplicate,
              'Superseded: canonical rule sudah Posted.',
            );
            consolidatedCount += 1;
          }
        }

        continue;
      }

      const payload = payloadByRuleId.get(line.ruleId);

      if (!payload) {
        throw new Error('Payload canonical fee tidak terbentuk untuk ' + line.ruleName + '.');
      }

      await upsertOperatorFeeEntry(payload);

      for (const duplicate of relatedEntries) {
        if (
          duplicate.id !== payload.id &&
          duplicate.status !== OPERATOR_FEE_ENTRY_STATUSES.POSTED
        ) {
          await voidOperatorFeeEntry(
            duplicate,
            'Superseded by canonical booking + rule fee entry.',
          );
          consolidatedCount += 1;
        }
      }
    }

    return consolidatedCount;
  }

  async function saveDraft(row) {
    setBusyKey(row.bookingId);

    try {
      const consolidatedCount = await syncRowEntries(
        row,
        OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
      );

      setMessage(
        'Draft fee ' +
        getBookingCode(row.booking) +
        ' disimpan.' +
        (consolidatedCount ? ' ' + consolidatedCount + ' duplicate draft lama di-void.' : '')
      );
    } catch (error) {
      console.error('[operator-fee] Gagal menyimpan draft fee:', error);
      setMessage(error?.message || 'Draft fee gagal disimpan.');
    } finally {
      setBusyKey('');
    }
  }

  async function markReviewed(row) {
    setBusyKey(row.bookingId);

    try {
      const consolidatedCount = await syncRowEntries(
        row,
        OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
      );

      setMessage(
        'Fee ' +
        getBookingCode(row.booking) +
        ' sudah reviewed.' +
        (consolidatedCount ? ' ' + consolidatedCount + ' duplicate draft lama di-void.' : '')
      );
    } catch (error) {
      console.error('[operator-fee] Gagal mark reviewed:', error);
      setMessage(error?.message || 'Gagal menandai fee sebagai reviewed.');
    } finally {
      setBusyKey('');
    }
  }

  async function reviewMany(targetRows) {
    const rowsToReview = targetRows.filter(
      (row) =>
        row.canReconcile &&
        row.status !== 'posted' &&
        row.status !== 'reviewed'
    );

    if (!rowsToReview.length) {
      setMessage('Tidak ada fee lengkap yang siap direview di filter ini.');
      return;
    }

    setBusyKey('bulk-review');

    try {
      let consolidatedCount = 0;

      for (const row of rowsToReview) {
        consolidatedCount += await syncRowEntries(
          row,
          OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
        );
      }

      setMessage(
        rowsToReview.length +
        ' booking berhasil direview.' +
        (consolidatedCount ? ' ' + consolidatedCount + ' duplicate draft lama di-void.' : '') +
        ' Cek sekilas, lalu Post Reviewed.'
      );
    } catch (error) {
      console.error('[operator-fee] Gagal bulk review:', error);
      setMessage(error?.message || 'Bulk review gagal.');
    } finally {
      setBusyKey('');
    }
  }

  async function postToBookkeeping(row) {
    if (!row.canReconcile) {
      setMessage(getReconciliationBlockMessage(row));
      return;
    }

    setBusyKey(row.bookingId);

    try {
      await syncRowEntries(
        row,
        OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
      );

      const canonicalEntries = [...getActiveRuleIds(row.allRuleLines)]
        .map((ruleId) =>
          getCanonicalOperatorFeeEntry(entries, row.booking, ruleId)
        )
        .filter(Boolean);
      const postedEntries = canonicalEntries.filter(
        (entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED
      );

      if (
        postedEntries.length &&
        postedEntries.length === row.allRuleLines.length
      ) {
        setMessage('Fee ' + getBookingCode(row.booking) + ' sudah pernah diposting.');
        return;
      }

      const reviewedEntries = canonicalEntries.filter(
        (entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED
      );

      if (!reviewedEntries.length) {
        setMessage('Review fee dulu sebelum posting ke pembukuan.');
        return;
      }

      const createdEntries = [];

      for (const entry of reviewedEntries) {
        const result =
          await postOperatorFeeEntryToBookkeeping(
            entry,
            row.booking,
            currentUser?.uid || '',
          );

        createdEntries.push(result.bookkeepingEntry);
      }

      setMessage(
        createdEntries.length +
        ' fee ' +
        getBookingCode(row.booking) +
        ' diposting ke pembukuan.'
      );
    } catch (error) {
      console.error('[operator-fee] Gagal posting fee ke pembukuan:', error);
      setMessage(error?.message || 'Posting fee ke pembukuan gagal.');
    } finally {
      setBusyKey('');
    }
  }

  async function postMany(targetRows) {
    const rowsToPost = targetRows.filter(
      (row) => row.canReconcile && row.status === 'reviewed'
    );

    if (!rowsToPost.length) {
      setMessage('Tidak ada fee reviewed lengkap yang siap diposting.');
      return;
    }

    setBusyKey('bulk-post');

    try {
      let postedCount = 0;

      for (const row of rowsToPost) {
        await syncRowEntries(
          row,
          OPERATOR_FEE_ENTRY_STATUSES.REVIEWED,
        );

        const reviewedEntries = [...getActiveRuleIds(row.allRuleLines)]
          .map((ruleId) =>
            getCanonicalOperatorFeeEntry(entries, row.booking, ruleId)
          )
          .filter(
            (entry) =>
              entry?.status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED
          );

        for (const entry of reviewedEntries) {
          await postOperatorFeeEntryToBookkeeping(
            entry,
            row.booking,
            currentUser?.uid || '',
          );

          postedCount += 1;
        }
      }

      setMessage(postedCount + ' fee berhasil diposting ke pembukuan.');
    } catch (error) {
      console.error('[operator-fee] Gagal bulk post:', error);
      setMessage(error?.message || 'Bulk post gagal.');
    } finally {
      setBusyKey('');
    }
  }

  async function handlePrimaryAction(row) {
    if (row.status === 'posted' || !row.lines.length) return;
    if (row.status === 'reviewed') {
      await postToBookkeeping(row);
      return;
    }

    await markReviewed(row);
  }

  const isQueueLoading = loadingState.bookings || loadingState.entries || loadingState.guardSessions;
  const queueLoadError = loadErrors.bookings || loadErrors.entries || loadErrors.guardSessions;

  if (!canManageOperatorFee) {
    return (
      <section className="operator-fee-page operator-fee-locked" data-operator-fee-ui="ui-8-spatial">
        <span aria-hidden="true">
          <ShieldAlert size={22} />
        </span>
        <div>
          <small>Permission required</small>
          <h2>Akses Operator Fee Belum Aktif</h2>
          <p>Owner perlu memberi permission Operator Fee untuk akun ini.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="operator-fee-queue"
      data-operator-fee-ui="ui-8-spatial"
      aria-labelledby="operator-fee-title"
    >
      <OperatorFeeEditorialHeader period={period} summary={summary} />

      <GuardMealReconciliationPanel
        busyKey={busyKey}
        currentUser={currentUser}
        isLoading={loadingState.guardSessions}
        loadError={loadErrors.guardSessions}
        onBusyChange={setBusyKey}
        onMessage={setMessage}
        period={period}
        sessions={guardSessions}
        settings={settings}
      />

      {summary.unassignedBookings || summary.integrityWarnings ? (
        <div className="operator-fee-ledger-warning" role="status">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>
            {summary.unassignedBookings
              ? summary.unassignedBookings + ' booking masih butuh assignment crew. '
              : ''}
            {summary.integrityWarnings
              ? summary.integrityWarnings + ' booking punya jejak fee yang perlu dicek.'
              : ''}
            Review/Post hanya aktif jika satu booking sudah konsisten.
          </span>
        </div>
      ) : null}

      <OperatorFeePulse summary={summary} />

      <OperatorFeeBulkActions
        busyKey={busyKey}
        postableCount={postableRows.length}
        reviewableCount={reviewableRows.length}
        onPostMany={() => postMany(filteredRows)}
        onReviewMany={() => reviewMany(filteredRows)}
      />

      <OperatorFeeCommandShelf
        filteredCount={filteredRows.length}
        period={period}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        totalCount={rows.length}
        onPeriodChange={setPeriod}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onReset={() => {
          setSearchQuery('');
          setStatusFilter('attention');
        }}
      />

      {message ? (
        <p className="operator-fee-queue-message" role="status">
          {message}
        </p>
      ) : null}

      <section
        className="operator-fee-queue-list"
        aria-label="Antrean rekonsiliasi operator fee"
        aria-busy={isQueueLoading ? 'true' : 'false'}
      >
        <header className="operator-fee-ledger-header">
          <div>
            <span>Fee reconciliation ledger</span>
            <strong>{filteredRows.length} booking ditemukan</strong>
          </div>
          <p>
            <ShieldCheck size={13} aria-hidden="true" />
            Posted entries bersifat read-only
          </p>
        </header>

        <div className="operator-fee-ledger-columns" aria-hidden="true">
          <span>Booking / Crew</span>
          <span>Status &amp; Total</span>
          <span>Aksi</span>
        </div>

        {queueLoadError && filteredRows.length ? (
          <div className="operator-fee-ledger-warning" role="status">
            <AlertTriangle size={13} aria-hidden="true" />
            Sebagian data gagal disinkronkan. Data tersedia tetap ditampilkan.
          </div>
        ) : null}

        {isQueueLoading && !filteredRows.length ? <OperatorFeeLedgerState type="loading" /> : null}
        {!isQueueLoading && queueLoadError && !filteredRows.length ? <OperatorFeeLedgerState type="error" /> : null}
        {!isQueueLoading && !queueLoadError && !filteredRows.length ? <OperatorFeeLedgerState type="empty" /> : null}

        {filteredRows.length ? (
          filteredRows.map((row) => {
            const booking = row.booking;
            const isBusy = busyKey === row.bookingId;
            const statusTone = getStatusTone(row.status);
            const primaryActionLabel = getRowPrimaryAction(row);
            const primaryDisabled =
              busyKey !== '' ||
              row.status === 'posted' ||
              !row.canReconcile;

            return (
              <article
                className={'operator-fee-queue-row' + (row.status === 'posted' ? ' is-posted' : '')}
                key={row.bookingId}
              >
                <div className="operator-fee-queue-main">
                  <span className="operator-fee-row-icon" aria-hidden="true">
                    <Headphones size={15} />
                  </span>
                  <div className="operator-fee-queue-info">
                    <div className="operator-fee-meta-top">
                      <span>{getBookingCode(booking)}</span>
                      <span className="dot-separator">·</span>
                      <span>{formatBookingDate(booking.date)}</span>
                      <span className="dot-separator">·</span>
                      <span className="service-label">{getBookingServiceLabel(booking)}</span>
                    </div>
                    <strong className="operator-fee-customer">{getBookingCustomer(booking)}</strong>
                    <div className="operator-fee-meta-bottom">
                      <span>{getBookingDurationLabel(booking)}</span>
                      <span className="dot-separator">·</span>
                      <span>Penjaga: {row.guardPerson ? row.guardPerson.name : 'Default'}</span>
                      <span className="dot-separator">·</span>
                      <span>Operator: {row.operatorPerson ? row.operatorPerson.name : 'Default'}</span>
                      {row.unassignedLines.length > 0 && (
                        <>
                          <span className="dot-separator">·</span>
                          <span className="text-warning">
                            {row.unassignedLines.length} crew belum di-assign
                          </span>
                        </>
                      )}
                      {row.blockedLines.length > 0 && (
                        <>
                          <span className="dot-separator">·</span>
                          <span className="text-warning">Menunggu absen approved</span>
                        </>
                      )}
                      {row.attendanceGuardCandidates.length > 1 && row.guardId === 'none' && (
                        <>
                          <span className="dot-separator">·</span>
                          <span className="text-warning">
                            {row.attendanceGuardCandidates.length} Guard hadir · pilih PIC
                          </span>
                        </>
                      )}
                      {row.hardPostedDuplicateRuleIds.length > 0 && (
                        <>
                          <span className="dot-separator">·</span>
                          <span className="text-warning">Duplicate Posted terdeteksi</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="operator-fee-amount-col">
                    <b className="operator-fee-total-amount">{formatOperatorFeeCurrency(row.totalFee)}</b>
                    {row.blockedEstimateAmount > 0 ? (
                      <small>
                        Termasuk {formatOperatorFeeCurrency(row.blockedEstimateAmount)} Guard menunggu absen
                      </small>
                    ) : row.unassignedEstimateAmount > 0 ? (
                      <small>
                        Termasuk {formatOperatorFeeCurrency(row.unassignedEstimateAmount)} fee belum di-assign
                      </small>
                    ) : null}
                    <span className={'operator-fee-status-dot is-' + statusTone}>
                      <span className="status-dot"></span>
                      {getStatusLabel(row.status)}
                    </span>
                  </div>

                  <div className="operator-fee-action-col">
                    <button
                      disabled={primaryDisabled}
                      type="button"
                      className="operator-fee-row-btn"
                      onClick={() => handlePrimaryAction(row)}
                    >
                      {isBusy ? <LoaderCircle className="auth-spin" size={13} /> : null}
                      {primaryActionLabel}
                    </button>
                  </div>
                </div>

                <details className="operator-fee-queue-detail">
                  <summary>
                    <span>Detail fee &amp; override crew</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </summary>

                  <div className="operator-fee-queue-detail-grid">
                    <StudioSelect
                      disabled={row.status === 'posted'}
                      label="Penjaga"
                      options={getPeopleOptions(
                        settings,
                        OPERATOR_FEE_PERSON_ROLES.GUARD,
                        row.guardId,
                      )}
                      selectedKey={row.guardId}
                      onChange={(value) => updateAssignment(row.bookingId, 'guardId', value)}
                    />

                    <StudioSelect
                      disabled={row.status === 'posted'}
                      label="Operator"
                      options={getPeopleOptions(
                        settings,
                        OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR,
                        row.operatorId,
                      )}
                      selectedKey={row.operatorId}
                      onChange={(value) => updateAssignment(row.bookingId, 'operatorId', value)}
                    />
                  </div>

                  <div className="operator-fee-queue-lines">
                    {row.lines.length ? row.lines.map((line) => (
                      <span key={line.id}>
                        <small>{line.ruleName}</small>
                        <strong>{formatOperatorFeeCurrency(line.amount)}</strong>
                      </span>
                    )) : !row.blockedLines.length ? (
                      <p>Belum ada rule yang cocok. Tambahkan rule di Settings → Fee Settings.</p>
                    ) : null}
                    {row.unassignedLines.map((line) => (
                      <span key={'unassigned-' + line.id}>
                        <small>
                          {line.ruleName} · pilih {
                            line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD
                              ? 'Guard'
                              : 'Operator'
                          }
                        </small>
                        <strong>{formatOperatorFeeCurrency(line.amount)}</strong>
                      </span>
                    ))}
                    {row.blockedLines.map((line) => (
                      <span key={'blocked-' + line.id}>
                        <small>{line.ruleName} · menunggu absen approved</small>
                        <strong>{formatOperatorFeeCurrency(line.amount)}</strong>
                      </span>
                    ))}
                    {row.duplicateRuleIds.length ? (
                      <p className="operator-fee-empty-note">
                        Ditemukan entry lama ganda untuk {row.duplicateRuleIds.length} rule.
                        Draft/Reviewed duplikat akan otomatis di-void saat Review.
                      </p>
                    ) : null}
                    {row.postedDriftLines.length ? (
                      <p className="operator-fee-empty-note">
                        {row.postedDriftLines.length} rule sudah Posted tetapi nominal/assignment
                        setting sekarang berbeda. Pembukuan tetap memakai snapshot saat posting.
                      </p>
                    ) : null}
                  </div>

                  <div className="operator-fee-queue-detail-actions">
                    <button
                      disabled={busyKey !== '' || row.status === 'posted' || !row.canReconcile}
                      type="button"
                      onClick={() => saveDraft(row)}
                    >
                      Simpan Draft
                    </button>
                    <button
                      disabled={busyKey !== '' || row.status === 'posted' || !row.canReconcile}
                      type="button"
                      onClick={() => markReviewed(row)}
                    >
                      Mark Reviewed
                    </button>
                  </div>
                </details>
              </article>
            );
          })
        ) : null}
      </section>
    </section>
  );
}
