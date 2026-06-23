import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Clock3, LoaderCircle, X, XCircle } from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  approveGuardAttendanceSession,
  rejectGuardAttendanceSession,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
import { isOwnerAdminUser } from '../../utils/adminPermissions.js';

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

export default function GuardAttendanceApprovalModal({ currentUser, onOpenPanel }) {
  const location = useLocation();
  const [pendingSessions, setPendingSessions] = useState([]);
  const [dismissedId, setDismissedId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOwnerAdminUser(currentUser)) return () => {};

    return subscribeGuardAttendanceSessions(
      {
        approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
      },
      (sessions) => {
        setPendingSessions(sessions);
      },
      (error) => {
        console.error('[guard-attendance-modal] Gagal membaca approval pending:', error);
      }
    );
  }, [currentUser]);

  const activeSession = useMemo(() => {
    if (location.pathname === '/admin/guard-attendance') return null;

    return pendingSessions.find((session) => session.id !== dismissedId) || null;
  }, [dismissedId, location.pathname, pendingSessions]);

  async function approveSession() {
    if (!activeSession) return;

    setBusyId(activeSession.id);
    setMessage('');

    try {
      await approveGuardAttendanceSession(activeSession, currentUser);
      setMessage('Absen ' + activeSession.guardName + ' disetujui.');
    } catch (error) {
      console.error('[guard-attendance-modal] Approve gagal:', error);
      setMessage('Approve absen gagal.');
    } finally {
      setBusyId('');
    }
  }

  async function rejectSession() {
    if (!activeSession) return;

    const reason = window.prompt('Alasan reject absen?', 'Data absen belum sesuai.');
    if (reason === null) return;

    setBusyId(activeSession.id);
    setMessage('');

    try {
      await rejectGuardAttendanceSession(activeSession, currentUser, reason);
      setMessage('Absen ' + activeSession.guardName + ' ditolak.');
    } catch (error) {
      console.error('[guard-attendance-modal] Reject gagal:', error);
      setMessage('Reject absen gagal.');
    } finally {
      setBusyId('');
    }
  }

  if (!activeSession) return null;

  const isBusy = busyId === activeSession.id;

  return (
    <section className="guard-attendance-approval-backdrop" role="presentation">
      <article className="guard-attendance-approval-modal" role="dialog" aria-modal="true" aria-labelledby="guard-attendance-approval-title">
        <button
          aria-label="Tutup modal approval absen"
          className="guard-attendance-approval-close"
          type="button"
          onClick={() => setDismissedId(activeSession.id)}
        >
          <X size={16} />
        </button>

        <span className="guard-attendance-approval-icon" aria-hidden="true">
          <Clock3 size={22} />
        </span>

        <div className="guard-attendance-approval-copy">
          <p>Approval Absen</p>
          <h2 id="guard-attendance-approval-title">{activeSession.guardName}</h2>
          <span>
            Mengajukan absen pada {formatDate(activeSession.date)} pukul {formatDateTime(activeSession.clockInAt)}.
          </span>
        </div>

        <div className="guard-attendance-approval-facts">
          <span>
            <small>Status</small>
            <strong>Menunggu Owner</strong>
          </span>
          <span>
            <small>Jumlah pending</small>
            <strong>{pendingSessions.length} absen</strong>
          </span>
        </div>

        {message ? (
          <p className="guard-attendance-approval-note">{message}</p>
        ) : null}

        <div className="guard-attendance-approval-actions">
          <button type="button" onClick={rejectSession} disabled={isBusy}>
            <XCircle size={15} />
            Reject
          </button>
          <button className="is-primary" type="button" onClick={approveSession} disabled={isBusy}>
            {isBusy ? <LoaderCircle className="auth-spin" size={15} /> : <CheckCircle2 size={15} />}
            Approve
          </button>
        </div>

        <button className="guard-attendance-approval-link" type="button" onClick={onOpenPanel}>
          Buka panel approval lengkap
        </button>
      </article>
    </section>
  );
}
