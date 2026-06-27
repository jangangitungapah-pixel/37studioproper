import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CalendarDays,
  CreditCard,
  UsersRound,
  PackageOpen,
  Settings,
  LoaderCircle,
  AlertCircle,
  BookOpen,
  Home,
  Image,
  HandCoins,
  UserCheck,
  BellRing,
} from 'lucide-react';
import { adminAuthRepository } from '../services/adminAuthRepository.js';
import { adminBookingRepository } from '../services/adminBookingRepository.js';
import {
  NOTIFICATION_EVENT_STATUSES,
  subscribeNotificationEvents,
} from '../services/notificationEventRepository.js';
import {
  identifyOneSignalUser,
  isOneSignalBrowserSupported,
  logoutOneSignalUser,
} from '../services/oneSignalService.js';
import { syncNotificationSubscription } from '../services/notificationSubscriptionRepository.js';
import { getAccountDefaultLandingPath } from '../utils/accountSettings.js';
import { hasAdminPagePermission, isOwnerAdminUser } from '../utils/adminPermissions.js';
import { PORTAL_ACCESS } from '../utils/accountRoles.js';
import GuardAttendanceApprovalModal from '../components/guard/GuardAttendanceApprovalModal.jsx';
import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import AdminTopbar from '../components/admin/AdminTopbar.jsx';
import AdminBottomNav from '../components/admin/AdminBottomNav.jsx';
import '../styles/admin-auth.css';

const SIDEBAR_STORAGE_KEY = '37musicstudio.admin.sidebar.v1';

import AccessState from '../components/ui/AccessState.jsx';
import AutoApprovePage from './admin/AutoApprovePage.jsx';

const SchedulePage = lazy(() => import('./admin/SchedulePage.jsx'));
const CustomerPage = lazy(() => import('./admin/CustomerPage.jsx'));
const BillingPage = lazy(() => import('./admin/BillingPage.jsx'));
const BookkeepingPage = lazy(() => import('./admin/BookkeepingPage.jsx'));
const InventoryPage = lazy(() => import('./admin/InventoryPage.jsx'));
const SettingsPage = lazy(() => import('./admin/SettingsPage.jsx'));
const DashboardPage = lazy(() => import('./admin/DashboardPage.jsx'));
const GalleryPage = lazy(() => import('./admin/GalleryPage.jsx'));
const NotificationsPage = lazy(() => import('./admin/NotificationsPage.jsx'));
const OperatorFeePage = lazy(() => import('./admin/OperatorFeePage.jsx'));
const GuardAttendancePage = lazy(() => import('./admin/GuardAttendancePage.jsx'));

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
    key: 'notifications',
    label: 'Notifikasi',
    path: '/admin/notifications',
    icon: BellRing,
    title: 'Notification Console',
    permissionKey: 'settings',
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
    key: 'operator-fee',
    label: 'Operator Fee',
    path: '/admin/operator-fee',
    icon: HandCoins,
    title: 'Operator Fee',
  },
  {
    key: 'guard-attendance',
    label: 'Absen Penjaga',
    path: '/admin/guard-attendance',
    icon: UserCheck,
    title: 'Absen Penjaga',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    path: '/admin/inventory',
    icon: PackageOpen,
    title: 'Inventory',
  },
  {
    key: 'gallery',
    label: 'Gallery',
    path: '/admin/gallery',
    icon: Image,
    title: 'Studio Gallery',
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    icon: Settings,
    title: 'Settings',
  },
];

function getNavPermissionKey(item) {
  return item?.permissionKey || item?.key;
}

function canAccessNavItem(user, item) {
  if (item?.ownerOnly) return isOwnerAdminUser(user);

  return hasAdminPagePermission(user, getNavPermissionKey(item));
}

function getFirstPermittedNavItem(user) {
  return navItems.find((item) => canAccessNavItem(user, item)) || null;
}

function getPermittedDefaultLandingPath(user) {
  const preferredPath = getAccountDefaultLandingPath(user?.uid);
  const preferredItem = navItems.find((item) => item.path === preferredPath);

  if (preferredItem && canAccessNavItem(user, preferredItem)) {
    return preferredItem.path;
  }

  return getFirstPermittedNavItem(user)?.path || '/admin';
}

function getInitialSidebarState() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function getNotificationBadgeCount(summary) {
  if (!summary) return 0;
  return (summary.failed || 0) + (summary.pending || 0) + (summary.processing || 0);
}

function getNotificationBadgeLabel(summary) {
  if (!summary) return '';
  if (summary.failed > 0) return 'error';
  if (summary.processing > 0) return 'processing';
  if (summary.pending > 0) return 'pending';
  return '';
}

function createEmptyNotificationSummary(status = 'idle') {
  return {
    failed: 0,
    pending: 0,
    processing: 0,
    status,
    total: 0,
  };
}

function createNotificationSummary(events = []) {
  return events.reduce((summary, event) => {
    const nextSummary = {
      ...summary,
      total: summary.total + 1,
    };

    if (event.status === NOTIFICATION_EVENT_STATUSES.FAILED) {
      nextSummary.failed += 1;
    }

    if (event.status === NOTIFICATION_EVENT_STATUSES.PENDING) {
      nextSummary.pending += 1;
    }

    if (event.status === NOTIFICATION_EVENT_STATUSES.PROCESSING) {
      nextSummary.processing += 1;
    }

    return nextSummary;
  }, createEmptyNotificationSummary('ready'));
}


function renderAdminContent(activeKey, currentUser) {
  if (activeKey === 'dashboard') return <DashboardPage />;
  if (activeKey === 'notifications') return <NotificationsPage currentUser={currentUser} />;
  if (activeKey === 'settings') return <SettingsPage currentUser={currentUser} />;
  if (activeKey === 'customers') return <CustomerPage />;
  if (activeKey === 'billing') return <BillingPage />;
  if (activeKey === 'bookkeeping') return <BookkeepingPage />;
  if (activeKey === 'operator-fee') return <OperatorFeePage currentUser={currentUser} />;
  if (activeKey === 'guard-attendance') return <GuardAttendancePage currentUser={currentUser} />;
  if (activeKey === 'inventory') return <InventoryPage />;
  if (activeKey === 'gallery') return <GalleryPage />;

  return <SchedulePage />;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState({ isReady: false, isAuthenticated: false, user: null });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarState);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState(() => createEmptyNotificationSummary());

  useEffect(() => {
    return adminAuthRepository.subscribeAdminAuth(setAuthState);
  }, []);

  useEffect(() => {
    const canWatchNotifications =
      authState.isReady &&
      authState.isAuthenticated &&
      authState.user?.isApproved &&
      hasAdminPagePermission(authState.user, 'settings');

    if (!canWatchNotifications) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setNotificationSummary(createEmptyNotificationSummary('idle'));
      });

      return () => {
        window.cancelAnimationFrame(resetFrameId);
      };
    }

    const unsubscribe = subscribeNotificationEvents(
      { status: 'all' },
      (events) => {
        setNotificationSummary(createNotificationSummary(events));
      },
      (error) => {
        console.error('[notification-badge] Gagal membaca notification events:', error);
        setNotificationSummary((current) => ({
          ...current,
          status: 'error',
        }));
      },
    );

    return unsubscribe;
  }, [authState.isReady, authState.isAuthenticated, authState.user]);

  // OneSignal: init eagerly and identify admin user as soon as auth is ready
  useEffect(() => {
    if (!isOneSignalBrowserSupported()) return;

    if (!authState.isReady || !authState.isAuthenticated || !authState.user?.isApproved) {
      // On logout: unlink OneSignal identity
      if (authState.isReady && !authState.isAuthenticated) {
        logoutOneSignalUser().catch(() => {});
      }
      return;
    }

    const user = authState.user;
    identifyOneSignalUser(user, 'admin')
      .then((state) => {
        return syncNotificationSubscription({
          reason: 'admin-login',
          role: 'admin',
          state,
          user,
        });
      })
      .catch((error) => {
        console.warn('[onesignal] Admin identify/sync failed:', error);
      });
  }, [authState.isReady, authState.isAuthenticated, authState.user]);

  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated || !authState.user?.isApproved) {
      return undefined;
    }

    const canSyncBookingData = ['dashboard', 'schedule', 'customers', 'billing'].some((pageKey) =>
      hasAdminPagePermission(authState.user, pageKey)
    );

    if (!canSyncBookingData) {
      return undefined;
    }

    let syncTimerId = 0;

    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (data) => {
        window.clearTimeout(syncTimerId);

        syncTimerId = window.setTimeout(() => {
          adminBookingRepository.syncClientCalendarSlotsFromBookings(data)
            .then((syncedCount) => {
              if (syncedCount > 0) {
                console.info('[client-calendar] Synced ' + syncedCount + ' slot mirror dari admin booking.');
              }
            })
            .catch((error) => {
              console.error('[client-calendar] Gagal sinkron slot mirror:', error);
            });
        }, 350);
      },
      (error) => {
        console.error('[client-calendar] Gagal membaca booking untuk sync slot:', error);
      }
    );

    return () => {
      window.clearTimeout(syncTimerId);
      unsubscribe();
    };
  }, [authState.isReady, authState.isAuthenticated, authState.user]);


  const routeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')),
    [location.pathname]
  );

  const permittedNavItems = useMemo(
    () => navItems.filter((item) => canAccessNavItem(authState.user, item)),
    [authState.user]
  );

  const isRoutePermitted = !routeItem || canAccessNavItem(authState.user, routeItem);
  const activeItem = isRoutePermitted
    ? (routeItem || getFirstPermittedNavItem(authState.user) || navItems[0])
    : (getFirstPermittedNavItem(authState.user) || navItems[0]);

  const mobilePrimaryNavItems = useMemo(
    () => permittedNavItems.filter((item) => mobilePrimaryNavKeys.includes(item.key)),
    [permittedNavItems]
  );

  const mobileMoreNavItems = useMemo(
    () => permittedNavItems.filter((item) => !mobilePrimaryNavKeys.includes(item.key)),
    [permittedNavItems]
  );

  const isMoreNavActive = mobileMoreNavItems.some((item) => item.key === activeItem.key);
  const notificationBadgeCount = getNotificationBadgeCount(notificationSummary);
  const notificationBadgeLabel = getNotificationBadgeLabel(notificationSummary);
  const canOpenNotifications = hasAdminPagePermission(authState.user, 'settings');
  const shouldShowMoreNotificationBadge = notificationBadgeCount > 0 && mobileMoreNavItems.some((item) => item.key === 'notifications');

  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;
    if ([PORTAL_ACCESS.WRONG_PORTAL_CLIENT, PORTAL_ACCESS.ADMIN_BLOCKED, PORTAL_ACCESS.INVALID_ACCOUNT, PORTAL_ACCESS.MISSING_ACCOUNT].includes(authState.user?.access)) {
      return;
    }

    if (!permittedNavItems.length) return;

    if (location.pathname === '/admin' || location.pathname === '/admin/' || !routeItem || !isRoutePermitted) {
      navigate(getPermittedDefaultLandingPath(authState.user), { replace: true });
    }
  }, [location.pathname, navigate, routeItem, isRoutePermitted, permittedNavItems.length, authState.isReady, authState.isAuthenticated, authState.user]);

  async function handleLogout() {
    await adminAuthRepository.signOutAdmin();
    navigate('/login', { replace: true });
  }

  if (new URLSearchParams(location.search).has('billingPreview')) {
    return (
      <main className="theme-container admin-shell" data-auth-surface="admin" data-admin-active="billing">
        <section className="admin-stage" aria-label="Billing preview">
          <header className="admin-topbar">
            <div>
              <p>Studio 37</p>
              <h1>Billing</h1>
            </div>
          </header>
          <Suspense fallback={null}>
            <BillingPage />
          </Suspense>
        </section>
      </main>
    );
  }

  if (new URLSearchParams(location.search).has('schedulePreview')) {
    return (
      <main className="theme-container admin-shell" data-auth-surface="admin" data-admin-active="schedule">
        <section className="admin-stage" aria-label="Schedule preview">
          <header className="admin-topbar">
            <div>
              <p>Studio 37</p>
              <h1>Schedule</h1>
            </div>
          </header>
          <Suspense fallback={null}>
            <SchedulePage />
          </Suspense>
        </section>
      </main>
    );
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

  if (authState.user?.access === PORTAL_ACCESS.WRONG_PORTAL_CLIENT) {
    return (
      <AccessState
        icon={AlertCircle}
        statusLabel="Role Client"
        statusType="neutral"
        title="Akses Admin Tidak Diizinkan"
        description={
          <>
            Akun <strong>{authState.user?.email || authState.user?.phoneNumber || 'ini'}</strong> terdaftar sebagai client. Satu akun tidak dapat memiliki role client dan admin sekaligus.
          </>
        }
        primaryAction={{
          label: 'Buka Portal Client',
          onClick: () => navigate('/client/portal', { replace: true }),
          variant: 'secondary'
        }}
        secondaryAction={{
          label: 'Keluar Akun',
          onClick: handleLogout, variant: 'danger'
        }}
      />
    );
  }

  if ([PORTAL_ACCESS.ADMIN_BLOCKED, PORTAL_ACCESS.INVALID_ACCOUNT, PORTAL_ACCESS.MISSING_ACCOUNT].includes(authState.user?.access)) {
    return (
      <AccessState
        icon={AlertCircle}
        iconColorClass="text-danger"
        title="Request Admin Tidak Aktif"
        description="Request akses admin untuk akun ini telah ditolak atau status role-nya tidak valid."
        primaryAction={{
          label: 'Keluar Akun',
          onClick: handleLogout, variant: 'secondary'
        }}
      />
    );
  }

  // Handle URL-based approval redirect
  const isApprovePath = location.pathname === '/admin/approve' || location.pathname === '/admin/approve/';
  if (isApprovePath) {
    return <AutoApprovePage currentUser={authState.user} onLogout={handleLogout} />;
  }

  if (!authState.user?.isApproved) {
    return (
      <AccessState
        icon={LoaderCircle}
        isLoadingIcon={true}
        statusLabel="Akses Tertunda"
        statusType="neutral"
        title="Menunggu Persetujuan"
        description={
          <>
            Akun Anda <strong>{authState.user?.email || authState.user?.phoneNumber || 'admin'}</strong> berhasil dibuat tetapi belum aktif.
          </>
        }
        alertMessage={
          <>
            Harap hubungi pemilik studio di <strong>marsicprod@gmail.com</strong> untuk memberikan persetujuan akses bagi akun Anda. Halaman ini akan diperbarui secara otomatis setelah disetujui.
          </>
        }
        primaryAction={{
          label: 'Keluar Akun',
          onClick: handleLogout, variant: 'danger'
        }}
      />
    );
  }

  if (!permittedNavItems.length) {
    return (
      <AccessState
        icon={AlertCircle}
        iconColorClass="text-accent"
        title="Akses Halaman Belum Diatur"
        description={
          <>
            Akun <strong>{authState.user?.email || authState.user?.phoneNumber || 'ini'}</strong> sudah aktif, tetapi owner belum memberi akses halaman admin portal.
          </>
        }
        primaryAction={{
          label: 'Keluar Akun',
          onClick: handleLogout, variant: 'secondary'
        }}
      />
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
      {isOwnerAdminUser(authState.user) && (
        <GuardAttendanceApprovalModal
          currentUser={authState.user}
          onOpenPanel={() => goTo('/admin/guard-attendance')}
        />
      )}
      <AdminSidebar
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        permittedNavItems={permittedNavItems}
        activeItem={activeItem}
        goTo={goTo}
        notificationSummary={notificationSummary}
        notificationBadgeLabel={notificationBadgeLabel}
        user={authState.user}
        onLogout={handleLogout}
      />

      <section className="admin-stage" aria-labelledby="admin-title">
        <AdminTopbar
          activeItem={activeItem}
          canOpenNotifications={canOpenNotifications}
          notificationBadgeLabel={notificationBadgeLabel}
          goTo={goTo}
          notificationSummary={notificationSummary}
          onLogout={handleLogout}
          user={authState.user}
        />

        <Suspense
          fallback={
            <div className="admin-page-loading" style={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
              <LoaderCircle className="auth-spin" size={32} style={{ color: 'var(--auth-accent)' }} />
            </div>
          }
        >
          {renderAdminContent(activeItem.key, authState.user)}
        </Suspense>
      </section>

      <AdminBottomNav
        mobilePrimaryNavItems={mobilePrimaryNavItems}
        activeItem={activeItem}
        goTo={goTo}
        notificationSummary={notificationSummary}
        isMoreMenuOpen={isMoreMenuOpen}
        setIsMoreMenuOpen={setIsMoreMenuOpen}
        mobileMoreNavItems={mobileMoreNavItems}
        shouldShowMoreNotificationBadge={shouldShowMoreNotificationBadge}
        notificationBadgeLabel={notificationBadgeLabel}
        isMoreNavActive={isMoreNavActive}
      />
    </main>
  );
}



