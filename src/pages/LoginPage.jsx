import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  KeyRound
} from 'lucide-react';
import { RecaptchaVerifier } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase.js';
import { adminAuthRepository } from '../services/adminAuthRepository.js';
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
  
  // Phone OTP Flow States
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  
  // Refs
  const recaptchaContainerRef = useRef(null);

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  // Subscribe to Auth State
  useEffect(() => {
    const unsubscribe = adminAuthRepository.subscribeAdminAuth((authState) => {
      if (authState.isReady && authState.isAuthenticated) {
        const target = redirectTo ? redirectTo : '/admin/schedule';
        navigate(target, { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate, redirectTo]);

  // Handle Google Sign-In redirect result
  useEffect(() => {
    let isMounted = true;
    async function checkRedirect() {
      try {
        const user = await adminAuthRepository.handleRedirectResult();
        if (user && isMounted) {
          setSuccess('Google login berhasil! Mengarahkan...');
        }
      } catch (err) {
        if (isMounted) {
          setError(adminAuthRepository.getAdminAuthErrorMessage(err));
        }
      }
    }
    checkRedirect();
    return () => {
      isMounted = false;
    };
  }, []);

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
      if (authMode === 'signIn') {
        await adminAuthRepository.signInAdmin({ email, password });
        setSuccess('Masuk berhasil! Mengarahkan...');
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
      setError(adminAuthRepository.getAdminAuthErrorMessage(err));
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
      setSuccess('Verifikasi berhasil! Mengarahkan...');
    } catch (err) {
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
      await adminAuthRepository.signInWithGoogle();
      // Page is redirecting, do not set isSubmitting to false
    } catch (err) {
      setError(adminAuthRepository.getAdminAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  function toggleAuthMode() {
    setAuthMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
    setError('');
    setSuccess('');
  }

  return (
    <main className="theme-container auth-page" data-auth-surface="login">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-copy">
          <div className="flex items-center gap-2 justify-center w-fit mx-auto mb-1 px-3 py-1 rounded-full border border-[var(--auth-border)] bg-[var(--auth-bg-soft)] text-xs font-semibold uppercase tracking-[0.15em] text-[var(--auth-accent)]">
            <Sparkles size={13} className="text-[var(--auth-accent)]" />
            <span>Studio OS Console</span>
          </div>
          <h1 id="login-title" className="text-center">37 Music</h1>
          <p className="text-center">Masuk ke portal kontrol studio.</p>
        </div>

        {/* Tab Selection */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'email' ? 'is-active' : ''}`}
            onClick={() => {
              setActiveTab('email');
              setError('');
              setSuccess('');
            }}
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
          >
            <Phone size={14} />
            <span>WhatsApp / SMS</span>
          </button>
        </div>

        {/* Status Alerts */}
        {error ? (
          <div className="auth-alert" role="alert">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="auth-alert" style={{ color: '#2ecc71', borderColor: 'rgba(46, 204, 113, 0.3)', backgroundColor: 'rgba(46, 204, 113, 0.09)' }} role="status">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        ) : null}

        {/* Invisible Recaptcha target */}
        <div id="recaptcha-container" ref={recaptchaContainerRef}></div>

        {/* Email Form */}
        {activeTab === 'email' && (
          <form className="auth-form" onSubmit={handleEmailAuth} noValidate>
            <label className="auth-field">
              <span>Email Admin</span>
              <div className="auth-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  type="email"
                  className="auth-native-input"
                  placeholder="admin@37musicstudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-native-input"
                  placeholder="Password akun"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="auth-icon-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {authMode === 'signUp' && (
              <label className="auth-field">
                <span>Konfirmasi Password</span>
                <div className="auth-input-wrap">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="auth-native-input"
                    placeholder="Ketik ulang password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="auth-icon-button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            )}

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="auth-spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              <span>
                {isSubmitting
                  ? 'Memeriksa...'
                  : authMode === 'signIn'
                  ? 'Masuk Admin'
                  : 'Daftar Admin'}
              </span>
            </button>

            <div className="auth-mode-toggle">
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
          </form>
        )}

        {/* Phone Form */}
        {activeTab === 'phone' && (
          <div className="auth-form">
            {!isOtpSent ? (
              <form onSubmit={handleSendOTP} className="auth-form" noValidate>
                <label className="auth-field">
                  <span>Nomor HP (WhatsApp / SMS)</span>
                  <div className="auth-input-wrap">
                    <Phone size={18} aria-hidden="true" />
                    <input
                      type="tel"
                      className="auth-native-input"
                      placeholder="Contoh: 081234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </label>

                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="auth-spin" size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim Kode OTP'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="auth-form" noValidate>
                <label className="auth-field">
                  <span>Kode Verifikasi (OTP)</span>
                  <div className="auth-input-wrap">
                    <KeyRound size={18} aria-hidden="true" />
                    <input
                      type="text"
                      className="auth-native-input"
                      placeholder="Masukkan 6 digit kode OTP"
                      maxLength={6}
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
                    {resendTimer > 0 ? `Kirim ulang (${resendTimer}s)` : 'Kirim Ulang'}
                  </button>
                </div>

                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="auth-spin" size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  <span>{isSubmitting ? 'Memverifikasi...' : 'Verifikasi OTP'}</span>
                </button>

                <button
                  type="button"
                  className="auth-mode-link text-center block w-full mt-2"
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

        <div className="auth-divider">atau</div>

        {/* Google Sign-In */}
        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <svg className="auth-google-icon" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          <span>Masuk dengan Google</span>
        </button>
      </section>
    </main>
  );
}
