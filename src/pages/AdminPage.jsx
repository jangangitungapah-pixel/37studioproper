
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Music2,
  PanelLeftClose,
  Settings,
  UsersRound,
} from 'lucide-react';
import { clearAdminSession, getAdminSession, isAdminAuthenticated } from '../auth/adminAuth.js';
import '../styles/admin-auth.css';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Booking', icon: CalendarDays, active: false },
  { label: 'Customer', icon: UsersRound, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const session = getAdminSession();

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

  function handleLogout() {
    clearAdminSession();
    navigate('/login', { replace: true });
  }

  return (
    <main className="theme-container admin-shell" data-auth-surface="admin">
      <aside className="admin-sidebar" aria-label="Navigasi admin desktop">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo" aria-hidden="true">
            <Music2 size={24} />
          </div>
          <div>
            <strong>37 Music</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Menu admin">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={item.active ? 'page' : undefined}
                className={item.active ? 'admin-nav-item is-active' : 'admin-nav-item'}
                disabled={!item.active}
                key={item.label}
                type="button"
              >
                <Icon size={19} />
                <span>{item.label}</span>
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
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <section className="admin-stage" aria-labelledby="admin-title">
        <header className="admin-topbar">
          <div>
            <p>Admin Shell</p>
            <h1 id="admin-title">Dashboard</h1>
          </div>
          <button className="admin-topbar-action" type="button" aria-label="Sidebar tersedia di desktop">
            <PanelLeftClose size={18} />
          </button>
        </header>

        <div className="admin-empty-canvas">
          <div className="admin-empty-panel">
            <span className="admin-empty-orb" aria-hidden="true" />
            <h2>Wadah admin sudah siap.</h2>
            <p>Konten sengaja masih kosong supaya halaman berikutnya bisa masuk tanpa bongkar cangkang.</p>
          </div>
        </div>
      </section>

      <nav className="admin-bottom-nav" aria-label="Navigasi admin mobile">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-current={item.active ? 'page' : undefined}
              className={item.active ? 'admin-bottom-item is-active' : 'admin-bottom-item'}
              disabled={!item.active}
              key={item.label}
              type="button"
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button className="admin-bottom-item" type="button" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </nav>
    </main>
  );
}
