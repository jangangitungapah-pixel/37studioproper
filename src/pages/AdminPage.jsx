import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CalendarDays,
  CreditCard,
  UsersRound,
  LogOut,
  Music2,
  MoreHorizontal,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  LoaderCircle,
  ShieldCheck,
  AlertCircle,
  BookOpen,
  Home,
} from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebase.js';
import { adminAuthRepository } from '../services/adminAuthRepository.js';
import SchedulePage from './admin/SchedulePage.jsx';
import CustomerPage from './admin/CustomerPage.jsx';
import BillingPage from './admin/BillingPage.jsx';
import BookkeepingPage from './admin/BookkeepingPage.jsx';
import InventoryPage from './admin/InventoryPage.jsx';
import SettingsPage from './admin/SettingsPage.jsx';
import DashboardPage from './admin/DashboardPage.jsx';

import '../styles/admin-auth.css';

const SIDEBAR_STORAGE_KEY = '37musicstudio.admin.sidebar.v1';

const mobilePrimaryNavKeys = ['dashboard', 'schedule', 'billing'];

const navItems = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: Home,
    title: 'Dashboard',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    path: '/admin/schedule',
    icon: CalendarDays,
    title: 'Schedule',
  },
  {
    key: 'customers',
    label: 'Customer',
    path: '/admin/customers',
    icon: UsersRound,
    title: 'Customer',
  },
  {
    key: 'billing',
    label: 'Billing',
    path: '/admin/billing',
    icon: CreditCard,
    title: 'Billing / POS',
  },
  {
    key: 'bookkeeping',
    label: 'Pembukuan',
    path: '/admin/bookkeeping',
    icon: BookOpen,
    title: 'Pembukuan',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    path: '/admin/inventory',
    icon: PackageOpen,
    title: 'Inventory',
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
  if (activeKey === 'dashboard') return <DashboardPage />;
  if (activeKey === 'settings') return <SettingsPage currentUser={currentUser} />;
  if (activeKey === 'customers') return <CustomerPage />;
  if (activeKey === 'billing') return <BillingPage />;
  if (activeKey === 'bookkeeping') return <BookkeepingPage />;
  if (activeKey === 'inventory') return <InventoryPage />;

  return <SchedulePage />;
}

function AutoApproveView({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [targetUser, setTargetUser] = useState(null);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const targetUid = queryParams.get('uid');

  useEffect(() => {
    if (!targetUid) {
      const missingUidFrameId = window.requestAnimationFrame(() => {
        setStatus('error');
        setErrorMsg('Tautan persetujuan tidak lengkap (UID tidak ditemukan).');
      });

      return () => {
        window.cancelAnimationFrame(missingUidFrameId);
      };
    }

    if (currentUser?.email?.toLowerCase() !== 'marsicprod@gmail.com') {
      const ownerGuardFrameId = window.requestAnimationFrame(() => {
        setStatus('error');
        setErrorMsg('Hanya pemilik studio (marsicprod@gmail.com) yang diizinkan untuk menyetujui akun baru.');
      });

      return () => {
        window.cancelAnimationFrame(ownerGuardFrameId);
      };
    }

    async function approveUser() {
      try {
        const userRef = doc(firestoreDb, 'users', targetUid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setStatus('error');
          setErrorMsg('Akun user yang ingin disetujui tidak ditemukan di database.');
          return;
        }

        const data = userSnap.data();
        setTargetUser(data);

        if (data.status === 'approved') {
          setStatus('success');
          return;
        }

        await updateDoc(userRef, {
          status: 'approved',
          updatedAt: new Date().toISOString()
        });

        setStatus('success');
      } catch (err) {
        console.error('Failed to approve user:', err);
        setStatus('error');
        setErrorMsg('Gagal menyetujui user di Firestore. Periksa koneksi atau database.');
      }
    }

    approveUser();
  }, [targetUid, currentUser]);

  return (
    <main className="theme-container auth-page" data-auth-surface="approve">
      <section className="auth-card" style={{ textAlign: 'center' }} aria-labelledby="approve-title">
        {status === 'loading' && (
          <div className="auth-copy" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <LoaderCircle size={36} className="auth-spin mb-4" style={{ color: 'var(--auth-accent)' }} />
            <h1 id="approve-title" style={{ fontSize: '1.7rem', marginBottom: '12px' }}>Memproses Persetujuan...</h1>
            <p style={{ fontSize: '0.88rem', opacity: 0.8 }}>Sistem sedang memverifikasi dan menyetujui akun baru.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-copy" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="flex items-center gap-2 justify-center w-fit mx-auto mb-3 px-3 py-1 rounded-full border border-[#2ecc71]/30 bg-[#2ecc71]/10 text-xs font-semibold uppercase tracking-[0.15em] text-[#2ecc71]">
              <ShieldCheck size={14} />
              <span>Sukses</span>
            </div>
            <h1 id="approve-title" style={{ fontSize: '1.7rem', marginBottom: '12px' }}>Persetujuan Berhasil</h1>
            <p style={{ fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '24px' }}>
              Akun <strong>{targetUser?.displayName || targetUser?.email || 'User'}</strong> ({targetUser?.email || targetUser?.phoneNumber || 'No HP'}) sekarang sudah aktif dan dapat mengakses Scheduler.
            </p>
            <button 
              className="auth-google-btn" 
              type="button" 
              onClick={() => navigate('/admin/dashboard')}
              style={{ marginTop: '0', width: '100%', background: 'var(--auth-accent)', color: '#fff', borderColor: 'var(--auth-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Home size={16} />
              <span>Ke Dashboard</span>
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-copy" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="flex items-center gap-2 justify-center w-fit mx-auto mb-3 px-3 py-1 rounded-full border border-[var(--auth-danger)] bg-[var(--auth-danger)]/10 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--auth-danger)]">
              <AlertCircle size={14} />
              <span>Gagal</span>
            </div>
            <h1 id="approve-title" style={{ fontSize: '1.7rem', marginBottom: '12px' }}>Gagal Menyetujui</h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--auth-danger)', lineHeight: '1.6', marginBottom: '24px' }}>
              {errorMsg}
            </p>
            {currentUser?.email?.toLowerCase() !== 'marsicprod@gmail.com' ? (
              <button 
                className="auth-google-btn" 
                type="button" 
                onClick={onLogout}
                style={{ marginTop: '0', width: '100%', borderColor: 'var(--auth-danger)', color: 'var(--auth-danger)' }}
              >
                <span>Keluar & Login Sebagai Owner</span>
              </button>
            ) : (
              <button 
                className="auth-google-btn" 
                type="button" 
                onClick={() => navigate('/admin/dashboard')}
                style={{ marginTop: '0', width: '100%' }}
              >
                <span>Kembali ke Dashboard</span>
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState({ isReady: false, isAuthenticated: false, user: null });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  useEffect(() => {
    return adminAuthRepository.subscribeAdminAuth(setAuthState);
  }, []);

  const routeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')),
    [location.pathname]
  );

  const activeItem = routeItem || navItems[0];

  const mobilePrimaryNavItems = useMemo(
    () => navItems.filter((item) => mobilePrimaryNavKeys.includes(item.key)),
    []
  );

  const mobileMoreNavItems = useMemo(
    () => navItems.filter((item) => !mobilePrimaryNavKeys.includes(item.key)),
    []
  );

  const isMoreNavActive = mobileMoreNavItems.some((item) => item.key === activeItem.key);

  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem) {
      navigate('/admin/dashboard', { replace: true });
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
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  // Handle URL-based approval redirect
  const isApprovePath = location.pathname === '/admin/approve' || location.pathname === '/admin/approve/';
  if (isApprovePath) {
    return <AutoApproveView currentUser={authState.user} onLogout={handleLogout} />;
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
    setIsMoreMenuOpen(false);
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
    <main className={shellClassName} data-auth-surface="admin" data-admin-active={activeItem.key}>
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
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            aria-expanded={isMoreMenuOpen}
            aria-haspopup="menu"
            className={isMoreNavActive ? 'admin-bottom-item is-active' : 'admin-bottom-item'}
            type="button"
            onClick={() => setIsMoreMenuOpen((current) => !current)}
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
