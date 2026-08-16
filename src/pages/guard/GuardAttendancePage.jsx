import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dialog } from 'radix-ui';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  TimerReset,
  UserRound,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  closeGuardAttendanceSession,
  createGuardAttendanceCheckIn,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
import { adminAuthRepository } from '../../services/adminAuthRepository.js';
import {
  GUARD_PORTAL_ACCESS,
  resolveGuardPortalAccess,
} from '../../utils/accountRoles.js';
import { hasAdminPagePermission } from '../../utils/adminPermissions.js';
import { isFirebaseConfigured } from '../../lib/firebase.js';
import { useOperatorFeeSettings } from '../../settings/operatorFeeSettings.js';
import {
  getGuardIdentityRepairMessage,
  resolveGuardIdentityLink,
} from '../../utils/guardIdentity.js';
import SpatialUiProvider from '../../components/ui/SpatialUiProvider.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import {
  createGuardAiContext,
} from '../../utils/roleAiContext.js';
import { ThemeProvider, useTheme } from '../../theme/ThemeProvider.jsx';
import '../../styles/routes/guard.css';
import '../../styles/spatial-foundation.css';

const EMPTY_GUARD_PEOPLE = [];
const RoleAiAssistant = lazy(() => import('../../components/ai/RoleAiAssistant.jsx'));

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value) || 0);
}

function getApprovalLabel(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'Disetujui';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'Ditolak';

  return 'Menunggu owner';
}

function getApprovalTone(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'success';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'danger';

  return 'warning';
}

function isActiveLikeSession(session) {
  return session &&
    !session.clockOutAt &&
    [GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL, GUARD_ATTENDANCE_STATUSES.ACTIVE].includes(session.status);
}

function GuardPortalHeader({
  adminReturnPath,
  authUser,
  isAdminCrossPortal,
  isBusy,
  isOnline,
  isOwnerOversight,
  onLogout,
  todayLabel,
}) {
  const { isDark, toggleTheme } = useTheme();
  const ConnectivityIcon = isOnline ? Wifi : WifiOff;
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <header className="guard-portal-topbar">
      <div className="guard-portal-brand">
        <span className="guard-portal-brand-mark" aria-hidden="true">37</span>
        <span className="guard-portal-brand-copy">
          <strong>Guard Operations</strong>
          <small>37 Music Studio</small>
        </span>
      </div>

      <div className="guard-portal-topbar-context" aria-label="Konteks portal">
        <span className={`guard-portal-connectivity is-${isOnline ? 'online' : 'offline'}`}>
          <ConnectivityIcon size={14} aria-hidden="true" />
          {isOnline ? 'Online' : 'Offline'}
        </span>
        <span className="guard-portal-date">
          <CalendarDays size={14} aria-hidden="true" />
          {todayLabel}
        </span>
      </div>

      <div className="guard-portal-topbar-actions">
        {(isOwnerOversight || isAdminCrossPortal) && authUser ? (
          <Link className="guard-portal-topbar-link" to={adminReturnPath}>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Admin Portal</span>
          </Link>
        ) : null}

        <button
          aria-label={isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
          aria-pressed={isDark}
          className="guard-portal-icon-button"
          type="button"
          onClick={toggleTheme}
        >
          <ThemeIcon size={17} aria-hidden="true" />
        </button>

        {authUser ? (
          <button
            aria-label="Keluar Akun"
            className="guard-portal-icon-button"
            disabled={isBusy}
            title="Keluar Akun"
            type="button"
            onClick={onLogout}
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function GuardPortalAccessState({
  actions,
  'aria-label': ariaLabel,
  description,
  eyebrow = 'Guard Portal',
  icon: Icon = ShieldCheck,
  title,
  tone = 'neutral',
}) {
  return (
    <section aria-label={ariaLabel} className={`guard-portal-access-state is-${tone}`}>
      <span className="guard-portal-access-icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <div className="guard-portal-access-copy">
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="guard-portal-access-actions">{actions}</div> : null}
    </section>
  );
}

function GuardMetric({ label, value, detail }) {
  return (
    <div className="guard-portal-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function GuardHistoryRow({ session }) {
  const approvalTone = getApprovalTone(session.approvalStatus);
  const isRunning = !session.clockOutAt;
  const duration = Number(session.durationHours) || 0;

  return (
    <article className="guard-portal-history-row">
      <span className={`guard-portal-history-marker is-${approvalTone}`} aria-hidden="true" />

      <div className="guard-portal-history-date">
        <strong>{formatDate(session.date)}</strong>
        <small>{isRunning ? 'Shift berjalan' : `${duration.toFixed(1)} jam`}</small>
      </div>

      <div className="guard-portal-history-time">
        <span>{formatTime(session.clockInAt)}</span>
        <ArrowRight size={13} aria-hidden="true" />
        <span>{isRunning ? 'Sekarang' : formatTime(session.clockOutAt)}</span>
      </div>

      <div className="guard-portal-history-meta">
        {session.mealEligible && session.mealAmount > 0 ? (
          <small>Meal {formatCurrency(session.mealAmount)}</small>
        ) : (
          <small>Belum eligible meal</small>
        )}
        <StatusPill status={approvalTone}>{getApprovalLabel(session.approvalStatus)}</StatusPill>
      </div>
    </article>
  );
}

export default function GuardAttendancePage() {
  return (
    <ThemeProvider>
      <SpatialUiProvider>
        <GuardAttendancePageContent />
      </SpatialUiProvider>
    </ThemeProvider>
  );
}

function GuardAttendancePageContent() {
  const location = useLocation();
  const isAuthAvailable = Boolean(isFirebaseConfigured);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [authUser, setAuthUser] = useState(null);
  const [guardAccount, setGuardAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [note, setNote] = useState('');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);
  const [isReady, setIsReady] = useState(!isAuthAvailable);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(isAuthAvailable ? '' : 'Firebase belum dikonfigurasi.');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isAuthAvailable) return () => {};

    return adminAuthRepository.subscribeAdminAuth((nextAuthState) => {
      const nextUser = nextAuthState?.user || null;
      const nextGuardPortalAccess = resolveGuardPortalAccess(nextUser);
      const nextCanUseGuardPage = Boolean(
        nextUser?.uid &&
        [
          GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
          GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED,
        ].includes(nextGuardPortalAccess)
      );

      setAuthUser(nextUser);
      setGuardAccount(nextUser);
      setIsReady(Boolean(nextAuthState?.isReady));
      setNotice('');

      if (!nextCanUseGuardPage) {
        setSessions([]);
      }

      setError(nextAuthState?.errorMessage || '');
    });
  }, [isAuthAvailable]);

  const accountGuardPortalAccess = useMemo(
    () => resolveGuardPortalAccess(guardAccount),
    [guardAccount]
  );

  const canUseGuardPage = Boolean(
    authUser?.uid &&
    [
      GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
      GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED,
    ].includes(accountGuardPortalAccess)
  );

  const settings = useOperatorFeeSettings({ enabled: canUseGuardPage });
  const guardPeople = settings ? settings.people : EMPTY_GUARD_PEOPLE;

  const guardIdentityLink = useMemo(
    () => resolveGuardIdentityLink(guardPeople, guardAccount?.guardId),
    [guardAccount?.guardId, guardPeople]
  );

  const isGuardIdentityRepairRequired = Boolean(
    canUseGuardPage &&
    !guardIdentityLink.isValid
  );

  const guardPortalAccess = isGuardIdentityRepairRequired
    ? GUARD_PORTAL_ACCESS.IDENTITY_REPAIR_REQUIRED
    : accountGuardPortalAccess;

  const canStartGuardShift = Boolean(
    canUseGuardPage &&
    !isGuardIdentityRepairRequired &&
    guardIdentityLink.isValid
  );

  const isOwnerOversight = Boolean(
    authUser?.uid &&
    guardPortalAccess === GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT
  );

  const isAdminCrossPortal = Boolean(
    authUser?.uid &&
    guardPortalAccess === GUARD_PORTAL_ACCESS.REDIRECT_ADMIN
  );

  const isWrongPortalClient = Boolean(
    authUser?.uid &&
    guardPortalAccess === GUARD_PORTAL_ACCESS.WRONG_PORTAL_CLIENT
  );

  const isBlockedGuardAccess = Boolean(
    authUser?.uid &&
    guardPortalAccess === GUARD_PORTAL_ACCESS.BLOCKED
  );

  const isInvalidGuardAccess = Boolean(
    authUser?.uid &&
    [
      GUARD_PORTAL_ACCESS.INVALID_ACCOUNT,
      GUARD_PORTAL_ACCESS.MISSING_ACCOUNT,
    ].includes(guardPortalAccess)
  );

  const canReviewGuardAttendance = Boolean(
    isAdminCrossPortal &&
    hasAdminPagePermission(
      guardAccount,
      'guard-attendance',
    )
  );

  const adminReturnPath = useMemo(() => {
    const returnTo = location.state?.returnTo;

    if (
      typeof returnTo === 'string' &&
      (
        returnTo === '/admin' ||
        returnTo.startsWith('/admin/') ||
        returnTo.startsWith('/admin?') ||
        returnTo.startsWith('/admin#')
      )
    ) {
      return returnTo;
    }

    return '/admin';
  }, [location.state]);

  useEffect(() => {
    if (!authUser?.uid || !canUseGuardPage) return () => {};

    return subscribeGuardAttendanceSessions(
      { guardUid: authUser.uid },
      (nextSessions) => setSessions(nextSessions),
      (subscribeError) => {
        console.error('[guard-attendance] Gagal membaca riwayat absen:', subscribeError);
        setError('Gagal membaca riwayat absen.');
      }
    );
  }, [authUser?.uid, canUseGuardPage]);

  const currentSession = useMemo(
    () => sessions.find(isActiveLikeSession) || null,
    [sessions]
  );

  useEffect(() => {
    if (!currentSession?.clockInAt) {
      return undefined;
    }

    const calculateElapsed = () => {
      const start = new Date(currentSession.clockInAt).getTime();
      const diff = Math.max(0, Date.now() - start);
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const pad = (number) => String(number).padStart(2, '0');

      setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    const initialTickId = window.setTimeout(calculateElapsed, 0);
    const intervalId = window.setInterval(calculateElapsed, 1000);

    return () => {
      window.clearTimeout(initialTickId);
      window.clearInterval(intervalId);
    };
  }, [currentSession?.clockInAt]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthSessions = sessions.filter((session) => {
      const sessionDate = new Date(session.date);

      return sessionDate.getMonth() === currentMonth &&
        sessionDate.getFullYear() === currentYear;
    });
    const approved = thisMonthSessions.filter(
      (session) => session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
    );
    const pending = thisMonthSessions.filter(
      (session) => session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING
    );
    const totalHours = approved.reduce(
      (total, session) => total + (Number(session.durationHours) || 0),
      0
    );

    return {
      approvedDays: approved.length,
      pending: pending.length,
      totalHours: totalHours.toFixed(1),
    };
  }, [sessions]);

  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);
  const mealAmount = settings?.options?.mealPerPersonPerDay || 40000;
  const todayLabel = formatDate(new Date().toISOString());

  const guardAiContext = useMemo(
    () => createGuardAiContext({
      currentSession,
      isOnline,
      recentSessions,
      stats,
    }),
    [currentSession, isOnline, recentSessions, stats],
  );

  const assignedGuardPersonId =
    canStartGuardShift
      ? String(
          guardAccount?.guardId ||
          '',
        ).trim()
      : '';

  const selectedGuardPerson = useMemo(() => {
    if (
      !canStartGuardShift ||
      !guardIdentityLink.isValid ||
      guardIdentityLink.person?.id !== assignedGuardPersonId
    ) {
      return null;
    }

    return guardIdentityLink.person;
  }, [assignedGuardPersonId, canStartGuardShift, guardIdentityLink]);

  const guardDisplayName =
    selectedGuardPerson?.name ||
    guardIdentityLink.person?.name ||
    guardAccount?.displayName ||
    authUser?.displayName ||
    authUser?.email ||
    'Penjaga Studio';

  const guardInitials = guardDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'GS';

  const guardIdentityRepairMessage = isGuardIdentityRepairRequired
    ? getGuardIdentityRepairMessage(guardIdentityLink)
    : '';

  async function handleLogout() {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await adminAuthRepository.signOutAdmin();
      setGuardAccount(null);
      setAuthUser(null);
      setSessions([]);
    } catch (logoutError) {
      console.error('[guard-attendance] Logout gagal:', logoutError);
      setError('Logout gagal.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckIn() {
    if (!canStartGuardShift) {
      setError(
        guardIdentityRepairMessage ||
        'Akses operasional Guard tidak tersedia untuk membuat attendance baru.'
      );
      return;
    }

    if (!authUser?.uid) {
      setError('Login penjaga dulu.');
      return;
    }

    if (!selectedGuardPerson?.id || selectedGuardPerson.id !== guardAccount?.guardId) {
      setError('Identitas Guard belum valid. Hubungi Owner untuk menghubungkan ulang akun.');
      return;
    }

    const now = new Date();
    const todayStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const hasAlreadyCheckedInToday = sessions.some(
      (session) => session.date === todayStr && session.guardPersonId === selectedGuardPerson.id
    );

    if (hasAlreadyCheckedInToday) {
      setError('Anda sudah melakukan absensi hari ini. Tidak boleh absen dua kali di tanggal yang sama.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const nextSession = await createGuardAttendanceCheckIn({
        guardPerson: selectedGuardPerson,
        mealAmount,
        note,
        user: authUser,
      });

      setSessions((current) => [
        nextSession,
        ...current.filter((item) => item.id !== nextSession.id),
      ]);
      setNote('');
      setNotice(
        isOnline
          ? 'Clock-in tercatat. Status menunggu approval Owner.'
          : 'Clock-in disimpan offline dan akan disinkronkan saat koneksi kembali.'
      );
    } catch (checkInError) {
      console.error('[guard-attendance] Absen masuk gagal:', checkInError);
      setError(checkInError?.message || 'Absen gagal. Coba ulang atau hubungi Owner.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!canUseGuardPage) {
      setShowCheckOutConfirm(false);
      setError('Akses operasional Guard tidak tersedia untuk akun ini.');
      return;
    }

    if (!currentSession) {
      setShowCheckOutConfirm(false);
      setError('Tidak ada sesi jaga aktif.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const nextSession = await closeGuardAttendanceSession(currentSession, authUser);

      setSessions((current) => current.map((item) => (
        item.id === nextSession.id ? nextSession : item
      )));
      setShowCheckOutConfirm(false);
      setNotice(
        isOnline
          ? 'Clock-out tersimpan. Durasi shift sudah dikunci.'
          : 'Clock-out disimpan offline dan akan disinkronkan otomatis.'
      );
    } catch (checkOutError) {
      console.error('[guard-attendance] Selesai jaga gagal:', checkOutError);
      setError(checkOutError?.message || 'Clock-out belum berhasil.');
    } finally {
      setIsBusy(false);
    }
  }

  const blockedTitle = guardAccount?.role === 'studio_guard'
    ? 'Akses Guard belum aktif'
    : guardAccount?.role === 'admin'
      ? 'Akses Admin belum aktif'
      : 'Akses akun belum aktif';

  const blockedDescription = guardAccount?.role === 'studio_guard'
    ? guardAccount?.status === 'rejected'
      ? 'Akun Guard telah ditolak atau dinonaktifkan. Hubungi Owner sebelum mencoba clock-in.'
      : 'Akun Guard masih menunggu status approved dari Owner.'
    : guardAccount?.role === 'admin'
      ? 'Akun Admin belum memiliki konteks aktif untuk membuka workspace operasional ini.'
      : 'Status akun belum memenuhi syarat untuk menggunakan Guard Portal.';

  return (
    <main
      className="guard-portal theme-container"
      data-auth-surface="guard"
      data-guard-portal-ui="ui-guard-spatial-v2"
    >
      <GuardPortalHeader
        adminReturnPath={adminReturnPath}
        authUser={authUser}
        isAdminCrossPortal={isAdminCrossPortal}
        isBusy={isBusy}
        isOnline={isOnline}
        isOwnerOversight={isOwnerOversight}
        onLogout={handleLogout}
        todayLabel={todayLabel}
      />

      <div className="guard-portal-canvas">
        {!isReady ? (
          <GuardPortalAccessState
            description="Menyiapkan identitas, permission, dan riwayat attendance Anda."
            eyebrow="Menyiapkan workspace"
            icon={LoaderCircle}
            title="Memeriksa akses portal..."
          />
        ) : null}

        {isReady && !authUser ? (
          <GuardPortalAccessState
            actions={(
              <Link
                className="guard-portal-primary-action"
                to="/login?portal=guard&redirectTo=%2Fguard%2Fattendance"
              >
                <LogIn size={17} aria-hidden="true" />
                Masuk Guard Portal
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
            description="Email/password, Google, dan OTP nomor HP tersedia dari satu session Firebase yang sama."
            eyebrow="Attendance workspace"
            icon={ShieldCheck}
            title="Masuk untuk mulai shift"
          />
        ) : null}

        {isReady && authUser && isOwnerOversight ? (
          <section aria-label="Owner Oversight Mode" className="guard-portal-context-panel">
            <div className="guard-portal-context-icon" aria-hidden="true"><ShieldCheck size={24} /></div>
            <div className="guard-portal-context-copy">
              <StatusPill status="info">Owner Mode</StatusPill>
              <h1>Anda sedang melihat Guard Portal sebagai Owner</h1>
              <p>Mode Owner tidak membuat attendance. Gunakan akun Guard untuk clock-in dan clock-out.</p>
              <small>Owner · {guardAccount?.email || authUser?.email || '-'}</small>
              <small>Read-only Oversight · Tidak ada Guard identity yang dipakai pada mode ini.</small>
            </div>
            <div className="guard-portal-context-actions">
              <Link className="guard-portal-secondary-action" to={adminReturnPath}>
                Kembali ke Admin
              </Link>
              <Link className="guard-portal-primary-action" to="/admin/operations/guard-attendance">
                Buka Attendance Review
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {isReady && authUser && isAdminCrossPortal ? (
          <section aria-label="Admin Cross Portal" className="guard-portal-context-panel">
            <div className="guard-portal-context-icon" aria-hidden="true"><ShieldCheck size={24} /></div>
            <div className="guard-portal-context-copy">
              <StatusPill status="neutral">Admin context</StatusPill>
              <h1>Anda login sebagai Admin.</h1>
              <p>Guard Portal adalah workspace operasional penjaga. Kelola attendance dari Admin Portal.</p>
            </div>
            <div className="guard-portal-context-actions">
              <Link className="guard-portal-secondary-action" to={adminReturnPath}>Kembali ke Admin</Link>
              {canReviewGuardAttendance ? (
                <Link className="guard-portal-primary-action" to="/admin/operations/guard-attendance">
                  Buka Attendance Review
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {isReady && authUser && isWrongPortalClient ? (
          <GuardPortalAccessState
            actions={<Link className="guard-portal-primary-action" to="/client/portal">Buka Client Portal</Link>}
            aria-label="Wrong Portal Client"
            description="Anda login sebagai Client. Guard Portal hanya dipakai oleh penjaga operasional."
            icon={UserRound}
            title="Akun Client tidak menggunakan Guard Portal"
          />
        ) : null}

        {isReady && authUser && isBlockedGuardAccess ? (
          <GuardPortalAccessState
            actions={guardAccount?.role === 'admin'
              ? <Link className="guard-portal-secondary-action" to="/admin">Kembali ke Admin</Link>
              : null}
            aria-label="Guard Access Blocked"
            description={blockedDescription}
            icon={AlertCircle}
            title={blockedTitle}
            tone="warning"
          />
        ) : null}

        {isReady && authUser && isInvalidGuardAccess ? (
          <GuardPortalAccessState
            aria-label="Guard Account Recovery Required"
            description="Identitas atau role akun belum dikenali. Hubungi Owner untuk memeriksa User & Access Settings."
            icon={AlertCircle}
            title="Data akun belum dapat digunakan"
            tone="danger"
          />
        ) : null}

        {isReady && authUser && isGuardIdentityRepairRequired ? (
          <section aria-label="Guard Identity Repair Required" className="guard-portal-inline-alert is-warning">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Identitas Guard perlu diperbaiki</strong>
              <p>{guardIdentityRepairMessage || 'Akun Guard belum terhubung ke identitas crew. Hubungi Owner.'}</p>
            </div>
          </section>
        ) : null}

        {canUseGuardPage ? (
          <section className="guard-portal-workspace" aria-label="Panel absen penjaga">
            <header className="guard-portal-command-header">
              <div>
                <span className="guard-portal-eyebrow">Operations / Attendance</span>
                <h1>{currentSession ? 'Shift sedang berjalan' : 'Mulai shift hari ini'}</h1>
                <p>Clock-in, clock-out, dan riwayat kehadiran penjaga.</p>
              </div>
              <StatusPill status={currentSession ? 'success' : 'neutral'}>
                {currentSession ? 'On duty' : 'Ready'}
              </StatusPill>
            </header>

            <div className="guard-portal-workspace-grid">
              <section className={`guard-portal-shift-surface ${currentSession ? 'is-active' : 'is-idle'}`}>
                {!currentSession ? (
                  <div className="guard-portal-start-shift">
                    <div className="guard-portal-surface-heading">
                      <span aria-hidden="true"><BriefcaseBusiness size={20} /></span>
                      <div>
                        <small>Clock-in</small>
                        <h2>Mulai jaga</h2>
                      </div>
                    </div>

                    <div className="guard-portal-identity-row">
                      <span className="guard-portal-avatar">{guardInitials}</span>
                      <span>
                        <small>Guard terhubung</small>
                        <strong>{guardDisplayName}</strong>
                        <em>{guardAccount?.email || 'Akun Guard aktif'}</em>
                      </span>
                      <CheckCircle2 size={19} aria-label="Identitas terverifikasi" />
                    </div>

                    <label className="guard-portal-note-field" htmlFor="guard-shift-note">
                      <span>
                        <strong>Catatan shift</strong>
                        <small>Opsional · maksimal 1000 karakter</small>
                      </span>
                      <textarea
                        id="guard-shift-note"
                        maxLength={1000}
                        placeholder="Contoh: shift sore, serah terima kunci, atau tukar jadwal."
                        rows={4}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                      />
                      <small className="guard-portal-character-count">{note.length}/1000</small>
                    </label>

                    <button
                      className="guard-portal-primary-action is-full"
                      disabled={isBusy || !canStartGuardShift || !selectedGuardPerson?.id}
                      type="button"
                      onClick={handleCheckIn}
                    >
                      {isBusy ? <LoaderCircle className="auth-spin" size={18} /> : <LogIn size={18} />}
                      Clock-in sekarang
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="guard-portal-active-shift">
                    <div className="guard-portal-active-heading">
                      <span className="guard-portal-live-label"><i aria-hidden="true" /> Live shift</span>
                      <StatusPill status={getApprovalTone(currentSession.approvalStatus)}>
                        {getApprovalLabel(currentSession.approvalStatus)}
                      </StatusPill>
                    </div>

                    <div className="guard-portal-timer" aria-label={`Durasi shift ${elapsedTime}`}>
                      <small>Durasi berjalan</small>
                      <strong>{elapsedTime}</strong>
                      <span>Mulai {formatTime(currentSession.clockInAt)}</span>
                    </div>

                    <dl className="guard-portal-shift-facts">
                      <div><dt>Tanggal</dt><dd>{formatDate(currentSession.date)}</dd></div>
                      <div><dt>Meal shift</dt><dd>{formatCurrency(mealAmount)}</dd></div>
                      <div><dt>Clock-in</dt><dd>{formatDateTime(currentSession.clockInAt)}</dd></div>
                    </dl>

                    {currentSession.note ? (
                      <div className="guard-portal-shift-note">
                        <small>Catatan shift</small>
                        <p>{currentSession.note}</p>
                      </div>
                    ) : null}

                    <button
                      className="guard-portal-danger-action is-full"
                      disabled={isBusy}
                      type="button"
                      onClick={() => setShowCheckOutConfirm(true)}
                    >
                      <TimerReset size={18} aria-hidden="true" />
                      Clock-out dan akhiri shift
                    </button>
                  </div>
                )}
              </section>

              <aside className="guard-portal-side-context">
                <div className="guard-portal-person">
                  <span className="guard-portal-avatar is-large">{guardInitials}</span>
                  <div>
                    <small>PROFIL PENJAGA</small>
                    <h2>{guardDisplayName}</h2>
                    <p>{guardAccount?.email || '-'}</p>
                  </div>
                  <StatusPill status="success">Aktif</StatusPill>
                </div>

                <div className="guard-portal-metrics" aria-label="Ringkasan bulan ini">
                  <GuardMetric label="Approved Bulan Ini" value={`${stats.approvedDays}`} detail="hari bulan ini" />
                  <GuardMetric label="Total jam" value={stats.totalHours} detail="jam approved" />
                  <GuardMetric label="Menunggu Approval" value={`${stats.pending}`} detail="menunggu review" />
                </div>

                <div className="guard-portal-process-note">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <p><strong>Approval tetap terpisah.</strong> Clock-out mengunci durasi, lalu Owner meninjau eligibility dan meal.</p>
                </div>
              </aside>
            </div>

            <section className="guard-portal-history" aria-labelledby="guard-history-title">
              <header>
                <div>
                  <span className="guard-portal-history-icon" aria-hidden="true"><History size={18} /></span>
                  <span>
                    <small>Attendance log</small>
                    <h2 id="guard-history-title">Riwayat terbaru</h2>
                  </span>
                </div>
                <span>{recentSessions.length} dari {sessions.length} shift</span>
              </header>

              <div className="guard-portal-history-list">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <GuardHistoryRow key={session.id} session={session} />
                  ))
                ) : (
                  <div className="guard-portal-empty-state">
                    <Clock3 size={21} aria-hidden="true" />
                    <strong>Belum ada riwayat attendance</strong>
                    <p>Shift pertama akan muncul di sini setelah Anda melakukan clock-in.</p>
                  </div>
                )}
              </div>
            </section>
          </section>
        ) : null}
      </div>

      {canUseGuardPage && (notice || error) ? (
        <aside className={`guard-portal-feedback ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
          {error ? <AlertCircle size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
          <span>{error || notice}</span>
          <button
            aria-label="Tutup pemberitahuan"
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </aside>
      ) : null}

      {showCheckOutConfirm && canUseGuardPage ? (
        <Dialog.Root open onOpenChange={(open) => !isBusy && setShowCheckOutConfirm(open)}>
          <Dialog.Portal>
            <Dialog.Overlay className="guard-portal-dialog-overlay" />
            <Dialog.Content className="guard-portal-dialog-content" aria-describedby="guard-checkout-description">
              <div className="guard-portal-dialog-icon" aria-hidden="true"><XCircle size={21} /></div>
              <Dialog.Title>Sudah selesai jaga?</Dialog.Title>
              <Dialog.Description id="guard-checkout-description">
                Clock-out akan mengunci durasi shift. Status approval tetap ditinjau oleh Owner.
              </Dialog.Description>
              <div className="guard-portal-dialog-summary">
                <span><small>Durasi berjalan</small><strong>{elapsedTime}</strong></span>
                <span><small>Mulai</small><strong>{formatTime(currentSession?.clockInAt)}</strong></span>
              </div>
              <div className="guard-portal-dialog-actions">
                <Dialog.Close asChild>
                  <button className="guard-portal-secondary-action" disabled={isBusy} type="button">
                    Batal, lanjut jaga
                  </button>
                </Dialog.Close>
                <button
                  className="guard-portal-danger-action"
                  disabled={isBusy}
                  type="button"
                  onClick={handleCheckOut}
                >
                  {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <Check size={16} />}
                  Ya, clock-out
                </button>
              </div>
              <Dialog.Close className="guard-portal-dialog-close" aria-label="Tutup dialog" disabled={isBusy}>
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}

      {authUser && (canUseGuardPage || isOwnerOversight) ? (
        <Suspense fallback={null}>
          <RoleAiAssistant
            context={guardAiContext}
            role={isOwnerOversight ? 'owner' : 'guard'}
            surface="attendance"
            user={guardAccount || authUser}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
