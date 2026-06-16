import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CalendarDays,
  LogOut,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  LoaderCircle,
} from 'lucide-react';
import { adminAuthRepository } from '../services/adminAuthRepository.js';
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

function renderAdminContent(activeKey, currentUser) {
  if (activeKey === 'settings') return <SettingsPage currentUser={currentUser} />;

  return <SchedulePage />;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState({ isReady: false, isAuthenticated: false, user: null });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);

  useEffect(() => {
    return adminAuthRepository.subscribeAdminAuth(setAuthState);
  }, []);

  const routeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')),
    [location.pathname]
  );

  const activeItem = routeItem || navItems[0];

  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem) {
      navigate('/admin/schedule', { replace: true });
    }
  }, [location.pathname, navigate, routeItem, authState.isReady, authState.isAuthenticated]);

  async function handleLogout() {
    await adminAuthRepository.signOutAdmin();
    navigate('/login', { replace: true });
  }

  if (!authState.isReady) {
    return (
      <div className="theme-container auth-page" style={{ display: 'grid', placeItems: 'center' }}>
        <LoaderCircle className="auth-spin" size={36} style={{ color: 'var(--auth-accent)' }} />
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!authState.user?.isApproved) {
    return (
      <main className="theme-container auth-page" data-auth-surface="pending">
        <section className="auth-card" style={{ textAlign: 'center' }} aria-labelledby="pending-title">
          <div className="auth-copy">
            <div className="flex items-center gap-2 justify-center w-fit mx-auto mb-3 px-3 py-1 rounded-full border border-[var(--auth-border)] bg-[var(--auth-bg-soft)] text-xs font-semibold uppercase tracking-[0.15em] text-[var(--auth-accent)]">
              <LoaderCircle size={14} className="auth-spin" />
              <span>Akses Tertunda</span>
            </div>
            <h1 id="pending-title" style={{ fontSize: '1.9rem', marginBottom: '12px' }}>Menunggu Persetujuan</h1>
            <p style={{ fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '20px' }}>
              Akun Anda <strong>{authState.user?.email || authState.user?.phoneNumber || 'admin'}</strong> berhasil dibuat tetapi belum aktif.
            </p>
            <div className="auth-alert" style={{ textAlign: 'left', fontSize: '0.82rem', marginBottom: '24px' }}>
              <span>
                Harap hubungi pemilik studio di <strong>marsicprod@gmail.com</strong> untuk memberikan persetujuan akses bagi akun Anda. Halaman ini akan diperbarui secara otomatis setelah disetujui.
              </span>
            </div>
          </div>
          <button 
            className="auth-google-btn" 
            type="button" 
            onClick={handleLogout}
            style={{ marginTop: '0', width: '100%', borderColor: 'var(--auth-danger)', color: 'var(--auth-danger)' }}
          >
            <span>Keluar Akun</span>
          </button>
        </section>
      </main>
    );
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
            <strong>{authState.user?.displayName || authState.user?.email || 'admin'}</strong>
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

        {renderAdminContent(activeItem.key, authState.user)}
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
