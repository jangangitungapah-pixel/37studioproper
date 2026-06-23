import { MoreHorizontal } from 'lucide-react';
import AdminNotificationBadge from './AdminNotificationBadge.jsx';

export default function AdminBottomNav({
  mobilePrimaryNavItems,
  activeItem,
  goTo,
  notificationSummary,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
  mobileMoreNavItems,
  shouldShowMoreNotificationBadge,
  notificationBadgeLabel,
  isMoreNavActive,
}) {
  return (
    <nav className="admin-bottom-nav" aria-label="Navigasi admin mobile">
      {mobilePrimaryNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem.key === item.key;

        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'admin-bottom-item is-active' : 'admin-bottom-item'}
            key={item.key}
            type="button"
            onClick={() => goTo(item.path)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
            {item.key === 'notifications' ? (
              <AdminNotificationBadge summary={notificationSummary} variant="bottom" />
            ) : null}
          </button>
        );
      })}

      <div className={isMoreMenuOpen ? 'admin-bottom-more is-open' : 'admin-bottom-more'}>
        {isMoreMenuOpen ? (
          <div className="admin-bottom-more-menu" role="menu" aria-label="Menu admin tambahan">
            {mobileMoreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem.key === item.key;

              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'admin-more-item is-active' : 'admin-more-item'}
                  key={item.key}
                  role="menuitem"
                  type="button"
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.key === 'notifications' ? (
                    <AdminNotificationBadge summary={notificationSummary} variant="more" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          aria-expanded={isMoreMenuOpen}
          aria-haspopup="menu"
          className={isMoreNavActive ? 'admin-bottom-item is-active' : 'admin-bottom-item'}
          title={shouldShowMoreNotificationBadge ? notificationBadgeLabel : 'More'}
          type="button"
          onClick={() => setIsMoreMenuOpen((current) => !current)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
          {shouldShowMoreNotificationBadge ? (
            <AdminNotificationBadge summary={notificationSummary} variant="bottom" />
          ) : null}
        </button>
      </div>
    </nav>
  );
}
