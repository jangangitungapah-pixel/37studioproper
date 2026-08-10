import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  useLocation,
} from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  XCircle,
  Calendar,
  Briefcase,
  X,
  Eye,
  EyeOff,
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
import {
  hasAdminPagePermission,
} from '../../utils/adminPermissions.js';
import { isFirebaseConfigured } from '../../lib/firebase.js';
import { useOperatorFeeSettings } from '../../settings/operatorFeeSettings.js';
import '../../styles/admin-auth.css';

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

function formatCurrency(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function getApprovalLabel(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'Disetujui';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'Ditolak';

  return 'Menunggu owner';
}

function getApprovalTone(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'approved';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'rejected';

  return 'pending';
}

function getStatusLabel(session) {
  if (!session) return 'Belum absen';
  if (session.status === GUARD_ATTENDANCE_STATUSES.CLOSED) return 'Selesai jaga';
  if (session.status === GUARD_ATTENDANCE_STATUSES.ACTIVE) return 'Sedang jaga';
  if (session.status === GUARD_ATTENDANCE_STATUSES.REJECTED) return 'Ditolak';
  if (session.status === GUARD_ATTENDANCE_STATUSES.VOID) return 'Void';

  return 'Menunggu approval';
}

function isActiveLikeSession(session) {
  return session &&
    !session.clockOutAt &&
    [GUARD_ATTENDANCE_STATUSES.PENDING_APPROVAL, GUARD_ATTENDANCE_STATUSES.ACTIVE].includes(session.status);
}

export default function GuardAttendancePage() {
  const location = useLocation();
  const settings = useOperatorFeeSettings();
  const isAuthAvailable = Boolean(isFirebaseConfigured);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [authUser, setAuthUser] = useState(null);
  const [guardAccount, setGuardAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  const [isReady, setIsReady] = useState(!isAuthAvailable);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(isAuthAvailable ? '' : 'Firebase belum dikonfigurasi.');

  useEffect(() => {
    const handleOnline =
      () =>
        setIsOnline(
          true,
        );

    const handleOffline =
      () =>
        setIsOnline(
          false,
        );

    window.addEventListener(
      'online',
      handleOnline,
    );

    window.addEventListener(
      'offline',
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      );

      window.removeEventListener(
        'offline',
        handleOffline,
      );
    };
  }, []);

  useEffect(() => {
    if (!isAuthAvailable) {
      return () => {};
    }

    return adminAuthRepository.subscribeAdminAuth((nextAuthState) => {
      const nextUser = nextAuthState?.user || null;
      const nextGuardPortalAccess = resolveGuardPortalAccess(nextUser);
      const nextCanUseGuardPage = Boolean(
        nextUser?.uid &&
        [
          GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
          GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL,
        ].includes(nextGuardPortalAccess)
      );

      setAuthUser(nextUser);
      setGuardAccount(nextUser);
      setIsReady(Boolean(nextAuthState?.isReady));
      setNotice('');

      if (!nextCanUseGuardPage) {
        setSessions([]);
      }

      if (nextAuthState?.errorMessage) {
        setError(nextAuthState.errorMessage);
      } else {
        setError('');
      }
    });
  }, [isAuthAvailable]);

  const guardPortalAccess = useMemo(
    () => resolveGuardPortalAccess(guardAccount),
    [guardAccount]
  );

  const canUseGuardPage = Boolean(
    authUser?.uid &&
    [
      GUARD_PORTAL_ACCESS.GUARD_OPERATIONAL,
      GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL,
    ].includes(guardPortalAccess)
  );

  const isOwnerOversight = Boolean(
    authUser?.uid &&
    guardPortalAccess ===
      GUARD_PORTAL_ACCESS.OWNER_OVERSIGHT
  );

  const isAdminCrossPortal = Boolean(
    authUser?.uid &&
    guardPortalAccess ===
      GUARD_PORTAL_ACCESS.REDIRECT_ADMIN
  );

  const canReviewGuardAttendance = Boolean(
    isAdminCrossPortal &&
    hasAdminPagePermission(
      guardAccount,
      'guard-attendance',
    )
  );

  const adminReturnPath = useMemo(() => {
    const returnTo =
      location.state?.returnTo;

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
    if (!authUser?.uid || !canUseGuardPage) {
      return () => {};
    }

    return subscribeGuardAttendanceSessions(
      {
        guardUid: authUser.uid,
      },
      (nextSessions) => {
        setSessions(nextSessions);
      },
      (subscribeError) => {
        console.error(
          '[guard-attendance] Gagal membaca riwayat absen:',
          subscribeError
        );

        setError(
          'Gagal membaca riwayat absen.'
        );
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
      const now = Date.now();
      const diff = Math.max(0, now - start);

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      const pad = (num) => String(num).padStart(2, '0');
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

      return (
        sessionDate.getMonth() === currentMonth &&
        sessionDate.getFullYear() === currentYear
      );
    });

    const approved = thisMonthSessions.filter(
      (session) =>
        session.approvalStatus ===
        GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED
    );

    const pending = thisMonthSessions.filter(
      (session) =>
        session.approvalStatus ===
        GUARD_ATTENDANCE_APPROVAL_STATUSES.PENDING
    );

    const totalHours = approved.reduce(
      (total, session) =>
        total +
        (Number(session.durationHours) || 0),
      0,
    );

    return {
      approvedDays:
        approved.length,

      pending:
        pending.length,

      totalHours:
        totalHours.toFixed(1),
    };
  }, [sessions]);

  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);
  const mealAmount = settings.options?.mealPerPersonPerDay || 40000;
  const todayLabel = formatDate(new Date().toISOString());

  const assignedGuardPersonId =
    canUseGuardPage
      ? (
          guardAccount?.guardId ||
          authUser?.uid ||
          ''
        )
      : '';

  const selectedGuardPerson = useMemo(() => {
    const assignedPerson =
      settings.people.find(
        (person) =>
          person.id ===
          assignedGuardPersonId,
      );

    if (assignedPerson) {
      return assignedPerson;
    }

    return {
      defaultPaymentMethod:
        'cash',

      id:
        assignedGuardPersonId,

      name:
        authUser?.displayName ||
        guardAccount?.displayName ||
        authUser?.email ||
        'Penjaga Studio',
    };
  }, [
    assignedGuardPersonId,
    authUser?.displayName,
    authUser?.email,
    guardAccount?.displayName,
    settings.people,
  ]);


  async function handleSignIn(event) {
    event.preventDefault();

    if (!isAuthAvailable) {
      setError('Firebase belum dikonfigurasi.');
      return;
    }

    if (!email.trim() || !password) {
      setError('Isi email dan password penjaga.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await adminAuthRepository.signInAdmin({
        email: email.trim(),
        password,
      });
    } catch (signInError) {
      console.error(
        '[guard-attendance] Login gagal:',
        signInError
      );

      setError(
        adminAuthRepository.getAdminAuthErrorMessage(
          signInError
        ) ||
        'Login gagal. Cek email dan password.'
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!isAuthAvailable) {
      setError('Firebase belum dikonfigurasi.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await adminAuthRepository.signInWithGoogle();
    } catch (googleError) {
      console.error(
        '[guard-attendance] Login Google gagal:',
        googleError
      );

      setError(
        adminAuthRepository.getAdminAuthErrorMessage(
          googleError
        ) ||
        'Login Google gagal.'
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await adminAuthRepository.signOutAdmin();

      setEmail('');
      setPassword('');
      setGuardAccount(null);
      setAuthUser(null);
      setSessions([]);
    } catch (logoutError) {
      console.error(
        '[guard-attendance] Logout gagal:',
        logoutError
      );

      setError(
        'Logout gagal.'
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckIn() {
    if (!canUseGuardPage) {
      setError(
        'Akses operasional Guard tidak tersedia untuk akun ini.'
      );
      return;
    }

    if (!authUser?.uid) {
      setError('Login penjaga dulu.');
      return;
    }

    if (!selectedGuardPerson?.id) {
      setError('Pilih profil penjaga dulu.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('en-CA'); // Get local date in YYYY-MM-DD format safely
    const hasAlreadyCheckedInToday = sessions.some(
      (s) => s.date === todayStr && s.guardPersonId === selectedGuardPerson.id
    );

    if (hasAlreadyCheckedInToday) {
      setError('Anda sudah melakukan absensi hari ini. Tidak boleh absen dua kali di tanggal yang sama.');
      return;
    }

    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const nextSession =
        await createGuardAttendanceCheckIn({
          guardPerson:
            selectedGuardPerson,

          mealAmount,

          note,

          user:
            authUser,
        });

      setSessions(
        (
          current,
        ) => [
          nextSession,

          ...current.filter(
            (
              item,
            ) =>
              item.id !==
              nextSession.id,
          ),
        ],
      );

      setNote('');

      setNotice(
        isOnline
          ? 'Absen dikirim. Tunggu approval owner.'
          : 'Absen tersimpan offline dan akan disinkronkan otomatis saat koneksi kembali.',
      );
    } catch (checkInError) {
      console.error('[guard-attendance] Absen masuk gagal:', checkInError);
      setError(
        checkInError?.message ||
        'Absen gagal. Coba ulang atau hubungi owner.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!canUseGuardPage) {
      setShowCheckOutConfirm(false);
      setError(
        'Akses operasional Guard tidak tersedia untuk akun ini.'
      );
      return;
    }

    if (!currentSession) {
      setError('Tidak ada sesi jaga aktif.');
      return;
    }

    setShowCheckOutConfirm(false);
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      const nextSession =
        await closeGuardAttendanceSession(
          currentSession,
          authUser,
        );

      setSessions(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item.id ===
              nextSession.id
                ? nextSession
                : item,
          ),
      );

      setNotice(
        isOnline
          ? 'Selesai jaga tersimpan.'
          : 'Selesai jaga tersimpan offline dan akan disinkronkan otomatis.',
      );
    } catch (checkOutError) {
      console.error('[guard-attendance] Selesai jaga gagal:', checkOutError);
      setError(
        checkOutError?.message ||
        'Selesai jaga gagal.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="guard-shift-page">
      <section className="guard-shift-shell">
        <header className="guard-shift-hero">
          <div className="guard-shift-brand">
            <span>
              {isOwnerOversight
                ? '37 Studio Guard · Owner Oversight'
                : isAdminCrossPortal
                  ? '37 Studio Guard · Admin Context'
                  : '37 Studio Guard'}
            </span>
            <h1>
              {isOwnerOversight || isAdminCrossPortal
                ? 'Guard Portal'
                : 'Absen Penjaga'}
            </h1>
            <small>
              {isOwnerOversight
                ? 'Anda sedang melihat Guard Portal sebagai Owner.'
                : isAdminCrossPortal
                  ? 'Anda login sebagai Admin. Gunakan Admin Portal untuk pengelolaan attendance.'
                  : 'Clock-in, clock-out, dan riwayat kehadiran penjaga.'}
            </small>
          </div>

          <div className="guard-shift-hero-actions">
            <span className={`guard-shift-status-chip is-${isOnline ? 'online' : 'offline'}`}>
              <span className="status-dot"></span>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="guard-shift-date-chip">
              <Clock3 size={12} />
              {todayLabel}
            </span>

            {authUser &&
            (
              isOwnerOversight ||
              isAdminCrossPortal ||
              (
                guardAccount?.role === 'admin' &&
                guardPortalAccess ===
                  GUARD_PORTAL_ACCESS.LEGACY_GUARD_OPERATIONAL
              )
            ) ? (
              <Link
                className="guard-shift-ghost-button"
                to={adminReturnPath}
              >
                <ShieldCheck size={12} />
                Kembali ke Admin
              </Link>
            ) : null}

            {authUser ? (
              <button
                aria-label="Keluar Akun"
                className="guard-shift-ghost-button"
                type="button"
                disabled={isBusy}
                onClick={handleLogout}
              >
                <LogOut size={12} />
                Keluar Akun
              </button>
            ) : null}
          </div>
        </header>

        {!isReady ? (
          <section className="guard-shift-card is-loading">
            <LoaderCircle className="auth-spin" size={24} />
            <p>Memeriksa akses portal...</p>
          </section>
        ) : null}

        {isReady && !authUser ? (
          <section className="guard-shift-card">
            <div className="guard-shift-title">
              <strong>Login Penjaga</strong>
              <small>Masuk menggunakan akun yang sudah terdaftar.</small>
            </div>

            <form className="guard-shift-login" onSubmit={handleSignIn}>
              {error && (
                <div className="auth-alert">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="auth-alert is-success">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  type="email"
                  placeholder="name@studio.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isBusy}
                  required
                />
              </label>

              <label>
                <span>Password</span>
                <div className="guard-password-wrap">
                  <input
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ketik password Anda"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isBusy}
                    required
                  />
                  <button
                    type="button"
                    className="guard-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <button className="guard-shift-main-button" type="submit" disabled={isBusy}>
                {isBusy ? <LoaderCircle className="auth-spin" size={14} /> : <LogIn size={14} />}
                Masuk Portal Jaga
              </button>

              <div className="guard-shift-login-divider">
                <span>atau</span>
              </div>

              <button 
                className="guard-shift-google-button" 
                type="button" 
                disabled={isBusy} 
                onClick={handleGoogleSignIn}
              >
                <svg className="google-icon-svg" viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Masuk dengan Google
              </button>
            </form>
          </section>
        ) : null}

        {isReady && authUser && isOwnerOversight ? (
          <section
            className="guard-shift-card"
            aria-label="Owner Oversight Mode"
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            <div
              style={{
                alignItems: 'flex-start',
                display: 'flex',
                gap: '12px',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  minWidth: 0,
                }}
              >
                <div className="guard-badge-row">
                  <span className="guard-role-badge">
                    Owner Mode
                  </span>
                  <span className="guard-status-badge">
                    Read-only Oversight
                  </span>
                </div>

                <div>
                  <strong>
                    Anda sedang melihat Guard Portal sebagai Owner
                  </strong>
                  <p
                    style={{
                      margin: '6px 0 0',
                    }}
                  >
                    Mode Owner tidak membuat attendance. Gunakan akun Guard
                    untuk Clock In/Out.
                  </p>
                </div>
              </div>

              <ShieldCheck
                aria-hidden="true"
                size={28}
              />
            </div>

            <div
              className="guard-profile-dashboard-card"
              style={{
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gap: '4px',
                }}
              >
                <small>ACCOUNT CONTEXT</small>
                <strong>
                  Owner · {guardAccount?.email || authUser?.email || '-'}
                </strong>
                <span
                  style={{
                    fontSize: '12px',
                    opacity: 0.72,
                  }}
                >
                  Tidak ada Guard identity yang dipakai pada mode ini.
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <Link
                className="guard-shift-ghost-button"
                to={adminReturnPath}
                style={{
                  textDecoration: 'none',
                }}
              >
                <ShieldCheck size={14} />
                Kembali ke Admin
              </Link>

              <Link
                className="guard-shift-main-button"
                to="/admin/operations/guard-attendance"
                style={{
                  textDecoration: 'none',
                }}
              >
                <Calendar size={14} />
                Buka Attendance Review
              </Link>
            </div>
          </section>
        ) : null}

        {isReady && authUser && isAdminCrossPortal ? (
          <section
            aria-label="Admin Cross Portal"
            className="guard-shift-card is-locked"
          >
            <ShieldCheck size={24} />
            <strong>Anda login sebagai Admin.</strong>
            <p>
              Guard Portal adalah workspace operasional penjaga.
              Gunakan Admin Portal untuk pengelolaan dan review attendance.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                justifyContent: 'center',
              }}
            >
              <Link
                className="guard-shift-ghost-button"
                to={adminReturnPath}
              >
                <ShieldCheck size={14} />
                Kembali ke Admin
              </Link>

              {canReviewGuardAttendance ? (
                <Link
                  className="guard-shift-main-button"
                  to="/admin/operations/guard-attendance"
                >
                  <Calendar size={14} />
                  Buka Attendance Review
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {isReady &&
        authUser &&
        !canUseGuardPage &&
        !isOwnerOversight &&
        !isAdminCrossPortal ? (
          <section className="guard-shift-card is-locked">
            <ShieldCheck size={24} />
            <strong>Akses belum aktif</strong>
            <p>Akun ini belum punya role Penjaga Studio approved.</p>
          </section>
        ) : null}

        {canUseGuardPage ? (
          <section className="guard-shift-workspace" aria-label="Panel absen penjaga" style={{ display: 'grid', gap: '12px' }}>
            
            {/* ── PROFILE & MONTHLY STATS HEADER ── */}
            <div className="guard-profile-dashboard-card">
              <div className="guard-profile-info-header">
                <div className="guard-avatar-large">
                  {selectedGuardPerson.name ? selectedGuardPerson.name.slice(0, 2).toUpperCase() : 'GD'}
                </div>
                <div className="guard-name-details">
                  <h2>{selectedGuardPerson.name}</h2>
                  <span className="guard-email-chip">{guardAccount?.email}</span>
                  <div className="guard-badge-row">
                    <span className="guard-role-badge">Penjaga Studio</span>
                    <span className="guard-status-badge">Aktif</span>
                  </div>
                </div>
              </div>

              {/* Monthly Stats Grid */}
              <div className="guard-stats-grid">
                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Calendar size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Approved Bulan Ini</small>
                    <strong>{stats.approvedDays} Hari</strong>
                  </div>
                </div>
                <div className="guard-stat-item">
                  <span className="guard-stat-icon"><Clock3 size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Total Jam Jaga</small>
                    <strong>{stats.totalHours} Jam</strong>
                  </div>
                </div>
                <div className="guard-stat-item is-highlight">
                  <span className="guard-stat-icon"><Clock3 size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Menunggu Approval</small>
                    <strong>{stats.pending}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ACTIVE SHIFT CONTROL CARD ── */}
            <div className="guard-shift-card is-action-overhaul">
              {!currentSession ? (
                <div className="guard-clockin-panel">
                  <div className="guard-panel-title">
                    <Briefcase size={18} className="icon-pulse" style={{ color: 'var(--auth-accent)' }} />
                    <div>
                      <h3>Mulai Shift Baru</h3>
                      <p>Pastikan profil yang dipilih sesuai dengan nama Anda.</p>
                    </div>
                  </div>

                  <div className="guard-shift-form-grid">
                    <label className="guard-input-label">
                      <span>PROFIL PENJAGA</span>
                      <input
                        className="guard-select"
                        disabled
                        readOnly
                        value={selectedGuardPerson.name}
                      />
                    </label>

                    <label className="guard-input-label">
                      <span>CATATAN SHIFT (OPSIONAL)</span>
                      <textarea
                        placeholder="Masukkan catatan jika ada (misal: shift sore, tukar jadwal, dll.)"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="guard-textarea"
                      />
                    </label>
                  </div>

                  <button
                    className="guard-shift-btn-glow"
                    type="button"
                    disabled={isBusy || !selectedGuardPerson?.id}
                    onClick={handleCheckIn}
                  >
                    {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Mulai Jaga Sekarang
                  </button>
                </div>
              ) : (
                <div className="guard-active-shift-panel">
                  <div className="guard-active-header">
                    <div className="guard-active-badge">
                      <span className="pulse-dot"></span>
                      SHIFT AKTIF
                    </div>
                    <span className={'status-badge is-' + getApprovalTone(currentSession.approvalStatus)}>
                      {getApprovalLabel(currentSession.approvalStatus)}
                    </span>
                  </div>

                  {/* Digital Clock Display */}
                  <div className="guard-live-timer-container">
                    <div className="guard-timer-label">DURASI JAGA BERJALAN</div>
                    <div className="guard-timer-clock">{elapsedTime}</div>
                  </div>

                  {/* Shift Details List */}
                  <div className="guard-shift-details-card">
                    <div className="detail-row">
                      <span>Waktu Mulai:</span>
                      <strong>{formatDateTime(currentSession.clockInAt)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Uang Makan Shift:</span>
                      <strong>{formatCurrency(mealAmount)}</strong>
                    </div>
                    {currentSession.note && (
                      <div className="detail-row is-note">
                        <span>Catatan:</span>
                        <p>"{currentSession.note}"</p>
                      </div>
                    )}
                  </div>

                  <button
                    className="guard-shift-btn-danger"
                    type="button"
                    disabled={isBusy}
                    onClick={() => setShowCheckOutConfirm(true)}
                  >
                    {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <XCircle size={16} />}
                    Selesai Jaga & Ajukan Approval
                  </button>
                </div>
              )}
            </div>

            {/* ── RECENT SHIFTS HISTORY ── */}
            <div className="guard-shift-card is-history-overhaul">
              <div className="guard-panel-title">
                <Calendar size={16} style={{ color: 'var(--auth-accent)' }} />
                <div>
                  <h3>Riwayat Absensi</h3>
                  <p>Catatan kehadiran dan status persetujuan dari Owner.</p>
                </div>
              </div>

              <div className="guard-history-cards-list">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <article
                      className={'guard-history-card-item is-status-' + getApprovalTone(session.approvalStatus)}
                      key={session.id}
                    >
                      <div className="history-main-info">
                        <div className="history-date-row">
                          <strong>{formatDate(session.date)}</strong>
                          <span className={'status-badge is-' + getApprovalTone(session.approvalStatus)}>
                            {getApprovalLabel(session.approvalStatus)}
                          </span>
                        </div>
                        <div className="history-time-range">
                          <span>🕒 {formatDateTime(session.clockInAt)}</span>
                          <span>{session.clockOutAt ? ` s/d ${formatDateTime(session.clockOutAt)}` : ' (Sedang Jaga)'}</span>
                        </div>
                        {session.durationHours !== undefined && (
                          <div className="history-duration">
                            <span>Durasi: <b>{session.durationHours.toFixed(1)} jam</b>{session.mealEligible && session.mealAmount > 0 ? ` · Makan: ${formatCurrency(session.mealAmount)}` : ''}</span>

                          </div>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="guard-shift-history-empty">Belum ada riwayat absensi.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* Floating feedback for operational tasks inside the portal */}
        {canUseGuardPage && (notice || error) ? (
          <aside className="guard-shift-feedback">
            {notice ? (
              <p className="is-success">
                <CheckCircle2 size={13} />
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="is-error">
                <AlertCircle size={13} />
                {error}
              </p>
            ) : null}
          </aside>
        ) : null}
      </section>

      {/* ── CHECKOUT CONFIRMATION MODAL ── */}
      {showCheckOutConfirm && canUseGuardPage ? (
        <div
          className="guard-modal-backdrop settings-permission-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCheckOutConfirm(false);
          }}
        >
          <div className="guard-modal-panel settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-confirm-title">
            <header className="settings-permission-head">
              <div>
                <small>Konfirmasi Selesai Jaga</small>
                <h3 id="checkout-confirm-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={18} style={{ color: 'var(--auth-danger, #ef4444)' }} />
                  Sudah selesai jaga?
                </h3>
              </div>
              <button type="button" aria-label="Batal" onClick={() => setShowCheckOutConfirm(false)}>
                <X size={16} />
              </button>
            </header>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--studio-text-main)' }}>
                Pastikan Anda sudah <strong>benar-benar selesai jaga</strong> sebelum mengklik konfirmasi.
              </p>
              <div style={{
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: 'var(--studio-text-main)',
                lineHeight: '1.6',
              }}>
                ℹ️ <strong>Catatan:</strong> Setelah selesai jaga, durasi shift dikunci dan status approval tetap dapat ditinjau oleh owner.
              </div>
            </div>

            <footer className="settings-permission-actions" style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
              <button
                className="settings-mini-button"
                type="button"
                onClick={() => setShowCheckOutConfirm(false)}
                style={{ flex: 1 }}
              >
                Batal, Lanjut Jaga
              </button>
              <button
                className="settings-mini-button is-danger"
                type="button"
                disabled={isBusy}
                onClick={handleCheckOut}
                style={{ flex: 1 }}
              >
                {isBusy ? <LoaderCircle className="auth-spin" size={13} /> : null}
                Ya, Selesai Jaga
              </button>
            </footer>
          </div>
        </div>
      ) : null}

    </main>
  );
}

