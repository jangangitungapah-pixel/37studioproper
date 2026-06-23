import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldAlert,
  UserRound,
  XCircle,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
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

function getApprovalLabel(status) {
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED) return 'Disetujui';
  if (status === GUARD_ATTENDANCE_APPROVAL_STATUSES.REJECTED) return 'Ditolak';

  return 'Menunggu Owner';
}

function getStatusLabel(session) {
  if (!session) return 'Belum Absen';
  if (session.status === GUARD_ATTENDANCE_STATUSES.CLOSED) return 'Selesai Jaga';
  if (session.status === GUARD_ATTENDANCE_STATUSES.ACTIVE) return 'Sedang Jaga';
  if (session.status === GUARD_ATTENDANCE_STATUSES.REJECTED) return 'Ditolak';
  if (session.status === GUARD_ATTENDANCE_STATUSES.VOID) return 'Void';

  return 'Menunggu Approval';
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
      description: person.defaultPaymentMethod || 'cash',
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
  const [isReady, setIsReady] = useState(!isAuthAvailable);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(isAuthAvailable ? '' : 'Firebase belum dikonfigurasi.');

  const guardOptions = useMemo(() => getGuardPeople(settings), [settings]);

  useEffect(() => {
    if (!isAuthAvailable) {
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user || null);
      setSessions([]);
      setError('');
      setMessage('');

      if (!user) {
        setGuardAccount(null);
        setIsReady(true);
        return;
      }

      try {
        const account = await readGuardAccount(user);
        setGuardAccount(account);

        if (account?.role !== STUDIO_GUARD_ROLE || account?.status !== 'approved') {
          setError('Akun ini belum terdaftar sebagai Penjaga Studio aktif.');
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

    const unsubscribe = subscribeGuardAttendanceSessions(
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

    return unsubscribe;
  }, [authUser?.uid, guardAccount?.role, guardAccount?.status]);

  const currentSession = useMemo(
    () => sessions.find(isActiveLikeSession) || null,
    [sessions]
  );

  const effectiveGuardPersonId = selectedGuardPersonId || guardOptions[0]?.key || authUser?.uid || '';

  const selectedGuardPerson = useMemo(() => {
    const person = settings.people.find((item) => item.id === effectiveGuardPersonId);

    if (person) return person;

    return {
      id: authUser?.uid || '',
      name: guardAccount?.displayName || authUser?.displayName || authUser?.email || 'Penjaga Studio',
      defaultPaymentMethod: 'cash',
    };
  }, [authUser, effectiveGuardPersonId, guardAccount, settings.people]);

  async function handleSignIn(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError('Isi email dan password penjaga.');
      return;
    }

    setIsBusy(true);
    setError('');
    setMessage('');

    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setMessage('Login berhasil. Membaca status penjaga...');
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
    setMessage('');

    try {
      await signOut(firebaseAuth);
      setEmail('');
      setPassword('');
      setGuardAccount(null);
      setSessions([]);
      setMessage('Logout berhasil.');
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
    setMessage('');

    try {
      await createGuardAttendanceCheckIn({
        guardPerson: selectedGuardPerson,
        mealAmount: settings.options.mealPerPersonPerDay,
        note,
        user: authUser,
      });

      setNote('');
      setMessage('Absen masuk dikirim. Tunggu approval owner.');
    } catch (checkInError) {
      console.error('[guard-attendance] Absen masuk gagal:', checkInError);
      setError('Absen masuk gagal. Pastikan akun punya role Penjaga Studio.');
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
    setMessage('');

    try {
      await closeGuardAttendanceSession(currentSession, authUser);
      setMessage('Selesai jaga tersimpan.');
    } catch (checkOutError) {
      console.error('[guard-attendance] Selesai jaga gagal:', checkOutError);
      setError('Selesai jaga gagal.');
    } finally {
      setIsBusy(false);
    }
  }

  const canUseGuardPage = authUser &&
    guardAccount?.role === STUDIO_GUARD_ROLE &&
    guardAccount?.status === 'approved';

  return (
    <main className="guard-attendance-page">
      <section className="guard-attendance-shell">
        <header className="guard-attendance-head">
          <div>
            <p>37 Studio Guard</p>
            <h1>Absen Penjaga</h1>
            <span>Mulai jaga, tunggu approval owner, lalu tutup shift saat selesai.</span>
          </div>

          {authUser ? (
            <button type="button" onClick={handleLogout} disabled={isBusy}>
              <LogOut size={15} />
              Keluar
            </button>
          ) : null}
        </header>

        {!isReady ? (
          <section className="guard-attendance-card is-center">
            <LoaderCircle className="auth-spin" size={24} />
            <p>Membaca status login...</p>
          </section>
        ) : null}

        {isReady && !authUser ? (
          <section className="guard-attendance-card">
            <div className="guard-attendance-card-head">
              <span aria-hidden="true">
                <LogIn size={18} />
              </span>
              <div>
                <h2>Login Penjaga</h2>
                <p>Gunakan akun yang sudah diberi role Penjaga Studio oleh owner.</p>
              </div>
            </div>

            <form className="guard-attendance-login" onSubmit={handleSignIn}>
              <label>
                <small>Email</small>
                <input
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label>
                <small>Password</small>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <button type="submit" disabled={isBusy}>
                {isBusy ? <LoaderCircle className="auth-spin" size={15} /> : <LogIn size={15} />}
                Masuk
              </button>
            </form>
          </section>
        ) : null}

        {isReady && authUser && !canUseGuardPage ? (
          <section className="guard-attendance-card is-center">
            <ShieldAlert size={30} />
            <h2>Akses Penjaga Belum Aktif</h2>
            <p>Akun ini belum punya role studio_guard approved. Owner perlu mengubah role akun ini dulu.</p>
          </section>
        ) : null}

        {canUseGuardPage ? (
          <>
            <section className="guard-attendance-status-card">
              <div>
                <small>Status Hari Ini</small>
                <strong>{getStatusLabel(currentSession)}</strong>
                <span>{currentSession ? getApprovalLabel(currentSession.approvalStatus) : 'Belum ada sesi aktif'}</span>
              </div>

              <em className={currentSession ? 'is-active' : ''}>
                {currentSession ? formatDateTime(currentSession.clockInAt) : 'Siap absen'}
              </em>
            </section>

            <section className="guard-attendance-card">
              <div className="guard-attendance-card-head">
                <span aria-hidden="true">
                  <Clock3 size={18} />
                </span>
                <div>
                  <h2>{currentSession ? 'Shift Sedang Berjalan' : 'Mulai Jaga'}</h2>
                  <p>
                    Approval owner berlaku untuk tanggal absen. Booking di tanggal yang sama tetap bisa dihitung meski jam absen lebih lambat.
                  </p>
                </div>
              </div>

              {!currentSession ? (
                <div className="guard-attendance-form">
                  <StudioSelect
                    label="Profil Penjaga"
                    options={guardOptions.length ? guardOptions : [{ key: authUser.uid, label: authUser.email || 'Penjaga Studio', description: 'Fallback akun login' }]}
                    selectedKey={effectiveGuardPersonId}
                    onChange={setSelectedGuardPersonId}
                  />

                  <label>
                    <small>Catatan</small>
                    <textarea
                      placeholder="Opsional, contoh: shift sore."
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>

                  <button className="is-primary" type="button" disabled={isBusy} onClick={handleCheckIn}>
                    {isBusy ? <LoaderCircle className="auth-spin" size={15} /> : <CheckCircle2 size={15} />}
                    Mulai Jaga
                  </button>
                </div>
              ) : (
                <div className="guard-attendance-current">
                  <span>
                    <small>Penjaga</small>
                    <strong>{currentSession.guardName}</strong>
                  </span>
                  <span>
                    <small>Approval</small>
                    <strong>{getApprovalLabel(currentSession.approvalStatus)}</strong>
                  </span>
                  <span>
                    <small>Mulai</small>
                    <strong>{formatDateTime(currentSession.clockInAt)}</strong>
                  </span>

                  <button type="button" disabled={isBusy} onClick={handleCheckOut}>
                    {isBusy ? <LoaderCircle className="auth-spin" size={15} /> : <XCircle size={15} />}
                    Selesai Jaga
                  </button>
                </div>
              )}
            </section>

            <section className="guard-attendance-card">
              <div className="guard-attendance-card-head">
                <span aria-hidden="true">
                  <UserRound size={18} />
                </span>
                <div>
                  <h2>Riwayat Absen</h2>
                  <p>Owner akan approve atau reject absen dari panel owner.</p>
                </div>
              </div>

              <div className="guard-attendance-history">
                {sessions.length ? sessions.slice(0, 12).map((session) => (
                  <article key={session.id}>
                    <span>
                      <strong>{formatDate(session.date)}</strong>
                      <small>{formatDateTime(session.clockInAt)} · {session.clockOutAt ? formatDateTime(session.clockOutAt) : 'belum selesai'}</small>
                    </span>
                    <em className={'is-' + session.approvalStatus}>
                      {getApprovalLabel(session.approvalStatus)}
                    </em>
                  </article>
                )) : (
                  <p>Belum ada riwayat absen.</p>
                )}
              </div>
            </section>
          </>
        ) : null}

        {message ? (
          <p className="guard-attendance-message is-success" role="status">{message}</p>
        ) : null}

        {error ? (
          <p className="guard-attendance-message is-error" role="alert">{error}</p>
        ) : null}
      </section>
    </main>
  );
}
