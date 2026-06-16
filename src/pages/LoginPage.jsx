
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  isAdminAuthenticated,
  isAdminCredentialConfigured,
  loginAdmin,
} from '../auth/adminAuth.js';
import '../styles/admin-auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const credentialReady = useMemo(() => isAdminCredentialConfigured(), []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate('/admin/schedule', { replace: true });
    }
  }, [navigate]);

  function collapseNativeInputSelection(event) {
    const input = event.currentTarget;

    window.requestAnimationFrame(() => {
      if (
        input &&
        input.value &&
        input.selectionStart === 0 &&
        input.selectionEnd === input.value.length &&
        typeof input.setSelectionRange === 'function'
      ) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 350));

    const result = loginAdmin({ username, password });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(
        result.reason === 'CONFIG_MISSING'
          ? 'Credential lokal belum terbaca. Restart dev server setelah .env.local dibuat.'
          : 'Username atau password tidak sesuai.'
      );
      return;
    }

    navigate('/admin/schedule', { replace: true });
  }

  return (
    <main className="theme-container auth-page" data-auth-surface="login">
      <section className="auth-card" aria-labelledby="login-title">
<div className="auth-copy">
<h1 id="login-title">37 Music Studio</h1>
          <p>Masuk ke portal admin studio.</p>
        </div>

        {!credentialReady ? (
          <div className="auth-alert" role="alert">
            <AlertTriangle size={18} />
            <span>Credential lokal belum ada. Jalankan script ini lalu restart server dev.</span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>Username</span>
            <div className="auth-input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                autoComplete="off"
                className="auth-native-input"
                data-1p-ignore="true"
                data-form-type="other"
                data-lpignore="true"
                inputMode="text"
                name="admin-login-username"
                spellCheck={false}
                placeholder="Username admin"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onFocus={collapseNativeInputSelection}
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                autoComplete="new-password"
                className="auth-native-input"
                data-1p-ignore="true"
                data-form-type="other"
                data-lpignore="true"
                name="admin-login-password"
                spellCheck={false}
                placeholder="Password admin"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={collapseNativeInputSelection}
                required
              />
              <button
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="auth-icon-button"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting || !credentialReady}>
            {isSubmitting ? <LoaderCircle className="auth-spin" size={18} /> : <ShieldCheck size={18} />}
            <span>{isSubmitting ? 'Memeriksa...' : 'Masuk Admin'}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
