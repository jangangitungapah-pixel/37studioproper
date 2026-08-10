import { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  History,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  UserCheck,
  Utensils,
  X,
  XCircle,
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  GUARD_MEAL_BOOKKEEPING_STATUSES,
  approveGuardAttendanceSession,
  rejectGuardAttendanceSession,
  subscribeGuardAttendanceSessions,
  voidGuardAttendanceSession,
} from '../../services/guardAttendanceRepository.js';
import { formatOperatorFeeCurrency } from '../../settings/operatorFeeSettings.js';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { hasAdminPagePermission } from '../../utils/adminPermissions.js';
import {
  ADMIN_LIST_PAGE_SIZE,
  getPaginationSlice,
} from '../../utils/pagination.js';

const reviewFilterOptions = [
  { key: 'all', label: 'Semua Status' },
  { key: 'pending', label: 'Perlu Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'void', label: 'Void' },
];

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(String(value).includes('T') ? value : value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = getDateValue(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(hours) {
  const value = Number(hours) || 0;
  if (!value) return 'Shift belum selesai';

  return value.toFixed(value % 1 === 0 ? 0 : 1) + ' jam';
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function getAttendanceStatusMeta(status) {
  if (status === GUARD_ATTENDANCE_STATUSES.ACTIVE) {
    return { label: 'Shift Aktif', tone: 'info' };
  }

  if (status === GUARD_ATTENDANCE_STATUSES.CLOSED) {
    return { label: 'Shift Selesai', tone: 'success' };
  }

  if (status === GUARD_ATTENDANCE_STATUSES.REJECTED) {
    return { label: 'Rejected', tone: 'danger' };
  }

  if (status === GUARD_ATTENDANCE_STATUSES.VOID) {
    return { label: 'Void', tone: 'neutral' };
  }

  return { label: 'Menunggu Review', tone: 'warning' };
}

function getReviewStatusMeta(session) {
  if (session.status === GUARD_ATTENDANCE_STATUSES.VOID) {
    return { label: 'Void', tone: 'neutral' };
  }

  if (
    session.approvalStatus ===
    GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
  ) {
    return { label: 'Approved', tone: 'success' };
  }

  if (
    session.approvalStatus ===
    GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED
  ) {
    return { label: 'Rejected', tone: 'danger' };
  }

  return { label: 'Perlu Review', tone: 'warning' };
}

function matchesReviewFilter(session, reviewFilter) {
  const isVoid = session.status === GUARD_ATTENDANCE_STATUSES.VOID;

  if (reviewFilter === 'all') return true;
  if (reviewFilter === 'void') return isVoid;
  if (isVoid) return false;

  return session.approvalStatus === reviewFilter;
}

function getGuardReviewSummary(sessions) {
  const today = getTodayIsoDate();

  return sessions.reduce(
    (summary, session) => {
      const isVoid = session.status === GUARD_ATTENDANCE_STATUSES.VOID;
      const isApproved =
        !isVoid &&
        session.approvalStatus ===
          GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED;
      const isPending =
        !isVoid &&
        session.approvalStatus ===
          GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING;
      const isClosed =
        isApproved &&
        session.status === GUARD_ATTENDANCE_STATUSES.CLOSED;
      const isMealPosted =
        session.mealBookkeepingStatus ===
        GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED;
      const isMealReady =
        isClosed &&
        session.mealEligible === true &&
        !isMealPosted &&
        Number(session.mealAmount || 0) > 0;

      if (isPending) summary.pending += 1;
      if (isApproved) summary.approved += 1;
      if (isApproved && session.date === today) summary.approvedToday += 1;
      if (isMealReady) summary.mealReady += 1;

      if (isMealPosted) {
        summary.mealPosted += 1;
        summary.mealPostedAmount += Number(session.mealAmount || 0);
      }

      if (isVoid) summary.voided += 1;

      return summary;
    },
    {
      approved: 0,
      approvedToday: 0,
      mealPosted: 0,
      mealPostedAmount: 0,
      mealReady: 0,
      pending: 0,
      voided: 0,
    },
  );
}

function GuardReviewStatus({ meta }) {
  return (
    <span className={'guard-review-status is-' + meta.tone}>
      <i aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function GuardReviewHeader({ summary }) {
  return (
    <header className="guard-review-editorial-header">
      <div className="guard-review-heading">
        <span className="guard-review-kicker">Crew operations</span>
        <h2 id="guard-attendance-review-title">Attendance Review</h2>
        <p>
          Review shift penjaga, jejak approval, dan status rekonsiliasi uang
          makan tanpa memutus lifecycle attendance.
        </p>
      </div>

      <div
        className={'guard-review-context ' + (summary.pending ? 'is-attention' : 'is-clear')}
        aria-label="Konteks review attendance"
      >
        <span className="guard-review-context-icon" aria-hidden="true">
          {summary.pending ? <Clock3 size={16} /> : <ShieldCheck size={16} />}
        </span>
        <span>
          <small>Approval queue</small>
          <strong>{summary.pending} perlu review</strong>
          <em>
            {summary.pending
              ? 'selesaikan berdasarkan urutan masuk'
              : 'semua attendance sudah ditinjau'}
          </em>
        </span>
      </div>
    </header>
  );
}

function GuardReviewPulse({ summary }) {
  const metrics = [
    {
      detail: 'menunggu keputusan',
      icon: Clock3,
      label: 'Perlu Review',
      tone: 'is-warning',
      value: summary.pending,
    },
    {
      detail: summary.approvedToday + ' approved hari ini',
      icon: UserCheck,
      label: 'Approved',
      tone: 'is-success',
      value: summary.approved,
    },
    {
      detail: 'shift selesai + eligible',
      icon: Utensils,
      label: 'Siap Rekonsiliasi',
      tone: 'is-info',
      value: summary.mealReady,
    },
    {
      detail: formatOperatorFeeCurrency(summary.mealPostedAmount),
      icon: FileCheck2,
      label: 'Meal Posted',
      tone: '',
      value: summary.mealPosted,
    },
  ];

  return (
    <section className="guard-review-pulse" aria-label="Ringkasan attendance">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className={'guard-review-pulse-metric ' + metric.tone} key={metric.label}>
            <span className="guard-review-pulse-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <em>{metric.detail}</em>
            </span>
          </article>
        );
      })}
    </section>
  );
}

function GuardReviewState({ type }) {
  if (type === 'loading') {
    return (
      <div className="guard-review-state" role="status">
        <LoaderCircle className="auth-spin" size={20} aria-hidden="true" />
        <strong>Menyinkronkan attendance...</strong>
        <span>Riwayat shift dan status approval sedang dibaca.</span>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="guard-review-state is-error" role="alert">
        <AlertTriangle size={20} aria-hidden="true" />
        <strong>Attendance belum berhasil dimuat</strong>
        <span>Cek koneksi atau permission Absen Penjaga.</span>
      </div>
    );
  }

  return (
    <div className="guard-review-state">
      <History size={20} aria-hidden="true" />
      <strong>Tidak ada attendance di filter ini</strong>
      <span>Ubah status, tanggal, atau pencarian untuk melihat data lain.</span>
    </div>
  );
}

function GuardReviewPriority({
  busyId,
  isLoading,
  loadError,
  onApprove,
  onReject,
  onShowAll,
  pendingSessions,
}) {
  return (
    <section className="guard-review-priority" aria-labelledby="guard-review-priority-title">
      <header>
        <div>
          <span className="guard-review-panel-icon" aria-hidden="true">
            <UserCheck size={16} />
          </span>
          <span>
            <small>Approval queue</small>
            <h3 id="guard-review-priority-title">Attendance yang perlu keputusan</h3>
            <p>Pending diurutkan dari pengajuan terbaru.</p>
          </span>
        </div>

        <button
          className="guard-review-priority-link"
          disabled={!pendingSessions.length}
          type="button"
          onClick={onShowAll}
        >
          Lihat semua
          <span>{pendingSessions.length}</span>
        </button>
      </header>

      {isLoading && !pendingSessions.length ? (
        <div className="guard-review-priority-clear" role="status">
          <LoaderCircle className="auth-spin" size={18} aria-hidden="true" />
          <span>Membaca approval queue...</span>
        </div>
      ) : null}

      {!isLoading && loadError && !pendingSessions.length ? (
        <div className="guard-review-priority-clear is-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>Approval queue belum tersinkron.</span>
        </div>
      ) : null}

      {!isLoading && !loadError && !pendingSessions.length ? (
        <div className="guard-review-priority-clear">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Tidak ada attendance yang menunggu keputusan.</span>
        </div>
      ) : null}

      {pendingSessions.length ? (
        <div className="guard-review-priority-list">
          {pendingSessions.slice(0, 3).map((session) => {
            const isBusy = busyId === session.id;

            return (
              <article className="guard-review-priority-row" key={'priority-' + session.id}>
                <span className="guard-review-priority-date" aria-hidden="true">
                  <strong>{String(getDateValue(session.date)?.getDate() || '--').padStart(2, '0')}</strong>
                  <small>{formatDate(session.date).split(' ')[1] || '---'}</small>
                </span>

                <span className="guard-review-priority-copy">
                  <strong>{session.guardName}</strong>
                  <small>
                    {formatTime(session.clockInAt)}–{session.clockOutAt ? formatTime(session.clockOutAt) : 'aktif'}
                    {' · '}
                    {formatDuration(session.durationHours)}
                  </small>
                </span>

                <span className="guard-review-priority-actions">
                  <button
                    disabled={isBusy}
                    type="button"
                    onClick={() => onReject(session)}
                  >
                    <XCircle size={13} aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    className="is-primary"
                    disabled={isBusy}
                    type="button"
                    onClick={() => onApprove(session)}
                  >
                    {isBusy ? (
                      <LoaderCircle className="auth-spin" size={13} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={13} aria-hidden="true" />
                    )}
                    Approve
                  </button>
                </span>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function GuardReviewToolbar({
  dateFilter,
  isFiltered,
  onDateChange,
  onReset,
  onReviewFilterChange,
  onSearchChange,
  resultCount,
  reviewFilter,
  searchQuery,
  totalItems,
}) {
  return (
    <section className="guard-review-command-shelf" aria-label="Attendance review controls">
      <label className="guard-review-search">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Cari attendance penjaga"
          placeholder="Cari nama penjaga, email, atau tanggal..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <label className="guard-review-date-field">
        <CalendarDays size={15} aria-hidden="true" />
        <span>
          <small>Tanggal</small>
          <input
            aria-label="Filter tanggal attendance"
            type="date"
            value={dateFilter}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </span>
      </label>

      <div className="guard-review-filter-select">
        <StudioSelect
          label="Status Review"
          options={reviewFilterOptions}
          selectedKey={reviewFilter}
          onChange={onReviewFilterChange}
        />
      </div>

      <div className="guard-review-filter-context">
        <SlidersHorizontal size={13} aria-hidden="true" />
        <span>
          <strong>{resultCount}</strong>
          <small>dari {totalItems} attendance</small>
        </span>
        {isFiltered ? (
          <button type="button" onClick={onReset}>
            <RotateCcw size={12} aria-hidden="true" />
            Reset
          </button>
        ) : (
          <em>semua riwayat</em>
        )}
      </div>
    </section>
  );
}

function GuardReviewMealCell({ session }) {
  const isMealPosted =
    session.mealBookkeepingStatus ===
    GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED;

  if (isMealPosted) {
    return (
      <span className="guard-review-meal is-posted">
        <LockKeyhole size={13} aria-hidden="true" />
        <span>
          <small>Uang makan</small>
          <strong>{formatOperatorFeeCurrency(session.mealAmount)}</strong>
          <em>posted + locked</em>
        </span>
      </span>
    );
  }

  if (session.mealEligible) {
    return (
      <span className="guard-review-meal is-ready">
        <Utensils size={13} aria-hidden="true" />
        <span>
          <small>Uang makan</small>
          <strong>{formatOperatorFeeCurrency(session.mealAmount)}</strong>
          <em>
            {session.status === GUARD_ATTENDANCE_STATUSES.CLOSED
              ? 'siap rekonsiliasi'
              : 'menunggu shift selesai'}
          </em>
        </span>
      </span>
    );
  }

  return (
    <span className="guard-review-meal">
      <Utensils size={13} aria-hidden="true" />
      <span>
        <small>Uang makan</small>
        <strong>Belum eligible</strong>
        <em>aktif setelah approval</em>
      </span>
    </span>
  );
}

function GuardReviewActions({
  busyId,
  onApprove,
  onReject,
  onVoid,
  session,
}) {
  const isBusy = busyId === session.id;
  const isVoid = session.status === GUARD_ATTENDANCE_STATUSES.VOID;
  const isPending =
    session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING;
  const isApproved =
    session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED;
  const isRejected =
    session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED;
  const isMealPosted =
    session.mealBookkeepingStatus ===
    GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED;

  if (isVoid) {
    return (
      <span className="guard-review-lock-note">
        <LockKeyhole size={13} aria-hidden="true" />
        Attendance void
      </span>
    );
  }

  if (isMealPosted) {
    return (
      <span className="guard-review-lock-note is-posted">
        <ShieldCheck size={13} aria-hidden="true" />
        Uang makan sudah posted
      </span>
    );
  }

  return (
    <span className="guard-review-row-actions">
      {isPending ? (
        <>
          <button disabled={isBusy} type="button" onClick={() => onReject(session)}>
            <XCircle size={13} aria-hidden="true" />
            Reject
          </button>
          <button
            className="is-primary"
            disabled={isBusy}
            type="button"
            onClick={() => onApprove(session)}
          >
            {isBusy ? (
              <LoaderCircle className="auth-spin" size={13} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={13} aria-hidden="true" />
            )}
            Approve
          </button>
        </>
      ) : null}

      {isApproved && !isMealPosted && !isVoid ? (
        <>
          <button disabled={isBusy} type="button" onClick={() => onReject(session)}>
            <XCircle size={13} aria-hidden="true" />
            Reject
          </button>
          <button
            className="is-danger"
            disabled={isBusy}
            type="button"
            onClick={() => onVoid(session)}
          >
            <Ban size={13} aria-hidden="true" />
            Void
          </button>
        </>
      ) : null}

      {isRejected ? (
        <>
          <button
            className="is-primary"
            disabled={isBusy}
            type="button"
            onClick={() => onApprove(session)}
          >
            {isBusy ? (
              <LoaderCircle className="auth-spin" size={13} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={13} aria-hidden="true" />
            )}
            Re-approve
          </button>
          <button
            className="is-danger"
            disabled={isBusy}
            type="button"
            onClick={() => onVoid(session)}
          >
            <Ban size={13} aria-hidden="true" />
            Void
          </button>
        </>
      ) : null}
    </span>
  );
}

function GuardReviewRow({
  busyId,
  onApprove,
  onReject,
  onVoid,
  session,
}) {
  const attendanceMeta = getAttendanceStatusMeta(session.status);
  const reviewMeta = getReviewStatusMeta(session);

  return (
    <article
      className={'guard-review-row is-' + reviewMeta.tone}
      data-attendance-id={session.id}
    >
      <span className="guard-review-row-mark" aria-hidden="true">
        {session.status === GUARD_ATTENDANCE_STATUSES.VOID ? (
          <Ban size={15} />
        ) : session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED ? (
          <ShieldCheck size={15} />
        ) : (
          <Clock3 size={15} />
        )}
      </span>

      <span className="guard-review-person">
        <small>{formatDate(session.date)} · {session.guardEmail || 'tanpa email'}</small>
        <strong>{session.guardName}</strong>
        <em>
          {formatTime(session.clockInAt)}–{session.clockOutAt ? formatTime(session.clockOutAt) : 'aktif'}
          {' · '}
          {formatDuration(session.durationHours)}
        </em>
      </span>

      <span className="guard-review-shift">
        <Timer size={13} aria-hidden="true" />
        <span>
          <small>Attendance</small>
          <GuardReviewStatus meta={attendanceMeta} />
          <em>{session.note || 'Tidak ada catatan shift'}</em>
        </span>
      </span>

      <GuardReviewMealCell session={session} />

      <span className="guard-review-decision">
        <GuardReviewStatus meta={reviewMeta} />
        {session.rejectionReason ? (
          <small>Reject: {session.rejectionReason}</small>
        ) : null}
        {session.voidReason ? (
          <small>Void: {session.voidReason}</small>
        ) : null}
      </span>

      <GuardReviewActions
        busyId={busyId}
        onApprove={onApprove}
        onReject={onReject}
        onVoid={onVoid}
        session={session}
      />
    </article>
  );
}

function GuardReviewLedger({
  busyId,
  isLoading,
  loadError,
  onApprove,
  onReject,
  onVoid,
  resultCount,
  rows,
}) {
  return (
    <section className="guard-review-ledger" aria-label="Attendance review ledger">
      <header className="guard-review-ledger-header">
        <div>
          <span>Attendance reconciliation ledger</span>
          <strong>{resultCount} attendance ditemukan</strong>
        </div>
        <p>
          <LockKeyhole size={13} aria-hidden="true" />
          Meal posted mengunci reject dan void
        </p>
      </header>

      <div className="guard-review-ledger-columns" aria-hidden="true">
        <span>Guard / shift</span>
        <span>Attendance</span>
        <span>Meal</span>
        <span>Review</span>
        <span>Actions</span>
      </div>

      {isLoading && !rows.length ? <GuardReviewState type="loading" /> : null}
      {!isLoading && loadError && !rows.length ? <GuardReviewState type="error" /> : null}
      {!isLoading && !loadError && !rows.length ? <GuardReviewState type="empty" /> : null}

      {rows.length ? (
        <div className="guard-review-ledger-rows">
          {rows.map((session) => (
            <GuardReviewRow
              busyId={busyId}
              key={session.id}
              onApprove={onApprove}
              onReject={onReject}
              onVoid={onVoid}
              session={session}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GuardReviewActionDialog({
  actionIntent,
  busyId,
  onClose,
  onConfirm,
  reason,
  setReason,
}) {
  const session = actionIntent?.session || null;
  const actionType = actionIntent?.type || '';
  const isBusy = session ? busyId === session.id : false;
  const isReject = actionType === 'reject';
  const title = isReject ? 'Reject attendance' : 'Void attendance';

  return (
    <Dialog.Root
      modal
      open={Boolean(session)}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="guard-review-dialog-backdrop" />
        <Dialog.Content
          className="guard-review-dialog"
          data-guard-attendance-dialog-ui="ui-10-spatial"
          aria-describedby="guard-review-dialog-description"
        >
          <header>
            <span className={'guard-review-dialog-icon ' + (isReject ? 'is-reject' : 'is-void')}>
              {isReject ? <XCircle size={18} /> : <Ban size={18} />}
            </span>
            <span>
              <small>Attendance decision</small>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description id="guard-review-dialog-description">
                {session
                  ? title + ' untuk ' + session.guardName + ' pada ' + formatDate(session.date) + '.'
                  : title}
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <button
                aria-label="Tutup dialog keputusan attendance"
                disabled={isBusy}
                type="button"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <label className="guard-review-reason-field">
            <span>Alasan keputusan</span>
            <textarea
              autoFocus
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <footer>
            <button disabled={isBusy} type="button" onClick={onClose}>
              Batal
            </button>
            <button
              className="is-danger"
              disabled={isBusy}
              type="button"
              onClick={onConfirm}
            >
              {isBusy ? (
                <LoaderCircle className="auth-spin" size={14} aria-hidden="true" />
              ) : isReject ? (
                <XCircle size={14} aria-hidden="true" />
              ) : (
                <Ban size={14} aria-hidden="true" />
              )}
              Konfirmasi {isReject ? 'Reject' : 'Void'}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function GuardAttendancePage({ currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendancePage, setAttendancePage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionIntent, setActionIntent] = useState(null);
  const [reason, setReason] = useState('');

  const canManageGuardAttendance = useMemo(
    () => hasAdminPagePermission(currentUser, 'guard-attendance'),
    [currentUser],
  );

  useEffect(() => {
    if (!canManageGuardAttendance) {
      return undefined;
    }

    const unsubscribe =
      subscribeGuardAttendanceSessions(
        {},
        (items) => {
          setSessions(items);
          setIsLoading(false);
          setLoadError('');
        },
        (error) => {
          console.error('[guard-attendance-owner] Subscription gagal:', error);
          setLoadError('Gagal membaca data attendance penjaga.');
          setIsLoading(false);
        },
      );

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [canManageGuardAttendance]);

  const summary = useMemo(
    () => getGuardReviewSummary(sessions),
    [sessions],
  );

  const pendingSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status !== GUARD_ATTENDANCE_STATUSES.VOID &&
          session.approvalStatus ===
            GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
      ),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sessions.filter((session) => {
      if (!matchesReviewFilter(session, reviewFilter)) return false;
      if (dateFilter && session.date !== dateFilter) return false;
      if (!query) return true;

      return [
        session.guardName,
        session.guardEmail,
        session.date,
        session.note,
        session.rejectionReason,
        session.voidReason,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [dateFilter, reviewFilter, searchQuery, sessions]);

  const paginatedSessions = useMemo(
    () =>
      getPaginationSlice(
        filteredSessions,
        attendancePage,
        ADMIN_LIST_PAGE_SIZE,
      ),
    [attendancePage, filteredSessions],
  );

  const isFiltered = Boolean(
    searchQuery.trim() ||
      dateFilter ||
      reviewFilter !== 'all',
  );

  function showFeedback(message, tone = 'success') {
    setFeedback({ message, tone });
  }

  function handleSearchChange(value) {
    setSearchQuery(value);
    setAttendancePage(1);
  }

  function handleDateChange(value) {
    setDateFilter(value);
    setAttendancePage(1);
  }

  function handleReviewFilterChange(value) {
    setReviewFilter(value);
    setAttendancePage(1);
  }

  function resetFilters() {
    setSearchQuery('');
    setDateFilter('');
    setReviewFilter('all');
    setAttendancePage(1);
  }

  function openReasonDialog(type, session) {
    setActionIntent({ session, type });
    setReason(
      type === 'reject'
        ? 'Data absen belum sesuai.'
        : 'Dibatalkan owner.',
    );
  }

  async function approveSession(session) {
    setBusyId(session.id);
    setFeedback(null);

    try {
      await approveGuardAttendanceSession(session, currentUser);
      showFeedback(
        'Attendance ' + session.guardName + ' disetujui. Eligibility fee mengikuti lifecycle canonical.',
      );
    } catch (error) {
      console.error('[guard-attendance-owner] Approve gagal:', error);
      showFeedback(error?.message || 'Approve attendance gagal.', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function confirmReasonAction() {
    const session = actionIntent?.session;
    const actionType = actionIntent?.type;
    if (!session || !actionType) return;

    setBusyId(session.id);
    setFeedback(null);

    try {
      if (actionType === 'reject') {
        await rejectGuardAttendanceSession(session, currentUser, reason);
        showFeedback('Attendance ' + session.guardName + ' ditolak.');
      } else {
        await voidGuardAttendanceSession(session, currentUser, reason);
        showFeedback('Attendance ' + session.guardName + ' di-void.');
      }

      setActionIntent(null);
      setReason('');
    } catch (error) {
      console.error('[guard-attendance-owner] Keputusan gagal:', error);
      showFeedback(error?.message || 'Keputusan attendance gagal.', 'error');
    } finally {
      setBusyId('');
    }
  }

  if (!canManageGuardAttendance) {
    return (
      <section
        className="guard-review-locked"
        data-guard-attendance-ui="ui-10-spatial"
      >
        <span aria-hidden="true"><ShieldAlert size={22} /></span>
        <div>
          <small>Permission required</small>
          <h2>Akses Attendance Review belum aktif</h2>
          <p>Owner perlu memberi permission Absen Penjaga untuk akun ini.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="guard-attendance-review-title"
      aria-busy={isLoading ? 'true' : 'false'}
      className="guard-attendance-review"
      data-guard-attendance-ui="ui-10-spatial"
    >
      <GuardReviewHeader summary={summary} />
      <GuardReviewPulse summary={summary} />

      <GuardReviewPriority
        busyId={busyId}
        isLoading={isLoading}
        loadError={loadError}
        onApprove={approveSession}
        onReject={(session) => openReasonDialog('reject', session)}
        onShowAll={() => handleReviewFilterChange('pending')}
        pendingSessions={pendingSessions}
      />

      <GuardReviewToolbar
        dateFilter={dateFilter}
        isFiltered={isFiltered}
        onDateChange={handleDateChange}
        onReset={resetFilters}
        onReviewFilterChange={handleReviewFilterChange}
        onSearchChange={handleSearchChange}
        resultCount={filteredSessions.length}
        reviewFilter={reviewFilter}
        searchQuery={searchQuery}
        totalItems={sessions.length}
      />

      {feedback ? (
        <p
          className={'guard-review-feedback is-' + feedback.tone}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.tone === 'error' ? (
            <AlertTriangle size={14} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}
          {feedback.message}
        </p>
      ) : null}

      <GuardReviewLedger
        busyId={busyId}
        isLoading={isLoading}
        loadError={loadError}
        onApprove={approveSession}
        onReject={(session) => openReasonDialog('reject', session)}
        onVoid={(session) => openReasonDialog('void', session)}
        resultCount={filteredSessions.length}
        rows={paginatedSessions}
      />

      <PaginationControls
        label="attendance"
        page={attendancePage}
        pageSize={ADMIN_LIST_PAGE_SIZE}
        totalItems={filteredSessions.length}
        onPageChange={setAttendancePage}
      />

      <GuardReviewActionDialog
        actionIntent={actionIntent}
        busyId={busyId}
        onClose={() => {
          if (!busyId) {
            setActionIntent(null);
            setReason('');
          }
        }}
        onConfirm={confirmReasonAction}
        reason={reason}
        setReason={setReason}
      />
    </section>
  );
}
