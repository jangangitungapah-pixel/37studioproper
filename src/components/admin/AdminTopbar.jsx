import { BellRing, LogOut } from 'lucide-react';
import AdminNotificationBadge from './AdminNotificationBadge.jsx';

export default function AdminTopbar({
  activeItem,
  canOpenNotifications,
  notificationBadgeLabel,
  goTo,
  notificationSummary,
  onLogout,
}) {
  return (
    <header className="admin-topbar">
      <div>
        <p>37 Music Studio</p>
        <h1 id="admin-title">{activeItem.title}</h1>
      </div>

      <div className="admin-topbar-actions">
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

        <button className="admin-shell-icon-button" type="button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </header>
  );
}
