import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  LoaderCircle,
  ShieldAlert,
  UserRound,
  WalletCards,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { createBookkeepingEntry } from '../../services/bookkeepingRepository.js';
import {
  OPERATOR_FEE_ENTRIES_COLLECTION,
  OPERATOR_FEE_ENTRY_STATUSES,
  createOperatorFeeBookkeepingPayload,
  markOperatorFeeEntryPosted,
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
    { key: 'none', label: 'Belum dipilih', description: 'Pakai label default.' },
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

function buildEntryFromLine(line, booking, person, status = OPERATOR_FEE_ENTRY_STATUSES.DRAFT) {
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
  ].join(' ').toLowerCase();
}

function getRowPrimaryAction(row) {
  if (!row.lines.length) return 'No Rule';
  if (row.status === 'posted') return 'Posted';
  if (row.status === 'reviewed') return 'Post';
  if (row.status === 'draft') return 'Review';

  return 'Review';
}

export default function OperatorFeePage({ currentUser }) {
  const settings = useOperatorFeeSettings();
  const [bookings, setBookings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [assignments, setAssignments] = useState({});
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

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

  const actionRows = useMemo(() => filteredRows.filter((row) => row.lines.length && row.status !== 'posted'), [filteredRows]);
  const reviewableRows = useMemo(() => actionRows.filter((row) => row.status === 'estimate' || row.status === 'draft'), [actionRows]);
  const postableRows = useMemo(() => filteredRows.filter((row) => row.status === 'reviewed'), [filteredRows]);

  const summary = useMemo(() => {
    return rows.reduce((result, row) => ({
      draft: result.draft + (row.status === 'draft' ? row.totalFee : 0),
      estimate: result.estimate + (row.status === 'estimate' ? row.totalFee : 0),
      posted: result.posted + (row.status === 'posted' ? row.totalFee : 0),
      reviewed: result.reviewed + (row.status === 'reviewed' ? row.totalFee : 0),
      total: result.total + row.totalFee,
      needsReview: result.needsReview + (row.status === 'estimate' || row.status === 'draft' ? 1 : 0),
      readyPost: result.readyPost + (row.status === 'reviewed' ? 1 : 0),
    }), {
      draft: 0,
      estimate: 0,
      posted: 0,
      readyPost: 0,
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

  function createEntryPayloads(row, status = OPERATOR_FEE_ENTRY_STATUSES.DRAFT) {
    return row.lines.map((line) => {
      const person = line.payeeRole === OPERATOR_FEE_PERSON_ROLES.GUARD
        ? row.guardPerson
        : row.operatorPerson;

      return buildEntryFromLine(line, row.booking, person, status);
    });
  }

  async function saveDraft(row) {
    if (!row.lines.length) {
      setMessage('Belum ada rule fee yang cocok untuk booking ini.');
      return;
    }

    setBusyKey(row.bookingId);

    try {
      const existingEntries = getEntriesByBooking(entries, row.booking);
      const isPosted = existingEntries.some((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

      if (isPosted) {
        setMessage('Fee ' + getBookingCode(row.booking) + ' sudah posted.');
        return;
      }

      await Promise.all(createEntryPayloads(row, OPERATOR_FEE_ENTRY_STATUSES.DRAFT).map(upsertOperatorFeeEntry));
      setMessage('Draft fee ' + getBookingCode(row.booking) + ' disimpan.');
    } catch (error) {
      console.error('[operator-fee] Gagal menyimpan draft fee:', error);
      setMessage('Draft fee gagal disimpan.');
    } finally {
      setBusyKey('');
    }
  }

  async function markReviewed(row) {
    if (!row.lines.length) {
      setMessage('Belum ada rule fee yang cocok untuk booking ini.');
      return;
    }

    setBusyKey(row.bookingId);

    try {
      const relatedEntries = getEntriesByBooking(entries, row.booking)
        .filter((entry) => entry.status !== OPERATOR_FEE_ENTRY_STATUSES.POSTED);

      if (relatedEntries.length) {
        await Promise.all(relatedEntries.map(markOperatorFeeEntryReviewed));
      } else {
        await Promise.all(createEntryPayloads(row, OPERATOR_FEE_ENTRY_STATUSES.REVIEWED).map(upsertOperatorFeeEntry));
      }

      setMessage('Fee ' + getBookingCode(row.booking) + ' sudah reviewed.');
    } catch (error) {
      console.error('[operator-fee] Gagal mark reviewed:', error);
      setMessage('Gagal menandai fee sebagai reviewed.');
    } finally {
      setBusyKey('');
    }
  }

  async function reviewMany(targetRows) {
    const rowsToReview = targetRows.filter((row) => row.lines.length && row.status !== 'posted' && row.status !== 'reviewed');

    if (!rowsToReview.length) {
      setMessage('Tidak ada fee yang perlu direview di filter ini.');
      return;
    }

    setBusyKey('bulk-review');

    try {
      for (const row of rowsToReview) {
        const relatedEntries = getEntriesByBooking(entries, row.booking)
          .filter((entry) => entry.status !== OPERATOR_FEE_ENTRY_STATUSES.POSTED);

        if (relatedEntries.length) {
          await Promise.all(relatedEntries.map(markOperatorFeeEntryReviewed));
        } else {
          await Promise.all(createEntryPayloads(row, OPERATOR_FEE_ENTRY_STATUSES.REVIEWED).map(upsertOperatorFeeEntry));
        }
      }

      setMessage(rowsToReview.length + ' booking berhasil direview. Cek sekilas, lalu Post Reviewed.');
    } catch (error) {
      console.error('[operator-fee] Gagal bulk review:', error);
      setMessage('Bulk review gagal.');
    } finally {
      setBusyKey('');
    }
  }

  async function postToBookkeeping(row) {
    const relatedEntries = getEntriesByBooking(entries, row.booking);
    const postedEntries = relatedEntries.filter((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.POSTED);

    if (postedEntries.length) {
      setMessage('Fee ' + getBookingCode(row.booking) + ' sudah pernah diposting.');
      return;
    }

    const reviewedEntries = relatedEntries.filter((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED);

    if (!reviewedEntries.length) {
      setMessage('Review fee dulu sebelum posting ke pembukuan.');
      return;
    }

    setBusyKey(row.bookingId);

    try {
      const createdEntries = [];

      for (const entry of reviewedEntries) {
        const bookkeepingPayload = createOperatorFeeBookkeepingPayload(entry, row.booking);
        const bookkeepingEntry = await createBookkeepingEntry(bookkeepingPayload);
        await markOperatorFeeEntryPosted(entry, bookkeepingEntry, currentUser?.uid || '');
        createdEntries.push(bookkeepingEntry);
      }

      setMessage(createdEntries.length + ' fee ' + getBookingCode(row.booking) + ' diposting ke pembukuan.');
    } catch (error) {
      console.error('[operator-fee] Gagal posting fee ke pembukuan:', error);
      setMessage('Posting fee ke pembukuan gagal. Cek koneksi dan Firestore rules.');
    } finally {
      setBusyKey('');
    }
  }

  async function postMany(targetRows) {
    const rowsToPost = targetRows.filter((row) => row.status === 'reviewed');

    if (!rowsToPost.length) {
      setMessage('Tidak ada fee reviewed yang siap diposting.');
      return;
    }

    setBusyKey('bulk-post');

    try {
      let postedCount = 0;

      for (const row of rowsToPost) {
        const reviewedEntries = getEntriesByBooking(entries, row.booking)
          .filter((entry) => entry.status === OPERATOR_FEE_ENTRY_STATUSES.REVIEWED);

        for (const entry of reviewedEntries) {
          const bookkeepingPayload = createOperatorFeeBookkeepingPayload(entry, row.booking);
          const bookkeepingEntry = await createBookkeepingEntry(bookkeepingPayload);
          await markOperatorFeeEntryPosted(entry, bookkeepingEntry, currentUser?.uid || '');
          postedCount += 1;
        }
      }

      setMessage(postedCount + ' fee berhasil diposting ke pembukuan.');
    } catch (error) {
      console.error('[operator-fee] Gagal bulk post:', error);
      setMessage('Bulk post gagal. Cek koneksi dan Firestore rules.');
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
    <section className="operator-fee-queue" aria-labelledby="operator-fee-title">
      <section className="operator-fee-queue-hero">
        <span aria-hidden="true">
          <HandCoins size={22} />
        </span>
        <div>
          <p>Owner Workspace</p>
          <h2 id="operator-fee-title">Operator Fee</h2>
          <small>Review cepat fee crew dari jadwal booking. Bulk dulu, cek detail hanya saat perlu.</small>
        </div>
      </section>

      <section className="operator-fee-queue-summary" aria-label="Ringkasan operator fee">
        <article>
          <small>Perlu Review</small>
          <strong>{summary.needsReview}</strong>
          <span>{formatOperatorFeeCurrency(summary.estimate + summary.draft)}</span>
        </article>
        <article>
          <small>Siap Post</small>
          <strong>{summary.readyPost}</strong>
          <span>{formatOperatorFeeCurrency(summary.reviewed)}</span>
        </article>
        <article>
          <small>Posted</small>
          <strong>{formatOperatorFeeCurrency(summary.posted)}</strong>
          <span>masuk pembukuan</span>
        </article>
      </section>

      <section className="operator-fee-queue-actions" aria-label="Aksi cepat operator fee">
        <button
          disabled={busyKey !== '' || !reviewableRows.length}
          type="button"
          onClick={() => reviewMany(filteredRows)}
        >
          {busyKey === 'bulk-review' ? <LoaderCircle className="auth-spin" size={14} /> : <ClipboardCheck size={14} />}
          Review Semua
          <small>{reviewableRows.length} booking</small>
        </button>

        <button
          disabled={busyKey !== '' || !postableRows.length}
          type="button"
          onClick={() => postMany(filteredRows)}
        >
          {busyKey === 'bulk-post' ? <LoaderCircle className="auth-spin" size={14} /> : <CheckCircle2 size={14} />}
          Post Reviewed
          <small>{postableRows.length} booking</small>
        </button>
      </section>

      <section className="operator-fee-queue-toolbar">
        <input
          aria-label="Cari operator fee"
          placeholder="Cari customer, booking, layanan..."
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

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
        <p className="operator-fee-queue-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="operator-fee-queue-list" aria-label="Daftar operator fee">
        {filteredRows.length ? (
          filteredRows.map((row) => {
            const booking = row.booking;
            const isBusy = busyKey === row.bookingId;
            const statusTone = getStatusTone(row.status);
            const primaryActionLabel = getRowPrimaryAction(row);
            const primaryDisabled = busyKey !== '' || row.status === 'posted' || !row.lines.length;

            return (
              <article className="operator-fee-queue-row" key={row.bookingId}>
                <div className="operator-fee-queue-main">
                  <span>
                    <small>{getBookingCode(booking)} · {formatBookingDate(booking.date)}</small>
                    <strong>{getBookingCustomer(booking)}</strong>
                    <em>{getBookingServiceLabel(booking)}</em>
                  </span>

                  <b>{formatOperatorFeeCurrency(row.totalFee)}</b>

                  <i className={'operator-fee-status is-' + statusTone}>
                    {getStatusLabel(row.status)}
                  </i>

                  <button
                    disabled={primaryDisabled}
                    type="button"
                    onClick={() => handlePrimaryAction(row)}
                  >
                    {isBusy ? <LoaderCircle className="auth-spin" size={13} /> : null}
                    {primaryActionLabel}
                  </button>
                </div>

                <div className="operator-fee-queue-mini">
                  <span>{getBookingDurationLabel(booking)}</span>
                  <span>Jaga: {row.guardPerson?.name || 'Default'}</span>
                  <span>Operator: {row.operatorPerson?.name || 'Default'}</span>
                  <span>{row.lines.length} rule</span>
                </div>

                <details className="operator-fee-queue-detail">
                  <summary>Detail & override crew</summary>

                  <div className="operator-fee-queue-detail-grid">
                    <StudioSelect
                      label="Penjaga"
                      options={guardOptions}
                      selectedKey={row.guardId}
                      onChange={(value) => updateAssignment(row.bookingId, 'guardId', value)}
                    />

                    <StudioSelect
                      label="Operator"
                      options={operatorOptions}
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
                    )) : (
                      <p>Belum ada rule yang cocok. Tambahkan rule di Settings → Fee Settings.</p>
                    )}
                  </div>

                  <div className="operator-fee-queue-detail-actions">
                    <button
                      disabled={busyKey !== '' || row.status === 'posted' || !row.lines.length}
                      type="button"
                      onClick={() => saveDraft(row)}
                    >
                      Simpan Draft
                    </button>
                    <button
                      disabled={busyKey !== '' || row.status === 'posted' || !row.lines.length}
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
        ) : (
          <section className="operator-fee-empty">
            <UserRound size={30} />
            <h3>Tidak ada fee di filter ini</h3>
            <p>Ubah periode, status, atau pencarian.</p>
          </section>
        )}
      </section>
    </section>
  );
}
