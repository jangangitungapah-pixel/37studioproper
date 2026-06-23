import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
} from 'lucide-react';
import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  STUDIO_GUARD_ROLE,
  closeGuardAttendanceSession,
  createGuardAttendanceCheckIn,
  subscribeGuardAttendanceSessions,
} from '../../services/guardAttendanceRepository.js';
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
  const navigate = useNavigate();
  const settings = useOperatorFeeSettings();
  const isAuthAvailable = isFirebaseConfigured && Boolean(firebaseAuth);

  const [authUser, setAuthUser] = useState(null);
  const [guardAccount, setGuardAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedGuardPersonId, setSelectedGuardPersonId] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

        if (account?.role !== STUDIO_GUARD_ROLE || account?.status !== 'approved') {
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
    if (!authUser?.uid || guardAccount?.role !== STUDIO_GUARD_ROLE || guardAccount?.status !== 'approved') {
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
  }, [authUser?.uid, guardAccount?.role, guardAccount?.status]);

  const currentSession = useMemo(
    () => sessions.find(isActiveLikeSession) || null,
    [sessions]
  );
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

  const canUseGuardPage = authUser &&
    guardAccount?.role === STUDIO_GUARD_ROLE &&
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
            <strong>Absen Penjaga</strong>
            <small>Absensi harian untuk validasi fee dan uang makan.</small>
          </div>

          <div className="guard-shift-hero-actions">
            <span className="guard-shift-date-chip">
              <Clock3 size={14} />
              {todayLabel}
            </span>

            {canUseGuardPage ? (
              <button className="guard-shift-ghost-button" type="button" disabled={isBusy} onClick={() => navigate('/admin')}>
                <ShieldCheck size={15} />
                Admin Portal
              </button>
            ) : null}

            {authUser ? (
              <button className="guard-shift-ghost-button" type="button" disabled={isBusy} onClick={handleLogout}>
                <LogOut size={15} />
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
              <span aria-hidden="true">
                <LogIn size={18} />
              </span>
              <div>
                <strong>Login Penjaga</strong>
                <small>Masuk dengan akun yang sudah dibuat owner.</small>
              </div>
            </div>

            <form className="guard-shift-login" onSubmit={handleSignIn}>
              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button className="guard-shift-main-button" type="submit" disabled={isBusy}>
                {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <LogIn size={16} />}
                Masuk
              </button>
            </form>
          </section>
        ) : null}

        {isReady && authUser && !canUseGuardPage ? (
          <section className="guard-shift-card is-locked">
            <ShieldCheck size={26} />
            <strong>Akses belum aktif</strong>
            <p>Akun ini belum punya role Penjaga Studio approved.</p>
          </section>
        ) : null}

        {canUseGuardPage ? (
          <section className="guard-shift-workspace" aria-label="Panel absen penjaga">
            <section className="guard-shift-status">
              <span className={currentSession ? 'is-on' : ''} aria-hidden="true">
                <Clock3 size={18} />
              </span>
              <div className="guard-shift-status-copy">
                <small>Status hari ini</small>
                <strong>{getStatusLabel(currentSession)}</strong>
                <em className={'is-' + getApprovalTone(currentSession?.approvalStatus)}>
                  {currentSession ? getApprovalLabel(currentSession.approvalStatus) : 'Siap absen'}
                </em>
              </div>
              <div className="guard-shift-status-facts" aria-label="Ringkasan shift">
                <article>
                  <small>Profil</small>
                  <strong>{selectedGuardPerson.name}</strong>
                </article>
                <article>
                  <small>Uang makan</small>
                  <strong>{formatCurrency(mealAmount)}</strong>
                </article>
              </div>
            </section>

            <section className="guard-shift-card is-action">
              <div className="guard-shift-title">
                <span aria-hidden="true">
                  <Clock3 size={18} />
                </span>
                <div>
                  <strong>{currentSession ? 'Shift aktif' : 'Mulai jaga'}</strong>
                  <small>Approval berlaku per tanggal, bukan batas jam booking.</small>
                </div>
              </div>

              {!currentSession ? (
                <div className="guard-shift-form">
                  <label>
                    <span>Profil penjaga</span>
                    <select
                      value={effectiveGuardPersonId}
                      onChange={(event) => setSelectedGuardPersonId(event.target.value)}
                    >
                      {visibleGuardOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Catatan</span>
                    <textarea
                      placeholder="Opsional, contoh: shift sore."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>

                  <button
                    className="guard-shift-main-button"
                    type="button"
                    disabled={isBusy || !effectiveGuardPersonId}
                    onClick={handleCheckIn}
                  >
                    {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Mulai Jaga
                  </button>
                </div>
              ) : (
                <div className="guard-shift-current">
                  <article>
                    <small>Penjaga</small>
                    <strong>{currentSession.guardName}</strong>
                  </article>
                  <article>
                    <small>Mulai</small>
                    <strong>{formatDateTime(currentSession.clockInAt)}</strong>
                  </article>
                  <article>
                    <small>Approval</small>
                    <strong>{getApprovalLabel(currentSession.approvalStatus)}</strong>
                  </article>

                  <button className="guard-shift-main-button is-danger" type="button" disabled={isBusy} onClick={handleCheckOut}>
                    {isBusy ? <LoaderCircle className="auth-spin" size={16} /> : <XCircle size={16} />}
                    Selesai Jaga
                  </button>
                </div>
              )}
            </section>

            <section className="guard-shift-card is-history">
              <div className="guard-shift-title">
                <span aria-hidden="true">
                  <UserRound size={18} />
                </span>
                <div>
                  <strong>Riwayat</strong>
                  <small>Absen terbaru dari akun ini.</small>
                </div>
              </div>

              <div className="guard-shift-history">
                {recentSessions.length ? recentSessions.map((session) => (
                  <article key={session.id}>
                    <div>
                      <strong>{formatDate(session.date)}</strong>
                      <span>
                        {formatDateTime(session.clockInAt)}
                        {session.clockOutAt ? ' - ' + formatDateTime(session.clockOutAt) : ' - Belum selesai'}
                      </span>
                    </div>
                    <em className={'is-' + getApprovalTone(session.approvalStatus)}>
                      {getApprovalLabel(session.approvalStatus)}
                    </em>
                  </article>
                )) : (
                  <p>Belum ada riwayat absen.</p>
                )}
              </div>
            </section>
          </section>
        ) : null}

        {(notice || error) ? (
          <aside className="guard-shift-feedback">
            {notice ? (
              <p className="is-success">
                <CheckCircle2 size={15} />
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="is-error">
                <AlertCircle size={15} />
                {error}
              </p>
            ) : null}
          </aside>
        ) : null}
      </section>
    </main>
  );
}
