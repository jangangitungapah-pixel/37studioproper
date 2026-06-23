import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  LoaderCircle,
  Save,
  ShieldAlert,
  UserRound,
  WalletCards,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import {
  OPERATOR_FEE_ENTRIES_COLLECTION,
  OPERATOR_FEE_ENTRY_STATUSES,
  markOperatorFeeEntryReviewed,
  subscribeOperatorFeeEntries,
  upsertOperatorFeeEntry,
} from '../../services/operatorFeeRepository.js';
import {
  OPERATOR_FEE_PERSON_ROLES,
  createEstimatedOperatorFeeLines,
  formatOperatorFeeCurrency,
  useOperatorFeeSettings,
} from '../../settings/operatorFeeSettings.js';
import { isOwnerAdminUser } from '../../utils/adminPermissions.js';

const periodOptions = [
  { key: 'today', label: 'Hari Ini', description: 'Jadwal hari ini' },
  { key: 'month', label: 'Bulan Ini', description: 'Jadwal bulan berjalan' },
  { key: 'all', label: 'Semua', description: 'Semua jadwal aktif' },
];

const statusOptions = [
  { key: 'all', label: 'Semua Status', description: 'Estimate, draft, reviewed, posted' },
  { key: 'estimate', label: 'Estimate', description: 'Belum disimpan sebagai draft' },
  { key: 'draft', label: 'Draft', description: 'Sudah tersimpan, belum review' },
  { key: 'reviewed', label: 'Reviewed', description: 'Sudah dicek owner' },
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
    year: 'numeric',
  }).format(date);
}

function getBookingDurationLabel(booking) {
  const duration = toNumber(booking?.durationHours || booking?.duration);

  return duration > 0 ? duration + ' jam' : 'Tanpa durasi studio';
}

function isBookingActive(booking) {
  const status = cleanText(booking?.paymentStatus || booking?.status, 'pending').toLowerCase();
  const requestStatus = cleanText(booking?.bookingRequestStatus).toLowerCase();

  if (['void', 'cancelled', 'canceled', 'deleted'].includes(status)) return false;
  if (['rejected', 'cancelled'].includes(requestStatus)) return false;

  return true;
}

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

function getPeopleOptions(settings, role) {
  const allowedRoles = role === OPERATOR_FEE_PERSON_ROLES.GUARD
    ? [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.BOTH]
    : [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR, OPERATOR_FEE_PERSON_ROLES.BOTH];

  const people = settings.people
    .filter((person) => person.active && allowedRoles.includes(person.role))
    .map((person) => ({
      key: person.id,
      label: person.name,
      description: person.defaultPaymentMethod || 'cash',
    }));

  return [
    { key: 'none', label: 'Belum dipilih', description: 'Fee masih bisa dihitung sebagai estimasi.' },
    ...people,
  ];
}

function getPersonById(settings, personId) {
  return settings.people.find((person) => person.id === personId) || null;
}

function getDefaultPersonId(settings, role) {
  const options = getPeopleOptions(settings, role);

  return options.find((item) => item.key !== 'none')?.key || 'none';
}

function getEntriesByBooking(entries, booking) {
  const bookingId = getBookingId(booking);
  const bookingCode = getBookingCode(booking);

  return entries.filter((entry) =>
    entry.bookingId === bookingId ||
    entry.bookingCode === bookingCode
  );
}

function getBookingFeeStatus(entries, booking) {
  const relatedEntries = getEntriesByBooking(entries, booking);

  if (!relatedEntries.length) return 'estimate';
  if (relatedEntries.some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED)) return 'posted';
  if (relatedEntries.some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED)) return 'reviewed';

  return 'draft';
}

function getStatusLabel(status) {
  if (status === 'posted') return 'Posted';
  if (status === 'reviewed') return 'Reviewed';
  if (status === 'draft') return 'Draft';

  return 'Estimate';
}

function getStatusTone(status) {
  if (status === 'posted') return 'success';
  if (status === 'reviewed') return 'info';
  if (status === 'draft') return 'warning';

  return 'muted';
}

function buildEntryFromLine(line, booking, person) {
  return {
    ...line,
    id: line.id,
    amount: line.amount,
    bookingCode: getBookingCode(booking),
    bookingDate: cleanText(booking?.date),
    bookingId: getBookingId(booking),
    mealAmount: 0,
    note: 'Generated from Operator Fee page.',
    overtimeAmount: 0,
    paymentMethod: person?.defaultPaymentMethod || 'cash',
    personId: cleanText(person?.id || line.personId),
    personName: cleanText(person?.name || line.personName, 'Crew Studio'),
    status: OPERATOR_FEE_ENTRY_STATUSES.DRAFT,
    totalAmount: line.amount,
  };
}

export default function OperatorFeePage({ currentUser }) {
  const settings = useOperatorFeeSettings();
  const [bookings, setBookings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignments, setAssignments] = useState({});
  const [message, setMessage] = useState('');
  const [busyBookingId, setBusyBookingId] = useState('');

  useEffect(() => {
    if (!isOwnerAdminUser(currentUser)) return undefined;

    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (nextBookings) => {
        setBookings(Array.isArray(nextBookings) ? nextBookings : []);
      },
      (error) => {
        console.error('[operator-fee] Gagal membaca booking:', error);
        setMessage('Gagal membaca booking untuk Operator Fee.');
      }
    );

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!isOwnerAdminUser(currentUser)) return undefined;

    const unsubscribe = subscribeOperatorFeeEntries(
      (nextEntries) => {
        setEntries(Array.isArray(nextEntries) ? nextEntries : []);
      },
      (error) => {
        console.error('[operator-fee] Gagal membaca operator fee entries:', error);
        setMessage('Gagal membaca ' + OPERATOR_FEE_ENTRIES_COLLECTION + '.');
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const guardOptions = useMemo(() => getPeopleOptions(settings, OPERATOR_FEE_PERSON_ROLES.GUARD), [settings]);
  const operatorOptions = useMemo(() => getPeopleOptions(settings, OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR), [settings]);

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
      const guardId = assignment.guardId || getDefaultPersonId(settings, OPERATOR_FEE_PERSON_ROLES.GUARD);
      const operatorId = assignment.operatorId || getDefaultPersonId(settings, OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR);
      const guardPerson = getPersonById(settings, guardId);
      const operatorPerson = getPersonById(settings, operatorId);
      const lines = createEstimatedOperatorFeeLines({
        assignedPeopleByRole: {
          [OPERATOR_FEE_PERSON_ROLES.GUARD]: guardPerson,
          [OPERATOR_FEE_PERSON_ROLES.RECORDING_OPERATOR]: operatorPerson,
        },
        booking,
        settings,
      });
      const totalFee = lines.reduce((total, line) => total + toNumber(line.amount), 0);
      const status = getBookingFeeStatus(entries, booking);

      return {
        booking,
        bookingId,
        guardId,
        guardPerson,
        lines,
        operatorId,
        operatorPerson,
        status,
        totalFee,
      };
    });
  }, [activeBookings, assignments, entries, settings]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => statusFilter === 'all' || row.status === statusFilter);
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
    return rows.reduce((result, row) => ({
      draft: result.draft + (row.status === 'draft' ? row.totalFee : 0),
      estimate: result.estimate + (row.status === 'estimate' ? row.totalFee : 0),
      posted: result.posted + (row.status === 'posted' ? row.totalFee : 0),
      reviewed: result.reviewed + (row.status === 'reviewed' ? row.totalFee : 0),
      total: result.total + row.totalFee,
      needsReview: result.needsReview + (row.status === 'estimate' || row.status === 'draft' ? 1 : 0),
    }), {
      draft: 0,
      estimate: 0,
      posted: 0,
      reviewed: 0,
      total: 0,
      needsReview: 0,
    });
  }, [rows]);

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

  async function saveDraft(row) {
    if (!row.lines.length) {
      setMessage('Belum ada rule fee yang cocok untuk booking ini.');
      return;
    }

    setBusyBookingId(row.bookingId);

    try {
      const existingEntries = getEntriesByBooking(entries, row.booking);
      const isPosted = existingEntries.some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

      if (isPosted) {
        setMessage('Booking ini sudah posted ke pembukuan. Draft tidak diubah.');
        return;
      }

      const entryPayloads = row.lines.map((line) => {
        const person = line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD
          ? row.guardPerson
          : row.operatorPerson;

        return buildEntryFromLine(line, row.booking, person);
      });

      await Promise.all(entryPayloads.map(upsertOperatorFeeEntry));
      setMessage('Draft fee ' + getBookingCode(row.booking) + ' berhasil disimpan.');
    } catch (error) {
      console.error('[operator-fee] Gagal menyimpan draft fee:', error);
      setMessage('Draft fee gagal disimpan.');
    } finally {
      setBusyBookingId('');
    }
  }

  async function markReviewed(row) {
    const relatedEntries = getEntriesByBooking(entries, row.booking)
      .filter((entry) => entry.status !== OPERATOR_FEE_ENTRY_STATUSES.POSTED);

    if (!relatedEntries.length) {
      setMessage('Simpan draft fee terlebih dahulu sebelum review.');
      return;
    }

    setBusyBookingId(row.bookingId);

    try {
      await Promise.all(relatedEntries.map(markOperatorFeeEntryReviewed));
      setMessage('Fee ' + getBookingCode(row.booking) + ' ditandai reviewed.');
    } catch (error) {
      console.error('[operator-fee] Gagal mark reviewed:', error);
      setMessage('Gagal menandai fee sebagai reviewed.');
    } finally {
      setBusyBookingId('');
    }
  }

  if (!isOwnerAdminUser(currentUser)) {
    return (
      <section className="operator-fee-page operator-fee-locked">
        <ShieldAlert size={34} />
        <h2>Owner Only</h2>
        <p>Halaman Operator Fee hanya bisa diakses oleh owner aktif.</p>
      </section>
    );
  }

  return (
    <section className="operator-fee-page" aria-labelledby="operator-fee-title">
      <section className="operator-fee-hero">
        <span aria-hidden="true">
          <HandCoins size={24} />
        </span>
        <div>
          <p>Owner Workspace</p>
          <h2 id="operator-fee-title">Operator Fee</h2>
          <small>
            Estimasi fee internal berdasarkan jadwal, rule Fee Settings, dan assignment crew/operator.
          </small>
        </div>
      </section>

      <section className="operator-fee-summary" aria-label="Ringkasan operator fee">
        <article>
          <small>Estimasi Total</small>
          <strong>{formatOperatorFeeCurrency(summary.total)}</strong>
          <span>{rows.length} booking aktif</span>
        </article>
        <article>
          <small>Belum Review</small>
          <strong>{summary.needsReview}</strong>
          <span>estimate / draft</span>
        </article>
        <article>
          <small>Reviewed</small>
          <strong>{formatOperatorFeeCurrency(summary.reviewed)}</strong>
          <span>siap posting nanti</span>
        </article>
        <article>
          <small>Posted</small>
          <strong>{formatOperatorFeeCurrency(summary.posted)}</strong>
          <span>sudah masuk pembukuan</span>
        </article>
      </section>

      <section className="operator-fee-toolbar">
        <StudioSelect
          label="Periode"
          options={periodOptions}
          selectedKey={period}
          onChange={setPeriod}
        />

        <StudioSelect
          label="Status"
          options={statusOptions}
          selectedKey={statusFilter}
          onChange={setStatusFilter}
        />
      </section>

      {message ? (
        <p className="operator-fee-page-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="operator-fee-list" aria-label="Daftar jadwal operator fee">
        {filteredRows.length ? (
          filteredRows.map((row) => {
            const booking = row.booking;
            const isBusy = busyBookingId === row.bookingId;
            const statusTone = getStatusTone(row.status);

            return (
              <article className="operator-fee-booking-card" key={row.bookingId}>
                <header>
                  <div>
                    <small>{getBookingCode(booking)}</small>
                    <strong>{booking.customer || 'Customer'}</strong>
                    <span>{getBookingServiceLabel(booking)}</span>
                  </div>

                  <em className={'operator-fee-status is-' + statusTone}>
                    {getStatusLabel(row.status)}
                  </em>
                </header>

                <div className="operator-fee-booking-meta">
                  <span>
                    <CalendarDays size={14} />
                    {formatBookingDate(booking.date)}
                  </span>
                  <span>
                    <WalletCards size={14} />
                    {getBookingDurationLabel(booking)}
                  </span>
                  <span>
                    <HandCoins size={14} />
                    {formatOperatorFeeCurrency(row.totalFee)}
                  </span>
                </div>

                <div className="operator-fee-assignment-grid">
                  <StudioSelect
                    label="Penjaga Studio"
                    options={guardOptions}
                    selectedKey={row.guardId}
                    onChange={(value) => updateAssignment(row.bookingId, 'guardId', value)}
                  />

                  <StudioSelect
                    label="Operator Recording"
                    options={operatorOptions}
                    selectedKey={row.operatorId}
                    onChange={(value) => updateAssignment(row.bookingId, 'operatorId', value)}
                  />
                </div>

                <div className="operator-fee-line-list">
                  {row.lines.length ? row.lines.map((line) => (
                    <span key={line.id}>
                      <small>{line.ruleName}</small>
                      <strong>{formatOperatorFeeCurrency(line.amount)}</strong>
                    </span>
                  )) : (
                    <p>Belum ada rule yang cocok. Tambahkan rule di Settings → Fee Settings.</p>
                  )}
                </div>

                <footer>
                  <button
                    className="operator-fee-action"
                    disabled={isBusy || row.status === 'posted'}
                    type="button"
                    onClick={() => saveDraft(row)}
                  >
                    {isBusy ? <LoaderCircle className="auth-spin" size={14} /> : <Save size={14} />}
                    Simpan Draft
                  </button>

                  <button
                    className="operator-fee-action"
                    disabled={isBusy || row.status === 'estimate' || row.status === 'posted'}
                    type="button"
                    onClick={() => markReviewed(row)}
                  >
                    <ClipboardCheck size={14} />
                    Mark Reviewed
                  </button>

                  <button
                    className="operator-fee-action is-disabled"
                    disabled
                    type="button"
                    title="Posting ke pembukuan akan dibuat di OPF-5."
                  >
                    <CheckCircle2 size={14} />
                    Post OPF-5
                  </button>
                </footer>
              </article>
            );
          })
        ) : (
          <section className="operator-fee-empty">
            <UserRound size={30} />
            <h3>Tidak ada jadwal fee</h3>
            <p>Belum ada booking aktif yang cocok dengan filter saat ini.</p>
          </section>
        )}
      </section>
    </section>
  );
}
