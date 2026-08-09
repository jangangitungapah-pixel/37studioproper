import {
  useEffect,
  useState,
} from 'react';

import {
  BellRing,
  ChevronRight,
  Clock,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';

import AdminNotificationBadge from './AdminNotificationBadge.jsx';

export default function AdminTopbar({
  activeItem,
  canOpenNotifications,
  notificationBadgeLabel,
  goTo,
  notificationSummary,
  onLogout,
  user,
}) {
  const [
    isOnline,
    setIsOnline,
  ] =
    useState(
      typeof navigator !==
        'undefined'
        ? navigator.onLine
        : true,
    );

  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return undefined;
    }

    function handleOnline() {
      setIsOnline(
        true,
      );
    }

    function handleOffline() {
      setIsOnline(
        false,
      );
    }

    window.addEventListener(
      'online',
      handleOnline,
    );

    window.addEventListener(
      'offline',
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      );

      window.removeEventListener(
        'offline',
        handleOffline,
      );
    };
  }, []);

  const isGuardEligible =
    Boolean(
      user &&
      (
        user.role ===
          'studio_guard' ||
        (
          user.role ===
            'admin' &&
          user.isGuard ===
            true
        )
      ),
    );

  const contextLabel =
    activeItem.groupLabel ||
    (
      activeItem.key ===
        'settings' ||
      activeItem.key ===
        'notifications'
        ? 'System'
        : activeItem.key ===
            'dashboard'
          ? 'Overview'
          : 'Admin'
    );

  return (
    <header
      className="admin-topbar"
      data-admin-shell-ui="ui-0b-desktop"
    >
      <div className="admin-topbar-heading">
        <div
          aria-label="Lokasi halaman admin"
          className="admin-topbar-context"
        >
          <span className="admin-topbar-context-studio">
            Admin
          </span>

          <ChevronRight
            aria-hidden="true"
            size={11}
          />

          <strong>
            {contextLabel}
          </strong>
        </div>

        <h1 id="admin-title">
          {activeItem.title}
        </h1>
      </div>

      <div className="admin-topbar-actions">
        {isGuardEligible ? (
          <a
            className="admin-notification-shortcut admin-topbar-guard-shortcut"
            href="/guard/attendance"
            title="Buka Portal Guard"
          >
            <Clock
              size={16}
            />

            <span>
              Portal Guard
            </span>
          </a>
        ) : null}

        {canOpenNotifications ? (
          <button
            aria-label={
              notificationBadgeLabel ||
              'Buka notifikasi'
            }
            className="admin-notification-shortcut"
            title={
              notificationBadgeLabel ||
              'Buka notifikasi'
            }
            type="button"
            onClick={() =>
              goTo(
                '/admin/notifications',
              )
            }
          >
            <BellRing
              size={17}
            />

            <span>
              Notifikasi
            </span>

            <AdminNotificationBadge
              summary={
                notificationSummary
              }
              variant="shortcut"
            />
          </button>
        ) : null}

        <span
          aria-live="polite"
          className={
            'admin-topbar-status-chip ' +
            (
              isOnline
                ? 'is-online'
                : 'is-offline'
            )
          }
          title={
            isOnline
              ? 'Database tersambung'
              : 'Database terputus'
          }
        >
          {isOnline ? (
            <Wifi
              size={12}
            />
          ) : (
            <WifiOff
              size={12}
            />
          )}

          <span>
            {isOnline
              ? 'Online'
              : 'Offline'}
          </span>
        </span>

        <button
          aria-label="Keluar dari Admin Portal"
          className="admin-shell-icon-button admin-topbar-logout"
          title="Keluar"
          type="button"
          onClick={
            onLogout
          }
        >
          <LogOut
            size={16}
          />

          <span>
            Keluar
          </span>
        </button>
      </div>
    </header>
  );
}
