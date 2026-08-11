import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Settings2,
  UsersRound
} from 'lucide-react';
import { RecaptchaVerifier } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminAuthRepository } from '../services/adminAuthRepository.js';
import AccountRoleDecisionDialog from '../components/auth/AccountRoleDecisionDialog.jsx';
import { ACCOUNT_ROLES, PORTAL_ACCESS } from '../utils/accountRoles.js';
import '../styles/admin-auth.css';
import '../styles/firebase-auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  
  // Tab and Mode States
  const [activeTab, setActiveTab] = useState('email'); // 'email' | 'phone'
  const [authMode, setAuthMode] = useState('signIn'); // 'signIn' | 'signUp'
  
  // Form Inputs
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
  
  // Phone OTP Flow States
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  
  // Refs
  const recaptchaContainerRef = useRef(null);

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const guardIntent =
    searchParams.get('portal') === 'guard' ||
    String(
      redirectTo ||
      '',
    ).startsWith('/guard');
  const guardRedirectTarget =
    guardIntent &&
    String(
      redirectTo ||
      '',
    ).startsWith('/guard')
      ? redirectTo
      : '/guard/attendance';

  // Subscribe to Auth State
  useEffect(() => {
    const unsubscribe = adminAuthRepository.subscribeAdminAuth((authState) => {
      if (authState.isReady && authState.isAuthenticated) {
        const access = authState.user?.access;

        if (guardIntent) {
          navigate(
            guardRedirectTarget,
            {
              replace:
                true,
            },
          );

          return;
        }

        if (
          authState.user?.role ===
          ACCOUNT_ROLES.STUDIO_GUARD
        ) {
          navigate(
            '/guard/attendance',
            {
              replace:
                true,
            },
          );

          return;
        }

        if ([PORTAL_ACCESS.ALLOWED, PORTAL_ACCESS.ADMIN_PENDING].includes(access)) {
          const target = redirectTo ? redirectTo : '/admin/schedule';
          navigate(target, { replace: true });
          return;
        }

        if (access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {
          setRoleDecision({ access, identity: authState.user });
          setError('Akun ini terdaftar sebagai client dan tidak memiliki izin ke Portal Admin.');
          setIsSubmitting(false);
          return;
        }

        if ([PORTAL_ACCESS.ADMIN_BLOCKED, PORTAL_ACCESS.INVALID_ACCOUNT, PORTAL_ACCESS.MISSING_ACCOUNT].includes(access)) {
          setError('Request akses admin untuk akun ini sudah ditolak, tidak aktif, atau data role-nya tidak valid.');
          setIsSubmitting(false);
        }
      }
    });

    return unsubscribe;
  }, [
    guardIntent,
    guardRedirectTarget,
    navigate,
    redirectTo,
  ]);

  // Handle Google Sign-In redirect result
  useEffect(() => {
    let isMounted = true;

    async function checkRedirect() {
      const hadGoogleRedirectPending = adminAuthRepository.hasGoogleRedirectPending?.() || false;

      try {
        const user = await adminAuthRepository.handleRedirectResult();

        if (!isMounted) return;

        if (user) {
          setSuccess('Google login berhasil! Mengarahkan...');
          return;
        }

        if (hadGoogleRedirectPending && !firebaseAuth?.currentUser) {
          setError('Login Google belum selesai. Silakan coba lagi, atau pastikan domain web app sudah masuk Authorized domains Firebase.');
          setIsSubmitting(false);
        }
      } catch (err) {
        if (isMounted) {
          if (
            guardIntent &&
            firebaseAuth?.currentUser
          ) {
            setSuccess(
              'Login berhasil. Membuka Guard Portal...',
            );
          } else {
            setError(
              adminAuthRepository.getAdminAuthErrorMessage(
                err,
              ),
            );
          }

          setIsSubmitting(false);
        }
      }
    }

    checkRedirect();

    return () => {
      isMounted = false;
    };
  }, [guardIntent]);

  // Resend Timer Effect
  useEffect(() => {
    let timerId;
    if (resendTimer > 0) {
      timerId = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timerId);
  }, [resendTimer]);

  // Clean up recaptcha verifier on unmount
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
    let cleaned = num.replace(/\D/g, ''); // remove non-digits
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
      if (
        guardIntent ||
        authMode === 'signIn'
      ) {
        await adminAuthRepository.signInAdmin({ email, password });
        setSuccess(
          guardIntent
            ? 'Masuk berhasil! Membuka Guard Portal...'
            : 'Masuk berhasil! Mengarahkan...',
        );
      } else {
        if (password !== confirmPassword) {
          setError('Konfirmasi kata sandi tidak sesuai.');
          setIsSubmitting(false);
          return;
        }
        await adminAuthRepository.signUpAdmin({ email, password });
        setSuccess('Pendaftaran berhasil! Akun Anda telah dibuat.');
      }
    } catch (err) {
      if (
        guardIntent &&
        firebaseAuth?.currentUser
      ) {
        setSuccess(
          'Masuk berhasil! Membuka Guard Portal...',
        );
      } else {
        if (err?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {
          setRoleDecision({ access: err.access, identity: err.identity });
        }

        setError(
          adminAuthRepository.getAdminAuthErrorMessage(
            err,
          ),
        );
      }
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
      // Initialize invisible Recaptcha if it doesn't exist
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          firebaseAuth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              // Recaptcha resolved
            },
            'expired-callback': () => {
              setError('Verifikasi reCAPTCHA kedaluwarsa. Harap coba lagi.');
            }
          }
        );
      }

      const result = await adminAuthRepository.sendPhoneOTP(formatted, window.recaptchaVerifier);
      setVerificationResult(result);
      setIsOtpSent(true);
      setResendTimer(60); // 60 seconds cooldown
      setSuccess('Kode OTP telah dikirim ke nomor HP Anda.');
    } catch (err) {
      setError(adminAuthRepository.getAdminAuthErrorMessage(err));
      // Reset recaptcha verifier on failure so it can re-initialize
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch {
          // Browser storage / verifier cleanup can fail in restricted contexts.
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

      if (!guardIntent) {
        await adminAuthRepository.ensureCurrentAdminAccess();
      }

      setSuccess(
        guardIntent
          ? 'Verifikasi berhasil! Membuka Guard Portal...'
          : 'Verifikasi berhasil! Mengarahkan...',
      );
    } catch (err) {
      if (err?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {
        setRoleDecision({ access: err.access, identity: err.identity });
      }
      setError(adminAuthRepository.getAdminAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const googleUser = await adminAuthRepository.signInWithGoogle();

      if (googleUser) {
        setSuccess('Google login berhasil! Mengarahkan...');
        setIsSubmitting(false);
      }
      // Redirect fallback will leave this page, so do not reset submitting there.
    } catch (err) {
      if (
        guardIntent &&
        firebaseAuth?.currentUser
      ) {
        setSuccess(
          'Login Google berhasil! Membuka Guard Portal...',
        );
      } else {
        if (err?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {
          setRoleDecision({ access: err.access, identity: err.identity });
        }

        setError(
          adminAuthRepository.getAdminAuthErrorMessage(
            err,
          ),
        );
      }

      setIsSubmitting(false);
    }
  }

  function toggleAuthMode() {
    setAuthMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
    setError('');
    setSuccess('');
  }

  async function cancelWrongPortalLogin() {
    setIsSubmitting(true);
    try {
      await adminAuthRepository.signOutAdmin();
      setRoleDecision(null);
      setError('Login admin dibatalkan. Akun client tetap tidak diubah.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="theme-container auth-page admin-login-page"
      data-auth-surface="login"
      data-admin-login-layout="spatial-gateway"
    >
      <div
        className="admin-login-ambient is-primary"
        aria-hidden="true"
      />
      <div
        className="admin-login-ambient is-secondary"
        aria-hidden="true"
      />

      <section
        className="admin-login-shell"
        aria-label={guardIntent ? 'Guard Portal access gateway' : 'Admin Portal access gateway'}
      >
        <aside className="admin-login-visual">
          <div className="admin-login-brand">
            <div className="admin-login-brand-mark" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div className="admin-login-brand-copy">
              <strong>37 Studio</strong>
              <span>Spatial Operations OS</span>
            </div>
          </div>

          <div className="admin-login-hero-copy">
            <div className="admin-login-kicker">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>
                {guardIntent
                  ? 'Guard Access Gateway'
                  : 'Admin Access Gateway'}
              </span>
            </div>

            <h2>
              {guardIntent
                ? 'Akses operasional penjaga yang tetap terhubung ke satu identitas akun.'
                : 'Satu pintu masuk untuk seluruh operasi studio.'}
            </h2>

            <p>
              {guardIntent
                ? 'Masuk melalui autentikasi bersama. Hak akses Guard tetap ditentukan oleh role dan identity yang diberikan Owner.'
                : 'Kelola jadwal, customer, keuangan, dan operasional harian dari command workspace yang sama.'}
            </p>
          </div>

          {!guardIntent ? (
            <div
              className="admin-login-capability-grid"
              aria-label="Admin workspace capabilities"
            >
              <div className="admin-login-capability">
                <span className="admin-login-capability-icon">
                  <CalendarDays size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>Schedule</strong>
                  <small>Booking & calendar</small>
                </div>
              </div>

              <div className="admin-login-capability">
                <span className="admin-login-capability-icon">
                  <UsersRound size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>Customers</strong>
                  <small>CRM & history</small>
                </div>
              </div>

              <div className="admin-login-capability">
                <span className="admin-login-capability-icon">
                  <BarChart3 size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>Finance</strong>
                  <small>Billing & ledger</small>
                </div>
              </div>

              <div className="admin-login-capability">
                <span className="admin-login-capability-icon">
                  <Settings2 size={16} aria-hidden="true" />
                </span>
                <div>
                  <strong>Operations</strong>
                  <small>Access & workflow</small>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-login-guard-note">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Role tetap authoritative</strong>
                <span>
                  Halaman login tidak membuat role Guard baru dan tidak menaikkan permission akun.
                </span>
              </div>
            </div>
          )}

          <div className="admin-login-trust-row">
            <span className="admin-login-status-dot" aria-hidden="true" />
            <div>
              <strong>Role-based secure workspace</strong>
              <span>Firebase session · portal-aware access</span>
            </div>
          </div>
        </aside>

        <section
          className="auth-card admin-login-form-panel"
          aria-labelledby="login-title"
        >
          <header className="auth-copy admin-login-form-head">
            <div className="admin-login-mobile-brand" aria-hidden="true">
              <span className="admin-login-mobile-brand-mark">
                <Sparkles size={14} />
              </span>
              <strong>37 Studio</strong>
            </div>

            <div className="admin-login-section-label">
              {guardIntent
                ? 'Guard Portal'
                : 'Admin Portal'}
            </div>

            <h1 id="login-title">
              {guardIntent
                ? 'Masuk ke workspace penjaga'
                : authMode === 'signIn'
                  ? 'Selamat datang kembali'
                  : 'Buat akses admin'}
            </h1>

            <p>
              {guardIntent
                ? 'Gunakan akun yang sudah diberikan Owner untuk membuka Guard Portal.'
                : authMode === 'signIn'
                  ? 'Masuk untuk melanjutkan ke command center operasional studio.'
                  : 'Daftarkan akun admin baru. Akses tetap mengikuti proses approval yang berlaku.'}
            </p>
          </header>

          <div
            className="auth-tabs admin-login-method-tabs"
            role="tablist"
            aria-label="Metode login"
          >
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'email' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('email');
                setError('');
                setSuccess('');
              }}
              role="tab"
              aria-selected={activeTab === 'email'}
            >
              <Mail size={14} />
              <span>Email</span>
            </button>

            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'phone' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('phone');
                setError('');
                setSuccess('');
              }}
              role="tab"
              aria-selected={activeTab === 'phone'}
            >
              <Phone size={14} />
              <span>WhatsApp / SMS</span>
            </button>
          </div>

          {error ? (
            <div className="auth-alert admin-login-alert" role="alert">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div
              className="auth-alert is-success admin-login-alert"
              role="status"
            >
              <ShieldCheck size={15} className="shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          ) : null}

          <div
            id="recaptcha-container"
            ref={recaptchaContainerRef}
          />

          {activeTab === 'email' && (
            <form
              className="auth-form admin-login-form"
              onSubmit={handleEmailAuth}
              noValidate
            >
              <label className="auth-field">
                <span>
                  {guardIntent
                    ? 'Email Akun'
                    : 'Email Admin'}
                </span>
                <div className="auth-input-wrap">
                  <Mail size={15} aria-hidden="true" />
                  <input
                    type="email"
                    className="auth-native-input"
                    placeholder="admin@37musicstudio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Password</span>
                <div className="auth-input-wrap">
                  <LockKeyhole size={15} aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="auth-native-input"
                    placeholder="Password akun"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete={authMode === 'signIn' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    className="auth-icon-button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>

              {!guardIntent && authMode === 'signUp' && (
                <label className="auth-field">
                  <span>Konfirmasi Password</span>
                  <div className="auth-input-wrap">
                    <LockKeyhole size={15} aria-hidden="true" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="auth-native-input"
                      placeholder="Ketik ulang password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-icon-button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              )}

              <button
                className="auth-submit admin-login-primary-action"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <LoaderCircle className="auth-spin" size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
                <span>
                  {isSubmitting
                    ? 'Memeriksa...'
                    : guardIntent
                      ? 'Masuk Guard Portal'
                      : authMode === 'signIn'
                        ? 'Masuk Admin'
                        : 'Daftar Admin'}
                </span>
              </button>

              {!guardIntent ? (
                <div className="auth-mode-toggle admin-login-mode-toggle">
                  <span>
                    {authMode === 'signIn'
                      ? 'Belum punya akun admin?'
                      : 'Sudah punya akun admin?'}
                  </span>
                  <button
                    type="button"
                    className="auth-mode-link"
                    onClick={toggleAuthMode}
                    disabled={isSubmitting}
                  >
                    {authMode === 'signIn' ? 'Daftar sekarang' : 'Masuk portal'}
                  </button>
                </div>
              ) : null}
            </form>
          )}

          {activeTab === 'phone' && (
            <div className="auth-form admin-login-form">
              {!isOtpSent ? (
                <form
                  onSubmit={handleSendOTP}
                  className="auth-form"
                  noValidate
                >
                  <label className="auth-field">
                    <span>Nomor HP (WhatsApp / SMS)</span>
                    <div className="auth-input-wrap">
                      <Phone size={15} aria-hidden="true" />
                      <input
                        type="tel"
                        className="auth-native-input"
                        placeholder="Contoh: 081234567890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isSubmitting}
                        autoComplete="tel"
                        required
                      />
                    </div>
                  </label>

                  <p className="admin-login-field-hint">
                    Kode verifikasi akan dikirim ke nomor yang terhubung dengan akun.
                  </p>

                  <button
                    className="auth-submit admin-login-primary-action"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="auth-spin" size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                    <span>
                      {isSubmitting ? 'Mengirim...' : 'Kirim Kode OTP'}
                    </span>
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleVerifyOTP}
                  className="auth-form"
                  noValidate
                >
                  <div className="admin-login-otp-heading">
                    <span className="admin-login-otp-icon">
                      <KeyRound size={16} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>Verifikasi nomor HP</strong>
                      <span>Masukkan 6 digit kode yang baru dikirim.</span>
                    </div>
                  </div>

                  <label className="auth-field">
                    <span>Kode Verifikasi (OTP)</span>
                    <div className="auth-input-wrap">
                      <KeyRound size={15} aria-hidden="true" />
                      <input
                        type="text"
                        className="auth-native-input"
                        placeholder="Masukkan 6 digit kode OTP"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </label>

                  <div className="auth-resend-container">
                    <span>Tidak menerima kode?</span>
                    <button
                      type="button"
                      className="auth-resend-btn"
                      onClick={handleSendOTP}
                      disabled={resendTimer > 0 || isSubmitting}
                    >
                      {resendTimer > 0
                        ? `Kirim ulang (${resendTimer}s)`
                        : 'Kirim Ulang'}
                    </button>
                  </div>

                  <button
                    className="auth-submit admin-login-primary-action"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="auth-spin" size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                    <span>
                      {isSubmitting ? 'Memverifikasi...' : 'Verifikasi OTP'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="auth-mode-link admin-login-secondary-link"
                    onClick={() => {
                      setIsOtpSent(false);
                      setVerificationCode('');
                      setError('');
                      setSuccess('');
                    }}
                    disabled={isSubmitting}
                  >
                    Ubah nomor handphone
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="auth-divider admin-login-divider">
            <span>atau lanjutkan dengan</span>
          </div>

          <button
            type="button"
            className="auth-google-btn admin-login-google"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg
              className="auth-google-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Masuk dengan Google</span>
          </button>

          <footer className="admin-login-form-footer">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>
              Session aman · akses ditentukan berdasarkan role akun
            </span>
          </footer>
        </section>
      </section>
      <AccountRoleDecisionDialog
        badge="Role client terdeteksi"
        title={roleDecision ? 'Akun ini bukan akun admin' : ''}
        message="Email atau nomor ini sudah terdaftar sebagai client. Satu akun hanya dapat memiliki satu role, sehingga akses admin tidak diberikan."
        detail={roleDecision?.identity?.email || roleDecision?.identity?.phoneNumber || ''}
        isBusy={isSubmitting}
        actions={[
          {
            key: 'open-client',
            label: 'Lanjut ke Portal Client',
            onClick: () => navigate('/client/portal', { replace: true }),
          },
          {
            key: 'cancel-admin-login',
            label: 'Batalkan Login Admin',
            icon: 'close',
            onClick: cancelWrongPortalLogin,
          },
        ]}
      />
    </main>
  );
}

