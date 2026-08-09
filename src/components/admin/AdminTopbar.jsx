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

import {
  motion,
} from 'motion/react';

import StudioTooltip from '../ui/StudioTooltip.jsx';

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

  const notificationLabel =
    notificationBadgeLabel ||
    'Buka notifikasi';

  return (
    <header
      className="admin-topbar"
      data-admin-shell-ui="ui-0b-desktop"
      data-admin-spatial-header="ui-0c"
    >
      <motion.div
        animate={{
          opacity:
            1,

          y:
            0,
        }}
        className="admin-topbar-heading"
        initial={{
          opacity:
            0,

          y:
            4,
        }}
        key={
          activeItem.key
        }
        transition={{
          duration:
            0.16,

          ease:
            [
              0.16,
              1,
              0.3,
              1,
            ],
        }}
      >
        <div
          aria-label="Lokasi halaman admin"
          className="admin-topbar-context"
        >
          <span
            aria-hidden="true"
            className="admin-command-context-mark"
          />

          <span className="admin-topbar-context-studio">
            Admin
          </span>

          <ChevronRight
            aria-hidden="true"
            size={10}
            strokeWidth={1.8}
          />

          <strong>
            {contextLabel}
          </strong>
        </div>

        <h1 id="admin-title">
          {activeItem.title}
        </h1>
      </motion.div>

      <div className="admin-topbar-actions">
        {isGuardEligible ? (
          <StudioTooltip
            content="Buka Portal Guard"
            side="bottom"
            sideOffset={10}
          >
            <a
              aria-label="Buka Portal Guard"
              className="admin-command-utility admin-topbar-guard-shortcut"
              href="/guard/attendance"
            >
              <Clock
                aria-hidden="true"
                size={15}
                strokeWidth={1.9}
              />

              <span className="admin-command-utility-label">
                Guard
              </span>
            </a>
          </StudioTooltip>
        ) : null}

        {canOpenNotifications ? (
          <StudioTooltip
            content={
              notificationLabel
            }
            side="bottom"
            sideOffset={10}
          >
            <button
              aria-label={
                notificationLabel
              }
              className="admin-command-icon admin-notification-shortcut"
              type="button"
              onClick={() =>
                goTo(
                  '/admin/notifications',
                )
              }
            >
              <BellRing
                aria-hidden="true"
                size={17}
                strokeWidth={1.9}
              />

              <span className="admin-command-visually-hidden">
                Notifikasi
              </span>

              <AdminNotificationBadge
                summary={
                  notificationSummary
                }
                variant="shortcut"
              />
            </button>
          </StudioTooltip>
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
          <span
            aria-hidden="true"
            className="admin-connectivity-dot"
          />

          {isOnline ? (
            <Wifi
              aria-hidden="true"
              className="admin-connectivity-icon"
              size={12}
              strokeWidth={2}
            />
          ) : (
            <WifiOff
              aria-hidden="true"
              className="admin-connectivity-icon"
              size={12}
              strokeWidth={2}
            />
          )}

          <span className="admin-connectivity-label">
            {isOnline
              ? 'Online'
              : 'Offline'}
          </span>
        </span>

        {/*
         * Keep logout in markup for the current mobile shell.
         * UI-0C hides this duplicate action on desktop because
         * desktop logout already lives in the navigation rail.
         * Mobile ownership is redesigned later in UI-0D.
         */}
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
            aria-hidden="true"
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
