import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, BellRing, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase.js';
import { syncNotificationSubscription } from '../../services/notificationSubscriptionRepository.js';
import {
  getBrowserNotificationPermission,
  getOneSignalState,
  initOneSignal,
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

function normalizeWidgetPermission(permission) {
  if (permission === true) return 'granted';
  if (permission === false) return 'default';

  return permission || getBrowserNotificationPermission();
}

function buildSnapshotKey(user, role, state) {
  return [
    user?.uid || '',
    role,
    normalizeWidgetPermission(state?.permission),
    state?.optedIn ? '1' : '0',
    state?.oneSignalId || '',
    state?.subscriptionId || '',
  ].join('|');
}

export default function OneSignalPermissionWidget() {
  const location = useLocation();
  const lastSyncKeyRef = useRef('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isDismissed, setIsDismissed] = useState(getInitialDismissed);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState(() => getBrowserNotificationPermission());
  const [statusText, setStatusText] = useState('');

  const role = useMemo(() => getRoleFromPath(location.pathname), [location.pathname]);
  const isVisibleRoute = shouldShowOnRoute(location.pathname);
  const isConfigured = isOneSignalConfigured();

  const syncSubscriptionSnapshot = useCallback(
    async (reason = 'snapshot') => {
      if (!isVisibleRoute || !isConfigured || !currentUser?.uid) return null;

      const state = await getOneSignalState();
      const nextPermission = normalizeWidgetPermission(state.permission);
      const normalizedState = {
        ...state,
        permission: nextPermission,
      };

      setPermission(nextPermission);

      const nextKey = buildSnapshotKey(currentUser, role, normalizedState);

      if (nextKey !== lastSyncKeyRef.current) {
        lastSyncKeyRef.current = nextKey;

        await syncNotificationSubscription({
          reason,
          role,
          state: normalizedState,
          user: currentUser,
        });
      }

      return normalizedState;
    },
    [currentUser, isConfigured, isVisibleRoute, role],
  );

  useEffect(() => {
    if (!firebaseAuth) return undefined;

    return onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
      lastSyncKeyRef.current = '';
    });
  }, []);

  useEffect(() => {
    if (!isVisibleRoute || !isConfigured) return undefined;

    let isMounted = true;

    initOneSignal()
      .then((state) => {
        if (!isMounted) return;

        setPermission(normalizeWidgetPermission(state.permission));

        if (currentUser?.uid) {
          syncSubscriptionSnapshot('init').catch((error) => {
            console.warn('[onesignal] Subscription registry sync failed:', error);
          });
        }
      })
      .catch((error) => {
        console.warn('[onesignal] Init failed:', error);
        if (isMounted) setStatusText('Notifikasi belum siap di browser ini.');
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, isConfigured, isVisibleRoute, syncSubscriptionSnapshot]);

  useEffect(() => {
    if (!isVisibleRoute || !isConfigured || !currentUser?.uid) return undefined;

    // Fast early polling (5s) for the first 60s, then slower interval (30s)
    const EARLY_INTERVAL_MS = 5000;
    const STEADY_INTERVAL_MS = 30000;
    const EARLY_PHASE_DURATION_MS = 60000;

    const earlyIntervalId = window.setInterval(() => {
      syncSubscriptionSnapshot('poll-early').catch((error) => {
        console.warn('[onesignal] Subscription registry early poll failed:', error);
      });
    }, EARLY_INTERVAL_MS);

    let steadyIntervalId = 0;
    const earlyPhaseEndId = window.setTimeout(() => {
      window.clearInterval(earlyIntervalId);
      steadyIntervalId = window.setInterval(() => {
        syncSubscriptionSnapshot('poll-steady').catch((error) => {
          console.warn('[onesignal] Subscription registry steady poll failed:', error);
        });
      }, STEADY_INTERVAL_MS);
    }, EARLY_PHASE_DURATION_MS);

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      syncSubscriptionSnapshot('visible').catch((error) => {
        console.warn('[onesignal] Subscription registry visibility sync failed:', error);
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // OneSignal v16 event-driven sync: subscribe to permission and push subscription changes
    function onPermissionChange() {
      syncSubscriptionSnapshot('permission-change').catch((error) => {
        console.warn('[onesignal] Subscription registry permission-change sync failed:', error);
      });
    }

    function onPushSubscriptionChange() {
      syncSubscriptionSnapshot('subscription-change').catch((error) => {
        console.warn('[onesignal] Subscription registry push-change sync failed:', error);
      });
    }

    let removeOneSignalListeners = () => {};
    try {
      const os = window.OneSignal;
      if (os?.Notifications?.addEventListener) {
        os.Notifications.addEventListener('permissionChange', onPermissionChange);
        const prevRemove = removeOneSignalListeners;
        removeOneSignalListeners = () => {
          prevRemove();
          os.Notifications.removeEventListener('permissionChange', onPermissionChange);
        };
      }
      if (os?.User?.PushSubscription?.addEventListener) {
        os.User.PushSubscription.addEventListener('change', onPushSubscriptionChange);
        const prevRemove = removeOneSignalListeners;
        removeOneSignalListeners = () => {
          prevRemove();
          os.User.PushSubscription.removeEventListener('change', onPushSubscriptionChange);
        };
      }
    } catch (listenerError) {
      console.warn('[onesignal] Could not attach subscription change listeners:', listenerError);
    }

    const readySyncId = window.setTimeout(() => {
      syncSubscriptionSnapshot('ready').catch((error) => {
        console.warn('[onesignal] Subscription registry ready sync failed:', error);
      });
    }, 0);

    return () => {
      window.clearInterval(earlyIntervalId);
      window.clearInterval(steadyIntervalId);
      window.clearTimeout(earlyPhaseEndId);
      window.clearTimeout(readySyncId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      removeOneSignalListeners();
    };
  }, [currentUser?.uid, isConfigured, isVisibleRoute, syncSubscriptionSnapshot]);

  if (!isVisibleRoute || isDismissed) return null;

  if (isConfigured && ONE_SIGNAL_NATIVE_NOTIFY_BUTTON) return null;

  const normalizedPermission = normalizeWidgetPermission(permission);
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
      const nextPermission = normalizeWidgetPermission(state.permission);

      setPermission(nextPermission);

      if (currentUser?.uid) {
        await syncNotificationSubscription({
          reason: 'manual-permission',
          role,
          state: {
            ...state,
            permission: nextPermission,
          },
          user: currentUser,
        });
      }

      if (nextPermission === 'granted') {
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
