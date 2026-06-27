import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Volume2
} from 'lucide-react';
import { RecaptchaVerifier, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, browserLocalPersistence, setPersistence, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { getAdminAuthErrorMessage } from '../services/adminAuthRepository.js';
import { syncClientCustomerProfile } from '../services/clientProfileRepository.js';
import { accountRoleRepository } from '../services/accountRoleRepository.js';
import AccountRoleDecisionDialog from '../components/auth/AccountRoleDecisionDialog.jsx';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import '../styles/admin-auth.css';
import '../styles/firebase-auth.css';
import '../styles/client-auth.css';

export default function ClientLoginPage() {
  const navigate = useNavigate();

  // Tab & Auth Mode
  const [activeTab, setActiveTab] = useState('email'); // 'email' | 'phone'
  const [authMode, setAuthMode] = useState('signIn'); // 'signIn' | 'signUp'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleDecision, setRoleDecision] = useState(null);

  // OTP Flow States
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  const recaptchaContainerRef = useRef(null);

  // Resolve the authoritative role before allowing client access.
  useEffect(() => {
    if (!firebaseAuth) return;
    let checkSequence = 0;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      const currentSequence = ++checkSequence;
      if (!user) {
        setRoleDecision(null);
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await accountRoleRepository.resolvePortalAccount(user, 'client');
        if (currentSequence !== checkSequence) return;

        if (result.access === PORTAL_ACCESS.ALLOWED) {
          try {
            await syncClientCustomerProfile(user);
          } catch (profileError) {
            console.error('Role client valid, tetapi profil customer belum tersinkron:', profileError);
          }
          if (currentSequence === checkSequence) {
            navigate('/client/portal', { replace: true });
          }
          return;
        }

        setSuccess('');
        setRoleDecision(result);
        if (result.access === PORTAL_ACCESS.ADMIN_PENDING_CLIENT_CHOICE) {
          setError('Akun ini masih memiliki request admin yang menunggu persetujuan.');
        } else if (result.access === PORTAL_ACCESS.ADMIN_INACTIVE_CLIENT_CHOICE) {
          setError('Request admin akun ini sudah tidak aktif. Pilih apakah akun akan dialihkan menjadi client.');
        } else if (result.access === PORTAL_ACCESS.WRONG_PORTAL_ADMIN) {
          setError('Akun ini memiliki role admin dan tidak dapat digunakan sebagai client.');
        } else {
          setError('Role akun tidak valid untuk Portal Client.');
        }
      } catch (roleError) {
        if (currentSequence === checkSequence) {
          console.error('Gagal memeriksa role akun client:', roleError);
          const code = roleError?.code || '';
          setError(code === 'permission-denied' || code === 'firestore/permission-denied'
            ? 'Akun berhasil login, tetapi data role belum dapat dibuat. Silakan coba lagi setelah beberapa detik.'
            : 'Koneksi saat memeriksa role akun gagal. Silakan coba lagi.');
        }
      } finally {
        if (currentSequence === checkSequence) setIsSubmitting(false);
      }
    });
    return unsubscribe;
  }, [navigate]);

  // Handle Google Redirect Result
  useEffect(() => {
    if (!firebaseAuth) return;
    let isMounted = true;

    async function checkRedirect() {
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
        const credential = await getRedirectResult(firebaseAuth);
        if (credential && isMounted) {
          setSuccess('Login Google berhasil! Mengarahkan...');
        }
      } catch (err) {
        if (isMounted) {
          setError(getAdminAuthErrorMessage(err));
        }
      }
    }

    checkRedirect();
    return () => {
      isMounted = false;
    };
  }, []);

  // OTP Resend Timer
  useEffect(() => {
    let timerId;
    if (resendTimer > 0) {
      timerId = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerId);
  }, [resendTimer]);

  // Recaptcha Cleanup
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (err) {
          console.error('Error clearing RecaptchaVerifier:', err);
        }
      }
    };
  }, []);

  function formatPhoneNumber(num) {
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('62') && cleaned.length > 5) {
      cleaned = '62' + cleaned;
    }
    return '+' + cleaned;
  }

  async function handleEmailAuth(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
      setError('Harap isi semua kolom email dan kata sandi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      if (authMode === 'signIn') {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        setSuccess('Identitas berhasil diverifikasi. Memeriksa role akun...');
      } else {
        if (password !== confirmPassword) {
          setError('Konfirmasi kata sandi tidak sesuai.');
          setIsSubmitting(false);
          return;
        }
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        setSuccess('Pendaftaran berhasil. Menyiapkan role client...');
      }
    } catch (err) {
      setError(getAdminAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendOTP(event) {
    event?.preventDefault();
    setError('');
    setSuccess('');

    const formatted = formatPhoneNumber(phoneNumber);
    if (formatted.length < 10) {
      setError('Format nomor HP belum valid. Contoh: 08123456789');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          firebaseAuth,
          'recaptcha-container',
          {
            size: 'invisible',
            'expired-callback': () => {
              setError('Verifikasi reCAPTCHA kedaluwarsa. Harap coba lagi.');
            }
          }
        );
      }

      await setPersistence(firebaseAuth, browserLocalPersistence);
      const result = await signInWithPhoneNumber(firebaseAuth, formatted, window.recaptchaVerifier);
      setVerificationResult(result);
      setIsOtpSent(true);
      setResendTimer(60);
      setSuccess('Kode OTP telah dikirim via SMS/WhatsApp.');
    } catch (err) {
      setError(getAdminAuthErrorMessage(err));
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch {
          // ignore
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOTP(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!verificationCode || verificationCode.length < 6) {
      setError('Harap masukkan 6 digit kode OTP.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!verificationResult) {
        throw new Error('Hasil verifikasi tidak ditemukan. Kirim ulang OTP.');
      }
      await verificationResult.confirm(verificationCode);
      setSuccess('Verifikasi berhasil. Memeriksa role akun...');
    } catch (err) {
      setError(getAdminAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      try {
        await signInWithPopup(firebaseAuth, provider);
        setSuccess('Google login berhasil. Memeriksa role akun...');
      } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
          await signInWithRedirect(firebaseAuth, provider);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(getAdminAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  async function continueAsClient() {
    if (!firebaseAuth?.currentUser) return;

    setIsSubmitting(true);
    setError('');
    try {
      await accountRoleRepository.cancelAdminRequestAndBecomeClient(firebaseAuth.currentUser);
      await syncClientCustomerProfile(firebaseAuth.currentUser);
      setRoleDecision(null);
      navigate('/client/portal', { replace: true });
    } catch (conversionError) {
      console.error('Gagal mengubah request admin menjadi akun client:', conversionError);
      setError('Request admin tidak dapat dibatalkan. Status akun mungkin sudah berubah; silakan muat ulang.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelClientLogin() {
    setIsSubmitting(true);
    try {
      await signOut(firebaseAuth);
      setRoleDecision(null);
      setSuccess('');
      setError('Login sebagai client dibatalkan. Role akun tidak diubah.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const requiresAdminRequestDecision = [
    PORTAL_ACCESS.ADMIN_PENDING_CLIENT_CHOICE,
    PORTAL_ACCESS.ADMIN_INACTIVE_CLIENT_CHOICE,
  ].includes(roleDecision?.access);

  const roleDecisionActions = requiresAdminRequestDecision
    ? [
        {
          key: 'convert-client',
          label: 'Batalkan Request Admin & Lanjut Client',
          onClick: continueAsClient,
        },
        {
          key: 'cancel-client-login',
          label: 'Batalkan Login Client',
          icon: 'close',
          onClick: cancelClientLogin,
        },
      ]
    : [
        {
          key: 'open-admin',
          label: 'Buka Portal Admin',
          onClick: () => navigate('/admin', { replace: true }),
        },
        {
          key: 'cancel-client-login',
          label: 'Batalkan Login Client',
          icon: 'close',
          onClick: cancelClientLogin,
        },
      ];

  return (
    <main className="client-auth-page theme-container">
      <div className="client-auth-bg-glow is-primary" aria-hidden="true" />
      <div className="client-auth-bg-glow is-secondary" aria-hidden="true" />

      <section className="client-auth-shell" aria-labelledby="client-login-title">
        <header className="client-auth-header">
          <div className="client-auth-brand-pill">
            <Volume2 size={14} aria-hidden="true" />
            <span>37 Studio Client Access</span>
          </div>
          <h1 id="client-login-title" className="client-auth-title">Client Portal</h1>
          <p className="client-auth-subtitle">Masuk untuk mengakses jadwal, booking sesi, dan data musik Anda.</p>
        </header>

        <div className="client-auth-card">
          <div className="client-auth-tabs" role="tablist" aria-label="Metode login client">
            <button
              type="button"
              className={'client-auth-tab ' + (activeTab === 'email' ? 'is-active' : '')}
              onClick={() => {
                setActiveTab('email');
                setError('');
                setSuccess('');
              }}
            >
              <Mail size={15} />
              <span>Email</span>
            </button>
            <button
              type="button"
              className={'client-auth-tab ' + (activeTab === 'phone' ? 'is-active' : '')}
              onClick={() => {
                setActiveTab('phone');
                setError('');
                setSuccess('');
              }}
            >
              <Phone size={15} />
              <span>WhatsApp / SMS</span>
            </button>
          </div>

          {error ? (
            <div className="client-auth-alert is-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="client-auth-alert is-success" role="status">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{success}</span>
            </div>
          ) : null}

          <div id="recaptcha-container" ref={recaptchaContainerRef}></div>

          {activeTab === 'email' && (
            <form onSubmit={handleEmailAuth} className="client-auth-form" noValidate>
              <label className="client-auth-field">
                <span>Email Client</span>
                <div className="client-auth-input-wrap">
                  <Mail className="client-auth-input-icon" size={17} aria-hidden="true" />
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    className="client-auth-input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </label>

              <label className="client-auth-field">
                <span>Password</span>
                <div className="client-auth-input-wrap">
                  <LockKeyhole className="client-auth-input-icon" size={17} aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password Anda"
                    className="client-auth-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="client-auth-icon-button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {authMode === 'signUp' && (
                <label className="client-auth-field">
                  <span>Konfirmasi Password</span>
                  <div className="client-auth-input-wrap">
                    <LockKeyhole className="client-auth-input-icon" size={17} aria-hidden="true" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Ulangi Password"
                      className="client-auth-input"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      className="client-auth-icon-button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              )}

              <button type="submit" disabled={isSubmitting} className="client-auth-submit">
                {isSubmitting ? (
                  <LoaderCircle className="client-auth-spin" size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
                <span>{isSubmitting ? 'Memproses...' : authMode === 'signIn' ? 'Masuk Portal' : 'Daftar Portal'}</span>
              </button>

              <div className="client-auth-mode-toggle">
                <span>{authMode === 'signIn' ? 'Belum terdaftar?' : 'Sudah punya akun?'}</span>
                <button
                  type="button"
                  className="client-auth-mode-link"
                  onClick={() => {
                    setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
                    setError('');
                    setSuccess('');
                  }}
                  disabled={isSubmitting}
                >
                  {authMode === 'signIn' ? 'Buat Akun' : 'Masuk Saja'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'phone' && (
            <div className="client-auth-form">
              {!isOtpSent ? (
                <form onSubmit={handleSendOTP} className="client-auth-form" noValidate>
                  <label className="client-auth-field">
                    <span>Nomor HP (WhatsApp)</span>
                    <div className="client-auth-input-wrap">
                      <Phone className="client-auth-input-icon" size={17} aria-hidden="true" />
                      <input
                        type="tel"
                        placeholder="Contoh: 08123456789"
                        className="client-auth-input"
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </label>

                  <button type="submit" disabled={isSubmitting} className="client-auth-submit">
                    {isSubmitting ? (
                      <LoaderCircle className="client-auth-spin" size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    <span>{isSubmitting ? 'Mengirim...' : 'Kirim OTP ke WhatsApp'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="client-auth-form" noValidate>
                  <label className="client-auth-field">
                    <span>Kode OTP</span>
                    <div className="client-auth-input-wrap">
                      <KeyRound className="client-auth-input-icon" size={17} aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="6 Digit OTP"
                        maxLength={6}
                        className="client-auth-input is-centered"
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </label>

                  <div className="client-auth-resend-row">
                    <span>Belum menerima kode?</span>
                    <button
                      type="button"
                      className="client-auth-mode-link"
                      onClick={handleSendOTP}
                      disabled={resendTimer > 0 || isSubmitting}
                    >
                      {resendTimer > 0 ? 'Kirim Ulang (' + resendTimer + 's)' : 'Kirim Ulang'}
                    </button>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="client-auth-submit">
                    {isSubmitting ? (
                      <LoaderCircle className="client-auth-spin" size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    <span>{isSubmitting ? 'Memverifikasi...' : 'Verifikasi OTP'}</span>
                  </button>

                  <button
                    type="button"
                    className="client-auth-text-button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setVerificationCode('');
                      setError('');
                      setSuccess('');
                    }}
                    disabled={isSubmitting}
                  >
                    Ganti Nomor Handphone
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="client-auth-divider">
            <span>atau</span>
          </div>

          <button
            type="button"
            className="client-auth-google-button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" className="client-auth-google-icon" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Masuk dengan Google</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="client-auth-back-link"
        >
          Masuk sebagai Admin Portal
        </button>
      </section>

      <AccountRoleDecisionDialog
        badge={requiresAdminRequestDecision ? 'Request admin terdeteksi' : 'Role admin terdeteksi'}
        title={roleDecision ? (requiresAdminRequestDecision ? 'Tentukan role akun ini' : 'Akun ini bukan akun client') : ''}
        message={requiresAdminRequestDecision
          ? 'Akun ini sedang atau pernah didaftarkan sebagai admin. Untuk mencegah dua role, request admin harus dibatalkan sebelum akun dapat digunakan sebagai client.'
          : 'Akun ini sudah memiliki akses admin. Satu akun tidak dapat digunakan sekaligus sebagai admin dan client.'}
        detail={roleDecision?.identity?.email || roleDecision?.identity?.phoneNumber || ''}
        actions={roleDecisionActions}
        isBusy={isSubmitting}
      />
    </main>
  );
}
