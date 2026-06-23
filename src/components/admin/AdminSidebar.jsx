import { Music2, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import AdminNotificationBadge from './AdminNotificationBadge.jsx';

export default function AdminSidebar({
  isSidebarCollapsed,
  toggleSidebar,
  permittedNavItems,
  activeItem,
  goTo,
  notificationSummary,
  notificationBadgeLabel,
  user,
  onLogout,
}) {
  return (
    <aside className="admin-sidebar" aria-label="Navigasi admin desktop">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo" aria-hidden="true">
          <Music2 size={24} />
        </div>

        <div className="admin-sidebar-copy">
          <strong>37 Music</strong>
          <span>Admin Portal</span>
        </div>

        <button
          aria-label={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          className="admin-sidebar-collapse"
          title={isSidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          type="button"
          onClick={toggleSidebar}
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Menu admin">
        {permittedNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem.key === item.key;

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'admin-nav-item is-active' : 'admin-nav-item'}
              key={item.key}
              title={item.key === 'notifications' ? notificationBadgeLabel : item.label}
              type="button"
              onClick={() => goTo(item.path)}
            >
              <Icon size={19} />
              <span className="admin-nav-label">{item.label}</span>
              {item.key === 'notifications' ? (
                <AdminNotificationBadge summary={notificationSummary} />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-mini-session">
          <span>Login sebagai</span>
          <strong>{user?.displayName || user?.email || 'admin'}</strong>
        </div>

        <button className="admin-logout-button" type="button" onClick={onLogout}>
          <LogOut size={18} />
          <span className="admin-logout-label">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
