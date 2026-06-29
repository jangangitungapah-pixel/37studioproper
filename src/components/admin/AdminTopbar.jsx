import { useEffect, useState } from 'react';
import { BellRing, LogOut, Clock, Wifi, WifiOff } from 'lucide-react';
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isGuardEligible = user && (
    user.role === 'studio_guard' || 
    (user.role === 'admin' && user.isGuard === true)
  );

  return (
    <header className="admin-topbar">
      <div>
        <p>37 Music Studio</p>
        <h1 id="admin-title">{activeItem.title}</h1>
      </div>

      <div className="admin-topbar-actions">
        {isGuardEligible ? (
          <a
            href="/guard/attendance"
            className="admin-notification-shortcut"
            style={{ color: 'var(--auth-accent)', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <Clock size={16} />
            <span>Portal Guard</span>
          </a>
        ) : null}

        {canOpenNotifications ? (
          <button
            className="admin-notification-shortcut"
            title={notificationBadgeLabel}
            type="button"
            onClick={() => goTo('/admin/notifications')}
          >
            <BellRing size={18} />
            <span>Notifikasi</span>
            <AdminNotificationBadge summary={notificationSummary} variant="shortcut" />
          </button>
        ) : null}

        <span className={`admin-topbar-status-chip ${isOnline ? 'is-online' : 'is-offline'}`} title={isOnline ? 'Database Tersambung' : 'Database Terputus'}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </span>

        <button className="admin-shell-icon-button" type="button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
}
