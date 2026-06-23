import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldAlert,
  Utensils,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  approveGuardAttendanceSession,
  rejectGuardAttendanceSession,
  subscribeGuardAttendanceSessions,
  voidGuardAttendanceSession,
} from '../../services/guardAttendanceRepository.js';
import { formatOperatorFeeCurrency } from '../../settings/operatorFeeSettings.js';
import { hasAdminPagePermission } from '../../utils/adminPermissions.js';

const approvalFilterOptions = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'Semua' },
];

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(String(value).includes('T') ? value : value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDuration(hours) {
  const value = Number(hours) || 0;

  if (!value) return 'Belum selesai';

  return value + ' jam';
}

function getApprovalLabel(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'Approved';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'Rejected';

  return 'Pending';
}

function getStatusLabel(status) {
  if (status === GUARD_ATTENDANCE_STATUSES.ACTIVE) return 'Aktif';
  if (status === GUARD_ATTENDANCE_STATUSES.CLOSED) return 'Closed';
  if (status === GUARD_ATTENDANCE_STATUSES.REJECTED) return 'Rejected';
  if (status === GUARD_ATTENDANCE_STATUSES.VOID) return 'Void';

  return 'Pending Approval';
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

export default function GuardAttendancePage({ currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const canManageGuardAttendance = hasAdminPagePermission(currentUser, 'guard-attendance');

  useEffect(() => {
    if (!canManageGuardAttendance) return () => {};

    return subscribeGuardAttendanceSessions(
      {},
      (nextSessions) => {
        setSessions(nextSessions);
      },
      (error) => {
        console.error('[guard-attendance-owner] Gagal membaca absen penjaga:', error);
        setMessage('Gagal membaca data absen penjaga.');
      }
    );
  }, [canManageGuardAttendance]);

  const filteredSessions = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return sessions.filter((session) => {
      const approvalMatches = approvalFilter === 'all' || session.approvalStatus === approvalFilter;
      const dateMatches = !dateFilter || session.date === dateFilter;
      const searchMatches = !cleanQuery || [
        session.guardName,
        session.guardEmail,
        session.guardPersonId,
        session.date,
      ].join(' ').toLowerCase().includes(cleanQuery);

      return approvalMatches && dateMatches && searchMatches;
    });
  }, [approvalFilter, dateFilter, searchQuery, sessions]);

  const summary = useMemo(() => {
    return sessions.reduce((result, session) => {
      const isApproved = session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED;
      const isToday = session.date === getTodayIsoDate();

      return {
        approvedToday: result.approvedToday + (isApproved && isToday ? 1 : 0),
        mealTotal: result.mealTotal + (isApproved && session.mealEligible ? Number(session.mealAmount || 0) : 0),
        pending: result.pending + (session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING ? 1 : 0),
        total: result.total + 1,
      };
    }, {
      approvedToday: 0,
      mealTotal: 0,
      pending: 0,
      total: 0,
    });
  }, [sessions]);

  async function approveSession(session) {
    setBusyId(session.id);
    setMessage('');

    try {
      await approveGuardAttendanceSession(session, currentUser);
      setMessage('Absen ' + session.guardName + ' disetujui. Fee penjaga tanggal itu eligible.');
    } catch (error) {
      console.error('[guard-attendance-owner] Approve gagal:', error);
      setMessage('Approve absen gagal.');
    } finally {
      setBusyId('');
    }
  }

  async function rejectSession(session) {
    const reason = window.prompt('Alasan reject absen?', 'Data absen belum sesuai.');
    if (reason === null) return;

    setBusyId(session.id);
    setMessage('');

    try {
      await rejectGuardAttendanceSession(session, currentUser, reason);
      setMessage('Absen ' + session.guardName + ' ditolak.');
    } catch (error) {
      console.error('[guard-attendance-owner] Reject gagal:', error);
      setMessage('Reject absen gagal.');
    } finally {
      setBusyId('');
    }
  }

  async function voidSession(session) {
    const reason = window.prompt('Alasan void absen?', 'Dibatalkan owner.');
    if (reason === null) return;

    setBusyId(session.id);
    setMessage('');

    try {
      await voidGuardAttendanceSession(session, currentUser, reason);
      setMessage('Absen ' + session.guardName + ' di-void.');
    } catch (error) {
      console.error('[guard-attendance-owner] Void gagal:', error);
      setMessage('Void absen gagal.');
    } finally {
      setBusyId('');
    }
  }

  if (!canManageGuardAttendance) {
    return (
      <section className="guard-attendance-owner guard-attendance-owner-locked">
        <ShieldAlert size={34} />
        <h2>Akses Absen Penjaga Belum Aktif</h2>
        <p>Owner perlu memberi permission Absen Penjaga untuk akun ini.</p>
      </section>
    );
  }

  return (
    <section className="guard-attendance-owner" aria-label="Approval absen penjaga">
      <section className="guard-attendance-owner-hero">
        <span aria-hidden="true">
          <UserCheck size={22} />
        </span>
        <div>
          <p>Owner Approval</p>
          <h2>Absen Penjaga</h2>
          <small>
            Approve absen untuk mengaktifkan fee penjaga dan uang makan per tanggal. Jam absen tidak menjadi cut-off booking.
          </small>
        </div>
      </section>

      <section className="guard-attendance-owner-summary" aria-label="Ringkasan absen penjaga">
        <article>
          <small>Pending</small>
          <strong>{summary.pending}</strong>
          <span>butuh approval</span>
        </article>
        <article>
          <small>Approved Hari Ini</small>
          <strong>{summary.approvedToday}</strong>
          <span>penjaga eligible</span>
        </article>
        <article>
          <small>Uang Makan</small>
          <strong>{formatOperatorFeeCurrency(summary.mealTotal)}</strong>
          <span>dari absen approved</span>
        </article>
      </section>

      <section className="guard-attendance-owner-toolbar">
        <input
          aria-label="Cari absen penjaga"
          placeholder="Cari nama, email, tanggal..."
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <input
          aria-label="Filter tanggal absen"
          type="date"
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
        />

        <div className="guard-attendance-owner-filter" role="group" aria-label="Filter approval">
          {approvalFilterOptions.map((option) => (
            <button
              className={approvalFilter === option.key ? 'is-active' : ''}
              key={option.key}
              type="button"
              onClick={() => setApprovalFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <p className="guard-attendance-owner-message" role="status">{message}</p>
      ) : null}

      <section className="guard-attendance-owner-list" aria-label="Daftar absen penjaga">
        {filteredSessions.length ? filteredSessions.map((session) => {
          const isBusy = busyId === session.id;
          const isPending = session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING;
          const isApproved = session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED;

          return (
            <article className="guard-attendance-owner-row" key={session.id}>
              <div className="guard-attendance-owner-main">
                <span>
                  <small>{formatDate(session.date)} · {getStatusLabel(session.status)}</small>
                  <strong>{session.guardName}</strong>
                  <em>{session.guardEmail || session.guardPersonId}</em>
                </span>

                <b>{formatOperatorFeeCurrency(session.mealAmount)}</b>

                <i className={'is-' + session.approvalStatus}>
                  {getApprovalLabel(session.approvalStatus)}
                </i>
              </div>

              <div className="guard-attendance-owner-meta">
                <span>
                  <Clock3 size={13} />
                  Masuk: {formatDateTime(session.clockInAt)}
                </span>
                <span>
                  <Clock3 size={13} />
                  Keluar: {session.clockOutAt ? formatDateTime(session.clockOutAt) : 'Belum selesai'}
                </span>
                <span>
                  <Utensils size={13} />
                  Uang makan: {session.mealEligible ? 'Eligible' : 'Belum eligible'}
                </span>
                <span>
                  <Clock3 size={13} />
                  Durasi: {formatDuration(session.durationHours)}
                </span>
              </div>

              {session.note ? (
                <p className="guard-attendance-owner-note">{session.note}</p>
              ) : null}

              {session.rejectionReason ? (
                <p className="guard-attendance-owner-note is-danger">Reject: {session.rejectionReason}</p>
              ) : null}

              <footer>
                <button
                  disabled={isBusy || !isPending}
                  type="button"
                  onClick={() => rejectSession(session)}
                >
                  <XCircle size={14} />
                  Reject
                </button>
                <button
                  className="is-primary"
                  disabled={isBusy || !isPending}
                  type="button"
                  onClick={() => approveSession(session)}
                >
                  {isBusy ? <LoaderCircle className="auth-spin" size={14} /> : <CheckCircle2 size={14} />}
                  Approve
                </button>
                <button
                  disabled={isBusy || !isApproved}
                  type="button"
                  onClick={() => voidSession(session)}
                >
                  <Ban size={14} />
                  Void
                </button>
              </footer>
            </article>
          );
        }) : (
          <section className="guard-attendance-owner-empty">
            <UserCheck size={30} />
            <h3>Tidak ada absen di filter ini</h3>
            <p>Ubah filter tanggal, status, atau pencarian.</p>
          </section>
        )}
      </section>
    </section>
  );
}
