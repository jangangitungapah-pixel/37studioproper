import { useEffect, useMemo, useState } from 'react';
import '../../styles/modules/guard-attendance.css';
import { useLocation } from 'react-router-dom';
import { Dialog } from 'radix-ui';
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  approveGuardAttendanceSession,
  rejectGuardAttendanceSession,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
import { hasAdminPagePermission } from '../../utils/adminPermissions.js';

const ADMIN_GUARD_ATTENDANCE_PATHS = [
  '/admin/guard-attendance',
  '/admin/operations/guard-attendance',
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

export default function GuardAttendanceApprovalModal({ currentUser, onOpenPanel }) {
  const location = useLocation();
  const [pendingSessions, setPendingSessions] = useState([]);
  const [dismissedId, setDismissedId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('Data absen belum sesuai.');
  const canManageGuardAttendance = hasAdminPagePermission(currentUser, 'guard-attendance');

  useEffect(() => {
    if (!canManageGuardAttendance) return () => {};

    return subscribeGuardAttendanceSessions(
      {
        approvalStatus: GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING,
      },
      (sessions) => {
        setPendingSessions(sessions);
      },
      (error) => {
        console.error('[guard-attendance-modal] Gagal membaca approval pending:', error);
      },
    );
  }, [canManageGuardAttendance]);

  const activeSession = useMemo(() => {
    if (ADMIN_GUARD_ATTENDANCE_PATHS.includes(location.pathname)) return null;

    return pendingSessions.find((session) => session.id !== dismissedId) || null;
  }, [dismissedId, location.pathname, pendingSessions]);

  function dismissActiveSession() {
    if (!activeSession || busyId) return;
    setRejectingId('');
    setFeedback(null);
    setDismissedId(activeSession.id);
  }

  async function approveSession() {
    if (!activeSession) return;

    setBusyId(activeSession.id);
    setFeedback(null);

    try {
      await approveGuardAttendanceSession(activeSession, currentUser);
      setFeedback({
        message: 'Absen ' + activeSession.guardName + ' disetujui.',
        sessionId: activeSession.id,
      });
    } catch (error) {
      console.error('[guard-attendance-modal] Approve gagal:', error);
      setFeedback({
        message: error?.message || 'Approve absen gagal.',
        sessionId: activeSession.id,
      });
    } finally {
      setBusyId('');
    }
  }

  async function rejectSession() {
    if (!activeSession) return;

    const isRejecting = rejectingId === activeSession.id;

    if (!isRejecting) {
      setRejectingId(activeSession.id);
      setRejectReason('Data absen belum sesuai.');
      setFeedback(null);
      return;
    }

    setBusyId(activeSession.id);
    setFeedback(null);

    try {
      await rejectGuardAttendanceSession(activeSession, currentUser, rejectReason);
      setFeedback({
        message: 'Absen ' + activeSession.guardName + ' ditolak.',
        sessionId: activeSession.id,
      });
      setRejectingId('');
    } catch (error) {
      console.error('[guard-attendance-modal] Reject gagal:', error);
      setFeedback({
        message: error?.message || 'Reject absen gagal.',
        sessionId: activeSession.id,
      });
    } finally {
      setBusyId('');
    }
  }

  const isBusy = activeSession ? busyId === activeSession.id : false;
  const isRejecting = activeSession ? rejectingId === activeSession.id : false;
  const message = activeSession && feedback?.sessionId === activeSession.id
    ? feedback.message
    : '';

  return (
    <Dialog.Root
      modal
      open={Boolean(activeSession)}
      onOpenChange={(isOpen) => {
        if (!isOpen) dismissActiveSession();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="guard-review-attention-backdrop" />
        {activeSession ? (
          <Dialog.Content
            className="guard-review-attention-modal"
            data-guard-attendance-modal-ui="ui-10-spatial"
            aria-describedby="guard-review-attention-description"
          >
            <header>
              <span className="guard-review-attention-icon" aria-hidden="true">
                <Clock3 size={19} />
              </span>
              <span>
                <small>Approval attendance</small>
                <Dialog.Title>{activeSession.guardName}</Dialog.Title>
                <Dialog.Description id="guard-review-attention-description">
                  Mengajukan shift {formatDate(activeSession.date)} pukul{' '}
                  {formatDateTime(activeSession.clockInAt)}.
                </Dialog.Description>
              </span>
              <Dialog.Close asChild>
                <button
                  aria-label="Tutup modal approval absen"
                  disabled={isBusy}
                  type="button"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </header>

            <div className="guard-review-attention-facts">
              <span>
                <UserCheck size={14} aria-hidden="true" />
                <small>Status</small>
                <strong>Menunggu keputusan</strong>
              </span>
              <span>
                <ShieldCheck size={14} aria-hidden="true" />
                <small>Approval queue</small>
                <strong>{pendingSessions.length} attendance</strong>
              </span>
            </div>

            {isRejecting ? (
              <label className="guard-review-attention-reason">
                <span>Alasan reject</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </label>
            ) : null}

            {message ? (
              <p className="guard-review-attention-note" role="status">
                {message}
              </p>
            ) : null}

            <div className="guard-review-attention-actions">
              {isRejecting ? (
                <button
                  disabled={isBusy}
                  type="button"
                  onClick={() => setRejectingId('')}
                >
                  Batal
                </button>
              ) : null}
              <button
                className="is-danger"
                disabled={isBusy}
                type="button"
                onClick={rejectSession}
              >
                {isBusy && isRejecting ? (
                  <LoaderCircle className="auth-spin" size={14} aria-hidden="true" />
                ) : (
                  <XCircle size={14} aria-hidden="true" />
                )}
                {isRejecting ? 'Konfirmasi reject' : 'Reject'}
              </button>
              {!isRejecting ? (
                <button
                  className="is-primary"
                  disabled={isBusy}
                  type="button"
                  onClick={approveSession}
                >
                  {isBusy ? (
                    <LoaderCircle className="auth-spin" size={14} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  )}
                  Approve
                </button>
              ) : null}
            </div>

            <button
              className="guard-review-attention-link"
              disabled={isBusy}
              type="button"
              onClick={onOpenPanel}
            >
              Buka Attendance Review lengkap
            </button>
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
