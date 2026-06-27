import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
  XCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  Briefcase,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  STUDIO_GUARD_ROLE,
  closeGuardAttendanceSession,
  createGuardAttendanceCheckIn,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
import { subscribeOperatorFeeEntries } from '../../services/operatorFeeRepository.js';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../../lib/firebase.js';
import {
  OPERATOR_FEE_PERSON_ROLES,
  useOperatorFeeSettings,
} from '../../settings/operatorFeeSettings.js';
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

function getGuardPeople(settings) {
  return settings.people
    .filter((person) =>
      person.active &&
      [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.BOTH].includes(person.role)
    )
    .map((person) => ({
      key: person.id,
      label: person.name,
    }));
}

async function readGuardAccount(user) {
  if (!firestoreDb || !user?.uid) return null;

  const snap = await getDoc(doc(firestoreDb, 'users', user.uid));

  if (!snap.exists()) {
    return {
      role: '',
      status: '',
      uid: user.uid,
    };
  }

  return {
    uid: user.uid,
    ...snap.data(),
  };
}

export default function GuardAttendancePage() {
  const settings = useOperatorFeeSettings();
  const isAuthAvailable = isFirebaseConfigured && Boolean(firebaseAuth);

  const [authUser, setAuthUser] = useState(null);
  const [guardAccount, setGuardAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedGuardPersonId, setSelectedGuardPersonId] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [feeEntries, setFeeEntries] = useState([]);
  const [selectedSessionForBreakdown, setSelectedSessionForBreakdown] = useState(null);
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  const [isReady, setIsReady] = useState(!isAuthAvailable);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(isAuthAvailable ? '' : 'Firebase belum dikonfigurasi.');

  const guardOptions = useMemo(() => getGuardPeople(settings), [settings]);

  useEffect(() => {
    if (!isAuthAvailable) return () => {};

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user || null);
      setNotice('');
      setError('');

      if (!user) {
        setGuardAccount(null);
        setSessions([]);
        setIsReady(true);
        return;
      }

      try {
        const account = await readGuardAccount(user);
        setGuardAccount(account);

        const isAllowedGuard = account && (account.role === STUDIO_GUARD_ROLE || (account.role === 'admin' && account.isGuard === true));
        if (!isAllowedGuard || account?.status !== 'approved') {
          setError('Akun ini belum aktif sebagai Penjaga Studio.');
        }
      } catch (readError) {
        console.error('[guard-attendance] Gagal membaca akun penjaga:', readError);
        setGuardAccount(null);
        setError('Gagal membaca data akun penjaga.');
      } finally {
        setIsReady(true);
      }
    });

    return unsubscribe;
  }, [isAuthAvailable]);

  useEffect(() => {
    const isAllowedGuard = guardAccount && (guardAccount.role === STUDIO_GUARD_ROLE || (guardAccount.role === 'admin' && guardAccount.isGuard === true));
    if (!authUser?.uid || !isAllowedGuard || guardAccount?.status !== 'approved') {
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
        console.error('[guard-attendance] Gagal membaca riwayat absen:', subscribeError);
        setError('Gagal membaca riwayat absen.');
      }
    );
  }, [authUser?.uid, guardAccount]);

  useEffect(() => {
    const isAllowedGuard = guardAccount && (guardAccount.role === STUDIO_GUARD_ROLE || (guardAccount.role === 'admin' && guardAccount.isGuard === true));
    if (!authUser?.uid || !isAllowedGuard || guardAccount?.status !== 'approved') {
      return () => {};
    }

    return subscribeOperatorFeeEntries(
      (list) => {
        setFeeEntries(list);
      },
      (err) => {
        console.error('[guard-attendance] Gagal membaca data fee:', err);
      }
    );
  }, [authUser?.uid, guardAccount]);

  const currentSession = useMemo(
    () => sessions.find(isActiveLikeSession) || null,
    [sessions]
  );

  useEffect(() => {
    if (!currentSession?.clockInAt) {
      setElapsedTime('00:00:00');
      return () => {};
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

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [currentSession?.clockInAt]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthSessions = sessions.filter((s) => {
      const sDate = new Date(s.date);
      return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
    });

    const approved = thisMonthSessions.filter((s) => s.approvalStatus === 'approved');

    const totalHours = approved.reduce((acc, s) => acc + (s.durationHours || 0), 0);

    // Uang makan hanya dihitung SATU kali per penjaga per hari (deduplikasi by guardPersonId+date).
    // Safety net untuk kasus penjaga yang memiliki dua sesi approved di tanggal yang sama.
    const mealByDay = new Map();
    for (const s of approved) {
      if (!s.mealEligible) continue;
      const key = s.guardPersonId + '::' + s.date;
      if (!mealByDay.has(key)) mealByDay.set(key, s.mealAmount || 0);
    }
    const totalMeals = Array.from(mealByDay.values()).reduce((acc, v) => acc + v, 0);

    // Commissions are matched by DATE + personId only — clock-out time is irrelevant.
    // This means bookings that happen AFTER the guard clocks out still count, as long
    // as they fall on the same calendar date. We use ALL sessions in the month (not just
    // approved) so commissions are never missed due to a pending attendance status.
    const allDates = new Set(thisMonthSessions.map((s) => s.date + '::' + s.guardPersonId));
    const totalCommissions = feeEntries.reduce((acc, entry) => {
      const key = entry.bookingDate + '::' + entry.personId;
      return allDates.has(key) ? acc + (entry.amount || 0) : acc;
    }, 0);

    const totalEarnings = totalMeals + totalCommissions;

    return {
      count: approved.length,
      totalHours: totalHours.toFixed(1),
      totalMeals,
      totalCommissions,
      totalEarnings,
    };
  }, [sessions, feeEntries]);
  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);
  const mealAmount = settings.options?.mealPerPersonPerDay || 40000;
  const todayLabel = formatDate(new Date().toISOString());

  const visibleGuardOptions = useMemo(() => {
    if (guardOptions.length) return guardOptions;

    return [{
      key: authUser?.uid || 'guard',
      label: authUser?.displayName || authUser?.email || 'Penjaga Studio',
    }];
  }, [authUser, guardOptions]);

  const effectiveGuardPersonId = selectedGuardPersonId || visibleGuardOptions[0]?.key || authUser?.uid || '';

  const selectedGuardPerson = useMemo(() => {
    const person = settings.people.find((item) => item.id === effectiveGuardPersonId);

    if (person) return person;

    return {
      id: effectiveGuardPersonId || authUser?.uid || '',
      name: authUser?.displayName || authUser?.email || 'Penjaga Studio',
      defaultPaymentMethod: 'cash',
    };
  }, [authUser, effectiveGuardPersonId, settings.people]);

  const isAllowedGuard = guardAccount && (guardAccount.role === STUDIO_GUARD_ROLE || (guardAccount.role === 'admin' && guardAccount.isGuard === true));
  const canUseGuardPage = authUser &&
    isAllowedGuard &&
    guardAccount?.status === 'approved';

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
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (signInError) {
      console.error('[guard-attendance] Login gagal:', signInError);
      setError('Login gagal. Cek email dan password.');
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(firebaseAuth, provider);
    } catch (googleError) {
      console.error('[guard-attendance] Login Google gagal:', googleError);
      if (googleError?.code === 'auth/popup-blocked') {
        setError('Popup Google diblokir browser. Izinkan pop-up atau coba lagi.');
      } else {
        setError('Login Google gagal.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await signOut(firebaseAuth);
      setEmail('');
      setPassword('');
      setGuardAccount(null);
      setSessions([]);
    } catch (logoutError) {
      console.error('[guard-attendance] Logout gagal:', logoutError);
      setError('Logout gagal.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckIn() {
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
      await createGuardAttendanceCheckIn({
        guardPerson: selectedGuardPerson,
        mealAmount,
        note,
        user: authUser,
      });

      setNote('');
      setNotice('Absen dikirim. Tunggu approval owner.');
    } catch (checkInError) {
      console.error('[guard-attendance] Absen masuk gagal:', checkInError);
      setError('Absen gagal. Coba ulang atau hubungi owner.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!currentSession) {
      setError('Tidak ada sesi jaga aktif.');
      return;
    }

    setShowCheckOutConfirm(false);
    setIsBusy(true);
    setError('');
    setNotice('');

    try {
      await closeGuardAttendanceSession(currentSession, authUser);
      setNotice('Selesai jaga tersimpan.');
    } catch (checkOutError) {
      console.error('[guard-attendance] Selesai jaga gagal:', checkOutError);
      setError('Selesai jaga gagal.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="guard-shift-page">
      <section className="guard-shift-shell">
        <header className="guard-shift-hero">
          <div className="guard-shift-brand">
            <span>37 Studio Guard</span>
            <h1>Absen Penjaga</h1>
            <small>Absensi harian untuk validasi fee dan uang makan.</small>
          </div>

          <div className="guard-shift-hero-actions">
            <span className="guard-shift-date-chip">
              <Clock3 size={12} />
              {todayLabel}
            </span>

            {authUser && guardAccount?.role === 'admin' ? (
              <a href="/admin" className="guard-shift-ghost-button">
                <ShieldCheck size={12} />
                Portal Admin
              </a>
            ) : null}

            {authUser ? (
              <button className="guard-shift-ghost-button" type="button" disabled={isBusy} onClick={handleLogout}>
                <LogOut size={12} />
                Keluar
              </button>
            ) : null}
          </div>
        </header>

        {!isReady ? (
          <section className="guard-shift-card is-loading">
            <LoaderCircle className="auth-spin" size={24} />
            <p>Membaca akun...</p>
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

        {isReady && authUser && !canUseGuardPage ? (
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
                    <small>Kehadiran (Bulan Ini)</small>
                    <strong>{stats.count} Hari</strong>
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
                  <span className="guard-stat-icon"><DollarSign size={14} /></span>
                  <div className="guard-stat-content">
                    <small>Estimasi Pendapatan</small>
                    <strong>{formatCurrency(stats.totalEarnings)}</strong>
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
                      <span>PILIH PROFIL SHIFT</span>
                      <select
                        value={effectiveGuardPersonId}
                        onChange={(event) => setSelectedGuardPersonId(event.target.value)}
                        className="guard-select"
                      >
                        {visibleGuardOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
                    disabled={isBusy || !effectiveGuardPersonId}
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
                <TrendingUp size={16} style={{ color: 'var(--auth-accent)' }} />
                <div>
                  <h3>Riwayat Absensi</h3>
                  <p>Catatan kehadiran dan status persetujuan dari Owner.</p>
                </div>
              </div>

              <div className="guard-history-cards-list">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <button
                      className="guard-history-card-item"
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSessionForBreakdown(session)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
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
                            Durasi: <b>{session.durationHours.toFixed(1)} jam</b>
                            {session.mealEligible && session.mealAmount > 0 && ` | Uang Makan: ${formatCurrency(session.mealAmount)}`}
                          </div>
                        )}
                      </div>
                    </button>
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
      {showCheckOutConfirm ? (
        <div
          className="settings-permission-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCheckOutConfirm(false);
          }}
        >
          <div className="settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-confirm-title" style={{ maxWidth: '360px' }}>
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
                ⚠️ <strong>Perhatian:</strong> Komisi booking yang terjadi <em>setelah</em> Anda selesai jaga tetap akan terhitung selama booking masih terdaftar di tanggal jaga Anda hari ini.
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


      {selectedSessionForBreakdown ? (() => {
        const session = selectedSessionForBreakdown;
        const mealWage = session.mealEligible ? (session.mealAmount || 0) : 0;

        const commissions = feeEntries.filter(
          (entry) => entry.bookingDate === session.date && entry.personId === session.guardPersonId
        );
        const totalCommissions = commissions.reduce((sum, entry) => sum + (entry.amount || 0), 0);
        const totalEarnings = mealWage + totalCommissions;

        return (
          <div
            className="settings-permission-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedSessionForBreakdown(null);
            }}
          >
            <div className="settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="breakdown-title" style={{ maxWidth: '380px' }}>
              <header className="settings-permission-head">
                <div>
                  <small>Breakdown Pendapatan</small>
                  <h3 id="breakdown-title">Absen: {formatDate(session.date)}</h3>
                  <span className={'status-badge is-' + getApprovalTone(session.approvalStatus)} style={{ display: 'inline-block', marginTop: '4px' }}>
                    {getApprovalLabel(session.approvalStatus)}
                  </span>
                </div>
                <button type="button" aria-label="Tutup breakdown" onClick={() => setSelectedSessionForBreakdown(null)}>
                  <X size={16} />
                </button>
              </header>

              <div className="settings-permission-flat-list" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--studio-text-muted)' }}>Uang Makan</span>
                  <strong style={{ color: 'var(--studio-text-strong)' }}>{session.mealEligible ? formatCurrency(mealWage) : <em style={{ fontWeight: 'normal', fontSize: '11px' }}>Tidak eligible</em>}</strong>
                </div>

                <div style={{ borderTop: '1px dashed var(--studio-border)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--auth-accent)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Komisi Booking Hari Ini
                  </span>
                  
                  {commissions.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {commissions.map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: 'var(--studio-text-main)' }}>• {entry.title || entry.ruleName} ({entry.bookingCode})</span>
                          <strong style={{ color: 'var(--studio-text-strong)' }}>{formatCurrency(entry.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--studio-text-muted)', fontStyle: 'italic' }}>
                      Tidak ada komisi booking di hari ini.
                    </p>
                  )}
                  {/* Komisi dihitung berdasarkan TANGGAL absensi, bukan jam clock-out.
                      Booking yang terjadi setelah clock out tetap dihitung selama
                      booking date sama dengan tanggal absensi ini. */}
                  <p style={{ margin: '8px 0 0', fontSize: '10px', color: 'var(--studio-text-muted)', lineHeight: '1.5' }}>
                    ℹ️ Komisi dihitung berdasarkan tanggal, bukan jam clock-out.
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--studio-border)', paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '14px', color: 'var(--studio-text-strong)' }}>Total Pendapatan</strong>
                  <strong style={{ fontSize: '16px', color: 'var(--auth-success)', fontWeight: '800' }}>
                    {formatCurrency(totalEarnings)}
                  </strong>
                </div>
              </div>

              <footer className="settings-permission-actions" style={{ padding: '12px 16px' }}>
                <button className="settings-mini-button is-primary" type="button" onClick={() => setSelectedSessionForBreakdown(null)} style={{ width: '100%' }}>
                  Tutup
                </button>
              </footer>
            </div>
          </div>
        );
      })() : null}
    </main>
  );
}

