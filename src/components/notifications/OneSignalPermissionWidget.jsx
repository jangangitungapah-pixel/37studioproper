import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, BellRing, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase.js';
import {
  getBrowserNotificationPermission,  initOneSignal,
  isOneSignalConfigured,
  ONE_SIGNAL_NATIVE_NOTIFY_BUTTON,
  requestOneSignalPushPermission,
} from '../../services/oneSignalService.js';
import '../../styles/onesignal-permission.css';

function getInitialDismissed() {
  if (typeof window === 'undefined') return false;

  return window.sessionStorage.getItem('studio37-hide-onesignal-widget') === '1';
}

function getRoleFromPath(pathname) {
  return pathname.startsWith('/admin') ? 'admin' : 'client';
}

function shouldShowOnRoute(pathname) {
  return pathname.startsWith('/admin') || pathname.startsWith('/client');
}

export default function OneSignalPermissionWidget() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [isDismissed, setIsDismissed] = useState(getInitialDismissed);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState(() => getBrowserNotificationPermission());
  const [statusText, setStatusText] = useState('');

  const role = useMemo(() => getRoleFromPath(location.pathname), [location.pathname]);
  const isVisibleRoute = shouldShowOnRoute(location.pathname);
  const isConfigured = isOneSignalConfigured();

  useEffect(() => {
    if (!firebaseAuth) return undefined;

    return onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (!isVisibleRoute || !isConfigured) return undefined;

    let isMounted = true;

    initOneSignal()
      .then((state) => {
        if (!isMounted) return;

        setPermission(state.permission || getBrowserNotificationPermission());
      })
      .catch((error) => {
        console.warn('[onesignal] Init failed:', error);
        if (isMounted) setStatusText('Notifikasi belum siap di browser ini.');
      });

    return () => {
      isMounted = false;
    };
  }, [isConfigured, isVisibleRoute]);

  if (!isVisibleRoute || isDismissed) return null;

  if (isConfigured && ONE_SIGNAL_NATIVE_NOTIFY_BUTTON) return null;

  const normalizedPermission = permission === true ? 'granted' : permission;
  const isGranted = normalizedPermission === 'granted';
  const isDenied = normalizedPermission === 'denied';

  if (isConfigured && isGranted) return null;

  function dismissWidget() {
    setIsDismissed(true);
    window.sessionStorage.setItem('studio37-hide-onesignal-widget', '1');
  }

  async function handleEnableNotifications() {
    if (!isConfigured) {
      setStatusText('Isi VITE_ONESIGNAL_APP_ID di .env.local, lalu build dan deploy ulang.');
      return;
    }

    if (isLoading || isDenied) return;

    setIsLoading(true);
    setStatusText('');

    try {
      const state = await requestOneSignalPushPermission(currentUser, role);
      const nextPermission = state.permission || getBrowserNotificationPermission();

      setPermission(nextPermission);

      if (nextPermission === true || nextPermission === 'granted') {
        setStatusText('Notifikasi berhasil diaktifkan.');
        window.setTimeout(dismissWidget, 1800);
      } else if (nextPermission === 'denied') {
        setStatusText('Browser memblokir notifikasi. Ubah izin dari site settings.');
      } else {
        setStatusText('Notifikasi belum diaktifkan.');
      }
    } catch (error) {
      console.error('[onesignal] Permission request failed:', error);
      setStatusText(error?.message || 'Gagal mengaktifkan notifikasi.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <aside className="onesignal-permission-widget" role="status" aria-live="polite">
      <button
        aria-label="Tutup panel notifikasi"
        className="onesignal-permission-close"
        type="button"
        onClick={dismissWidget}
      >
        <X size={14} />
      </button>

      <span className="onesignal-permission-icon">
        {isDenied ? <Bell size={18} /> : <BellRing size={18} />}
      </span>

      <div className="onesignal-permission-copy">
        <strong>{!isConfigured ? 'OneSignal belum dikonfigurasi' : isDenied ? 'Notifikasi diblokir' : 'Aktifkan notifikasi'}</strong>
        <small>
          {!isConfigured
            ? 'Widget aktif, tapi App ID belum masuk ke build production.'
            : isDenied
              ? 'Buka pengaturan browser untuk mengizinkan notifikasi 37 Music Studio.'
              : role === 'admin'
                ? 'Dapatkan update booking, bukti bayar, dan pesan client.'
                : 'Dapatkan update booking, tagihan, dan pesan admin.'}
        </small>
        {statusText ? <em>{statusText}</em> : null}
      </div>

      <button
        className="onesignal-permission-action"
        disabled={isLoading || isDenied}
        type="button"
        onClick={handleEnableNotifications}
      >
        {!isConfigured ? 'Cek Env' : isLoading ? 'Memproses...' : isDenied ? 'Diblokir' : 'Aktifkan'}
      </button>
    </aside>
  );
}
