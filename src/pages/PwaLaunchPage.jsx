import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase.js';
import { getAccountIdentity } from '../services/accountRoleRepository.js';
import { ACCOUNT_ROLES, ACCOUNT_STATUSES } from '../utils/accountRoles.js';
import '../styles/admin-auth.css';

function getLaunchPath(identity) {
  if (!identity) return '/client';

  const role = identity.role;
  const status = identity.status;

  if (role === ACCOUNT_ROLES.OWNER || (role === ACCOUNT_ROLES.ADMIN && status === ACCOUNT_STATUSES.APPROVED)) {
    return '/admin/dashboard';
  }

  if (role === ACCOUNT_ROLES.ADMIN) {
    return '/admin';
  }

  if (role === ACCOUNT_ROLES.CLIENT && status === ACCOUNT_STATUSES.ACTIVE) {
    return '/client/portal';
  }

  return '/client';
}

export default function PwaLaunchPage() {
  const [launchPath, setLaunchPath] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      const fallbackFrameId = window.requestAnimationFrame(() => {
        setLaunchPath('/client');
      });

      return () => {
        window.cancelAnimationFrame(fallbackFrameId);
      };
    }

    let isMounted = true;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        setLaunchPath('/client');
        return;
      }

      try {
        const identity = await getAccountIdentity(user);

        if (!isMounted) return;

        setLaunchPath(getLaunchPath(identity));
      } catch (error) {
        console.error('[pwa-launch] Gagal menentukan portal akun:', error);

        if (isMounted) {
          setLaunchPath('/client');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (launchPath) {
    return <Navigate to={launchPath} replace />;
  }

  return (
    <main className="theme-container auth-page" data-auth-surface="pwa-launch">
      <section className="auth-card" aria-labelledby="pwa-launch-title" style={{ textAlign: 'center' }}>
        <div className="auth-copy">
          <p className="auth-eyebrow">37 Music Studio</p>
          <h1 id="pwa-launch-title">Membuka Portal...</h1>
          <p>Sedang mengarahkan akun ke portal yang sesuai.</p>
        </div>
      </section>
    </main>
  );
}
