import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  LogOut,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { clearAdminSession, getAdminSession, isAdminAuthenticated } from '../auth/adminAuth.js';
import SchedulePage from './admin/SchedulePage.jsx';
import SettingsPage from './admin/SettingsPage.jsx';
import '../styles/admin-auth.css';

const SIDEBAR_STORAGE_KEY = '37musicstudio.admin.sidebar.v1';

const navItems = [
  {
    key: 'schedule',
    label: 'Schedule',
    path: '/admin/schedule',
    icon: CalendarDays,
    title: 'Schedule',
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    icon: Settings,
    title: 'Settings',
  },
];

function getInitialSidebarState() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function renderAdminContent(activeKey) {
  if (activeKey === 'settings') return <SettingsPage />;

  return <SchedulePage />;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAdminSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);

  const routeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')),
    [location.pathname]
  );

  const activeItem = routeItem || navItems[0];

  useEffect(() => {
    function guard() {
      if (!isAdminAuthenticated()) {
        navigate('/login', { replace: true });
      }
    }

    guard();
    window.addEventListener('storage', guard);
    window.addEventListener('admin-auth-change', guard);

    return () => {
      window.removeEventListener('storage', guard);
      window.removeEventListener('admin-auth-change', guard);
    };
  }, [navigate]);

  useEffect(() => {
    if (!isAdminAuthenticated()) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem) {
      navigate('/admin/schedule', { replace: true });
    }
  }, [location.pathname, navigate, routeItem]);

  function handleLogout() {
    clearAdminSession();
    navigate('/login', { replace: true });
  }

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        // Storage can fail in private browser modes. The UI state still works for this session.
      }

      return next;
    });
  }

  function goTo(path) {
    navigate(path);
  }

  const shellClassName = [
    'theme-container',
    'admin-shell',
    isSidebarCollapsed ? 'is-sidebar-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <main className={shellClassName} data-auth-surface="admin">
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
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem.key === item.key;

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={isActive ? 'admin-nav-item is-active' : 'admin-nav-item'}
                key={item.key}
                title={item.label}
                type="button"
                onClick={() => goTo(item.path)}
              >
                <Icon size={19} />
                <span className="admin-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-mini-session">
            <span>Login sebagai</span>
            <strong>{session?.username || 'admin'}</strong>
          </div>

          <button className="admin-logout-button" type="button" onClick={handleLogout}>
            <LogOut size={18} />
            <span className="admin-logout-label">Keluar</span>
          </button>
        </div>
      </aside>

      <section className="admin-stage" aria-labelledby="admin-title">
        <header className="admin-topbar">
          <div>
            <p>Admin Shell</p>
            <h1 id="admin-title">{activeItem.title}</h1>
          </div>

          <button className="admin-shell-icon-button" type="button" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </header>

        {renderAdminContent(activeItem.key)}
      </section>

      <nav className="admin-bottom-nav" aria-label="Navigasi admin mobile">
        {navItems.map((item) => {
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
            </button>
          );
        })}
      </nav>
    </main>
  );
}
