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
  Inbox,
  ListChecks,
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
import {
  ADMIN_MOBILE_PRIMARY_KEYS,
  ADMIN_NAV_ITEMS,
  findAdminNavigationItem,
  isAdminMobileItem,
  isAdminSidebarItem,
  resolveAdminNavigationPath,
} from '../config/adminNavigation.js';
import { ACCOUNT_ROLES, PORTAL_ACCESS } from '../utils/accountRoles.js';
import GuardAttendanceApprovalModal from '../components/guard/GuardAttendanceApprovalModal.jsx';
import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import AdminTopbar from '../components/admin/AdminTopbar.jsx';
import AdminBottomNav from '../components/admin/AdminBottomNav.jsx';
import SpatialUiProvider from '../components/ui/SpatialUiProvider.jsx';
import { ThemeProvider } from '../theme/ThemeProvider.jsx';
import '../styles/routes/admin.css';
import '../styles/spatial-foundation.css';

const SIDEBAR_STORAGE_KEY = '37musicstudio.admin.sidebar.v1';

import AccessState from '../components/ui/AccessState.jsx';
import AutoApprovePage from './admin/AutoApprovePage.jsx';

const BookingRequestsPage = lazy(() => import('./admin/BookingRequestsPage.jsx'));
const AllBookingsPage = lazy(() => import('./admin/AllBookingsPage.jsx'));
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

const adminNavIcons = Object.freeze({
  dashboard: Home,
  notifications: BellRing,
  requests: Inbox,
  schedule: CalendarDays,
  bookings: ListChecks,
  customers: UsersRound,
  billing: CreditCard,
  bookkeeping: BookOpen,
  'operator-fee': HandCoins,
  'guard-attendance': UserCheck,
  inventory: PackageOpen,
  gallery: Image,
  settings: Settings,
});

const navItems = ADMIN_NAV_ITEMS.map((item) => ({
  ...item,
  icon: adminNavIcons[item.iconKey],
}));

function getNavPermissionKey(item) {
  return item?.permissionKey || item?.key;
}

function canAccessNavItem(user, item) {
  if (item?.ownerOnly) return isOwnerAdminUser(user);

  return hasAdminPagePermission(user, getNavPermissionKey(item));
}

function getFirstPermittedNavItem(user) {
  return (
    navItems.find(
      (item) =>
        isAdminSidebarItem(item) &&
        canAccessNavItem(user, item),
    ) ||
    null
  );
}

function getPermittedDefaultLandingPath(user) {
  const preferredPath = resolveAdminNavigationPath(
    getAccountDefaultLandingPath(user?.uid),
  );

  const preferredItem = navItems.find(
    (item) =>
      item.path === preferredPath &&
      isAdminSidebarItem(item),
  );

  if (
    preferredItem &&
    canAccessNavItem(
      user,
      preferredItem,
    )
  ) {
    return preferredItem.path;
  }

  return (
    getFirstPermittedNavItem(user)?.path ||
    '/admin'
  );
}

function getInitialSidebarState() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
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
  if (activeKey === 'requests') return <BookingRequestsPage currentUser={currentUser} />;
  if (activeKey === 'bookings') return <AllBookingsPage />;
  if (activeKey === 'notifications') return <NotificationsPage currentUser={currentUser} />;
  if (activeKey === 'settings') return <SettingsPage currentUser={currentUser} />;
  if (activeKey === 'customers') return <CustomerPage />;
  if (activeKey === 'billing') return <BillingPage />;
  if (activeKey === 'bookkeeping') return <BookkeepingPage />;
  if (activeKey === 'operator-fee') return <OperatorFeePage currentUser={currentUser} />;
  if (activeKey === 'guard-attendance') return <GuardAttendancePage currentUser={currentUser} />;
  if (activeKey === 'inventory') return <InventoryPage />;
  if (activeKey === 'gallery') return <GalleryPage currentUser={currentUser} />;

  return <SchedulePage currentUser={currentUser} />;
}

function AdminQaPreview({
  activeKey,
  children,
  title,
}) {
  return (
    <main
      className="theme-container admin-shell admin-shell-preview"
      data-admin-active={activeKey}
      data-admin-preview="true"
      data-auth-surface="admin"
    >
      <section
        aria-label={`${title} QA preview`}
        className="admin-stage"
      >
        <header className="admin-topbar admin-preview-topbar">
          <div>
            <p>Studio 37</p>
            <h1>{title}</h1>
          </div>
        </header>

        <Suspense
          fallback={
            <div
              aria-live="polite"
              className="admin-route-loading"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="auth-spin admin-route-loading-icon"
                size={24}
              />
              <span>Memuat {title}</span>
            </div>
          }
        >
          {children}
        </Suspense>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <ThemeProvider>
      <SpatialUiProvider>
        <AdminPageContent />
      </SpatialUiProvider>
    </ThemeProvider>
  );
}

function AdminPageContent() {
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
      hasAdminPagePermission(authState.user, 'notifications');

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


  const routeItem = useMemo(() => {
    const matchedItem = findAdminNavigationItem(
      location.pathname,
    );

    if (!matchedItem) return null;

    return (
      navItems.find(
        (item) =>
          item.key === matchedItem.key,
      ) ||
      null
    );
  }, [location.pathname]);

  const permittedNavItems = useMemo(
    () =>
      navItems.filter(
        (item) =>
          canAccessNavItem(
            authState.user,
            item,
          ),
      ),
    [authState.user],
  );

  const sidebarNavItems = useMemo(
    () =>
      permittedNavItems.filter(
        isAdminSidebarItem,
      ),
    [permittedNavItems],
  );

  const mobileNavItems = useMemo(
    () =>
      permittedNavItems.filter(
        isAdminMobileItem,
      ),
    [permittedNavItems],
  );

  const isRoutePermitted =
    !routeItem ||
    canAccessNavItem(
      authState.user,
      routeItem,
    );

  const activeItem = isRoutePermitted
    ? (
      routeItem ||
      getFirstPermittedNavItem(
        authState.user,
      ) ||
      navItems[0]
    )
    : (
      getFirstPermittedNavItem(
        authState.user,
      ) ||
      navItems[0]
    );

  const mobilePrimaryNavItems = useMemo(
    () =>
      mobileNavItems
        .filter(
          (item) =>
            ADMIN_MOBILE_PRIMARY_KEYS.includes(
              item.key,
            ),
        )
        .map((item) => ({
          ...item,
          label:
            item.mobileLabel ||
            item.label,
        })),
    [mobileNavItems],
  );

  const mobileMoreNavItems = useMemo(
    () =>
      mobileNavItems.filter(
        (item) =>
          !ADMIN_MOBILE_PRIMARY_KEYS.includes(
            item.key,
          ),
      ),
    [mobileNavItems],
  );

  const isMoreNavActive = mobileMoreNavItems.some((item) => item.key === activeItem.key);
  const notificationBadgeLabel = getNotificationBadgeLabel(notificationSummary);
  const canOpenNotifications = hasAdminPagePermission(authState.user, 'notifications');

  useEffect(() => {
    if (!authState.isReady || !authState.isAuthenticated) return;
    if ([PORTAL_ACCESS.WRONG_PORTAL_CLIENT, PORTAL_ACCESS.ADMIN_BLOCKED, PORTAL_ACCESS.INVALID_ACCOUNT, PORTAL_ACCESS.MISSING_ACCOUNT].includes(authState.user?.access)) {
      return;
    }

    if (!permittedNavItems.length) return;

    const canonicalPath =
      resolveAdminNavigationPath(
        location.pathname,
      );

    if (
      canonicalPath !==
      location.pathname
    ) {
      navigate(
        canonicalPath +
          location.search +
          location.hash,
        {
          replace: true,
        },
      );

      return;
    }

    if (
      location.pathname === '/admin' ||
      location.pathname === '/admin/' ||
      !routeItem ||
      !isRoutePermitted
    ) {
      navigate(
        getPermittedDefaultLandingPath(
          authState.user,
        ),
        {
          replace: true,
        },
      );
    }
  }, [
    location.pathname,
    location.search,
    location.hash,
    navigate,
    routeItem,
    isRoutePermitted,
    permittedNavItems.length,
    authState.isReady,
    authState.isAuthenticated,
    authState.user,
  ]);

  async function handleLogout() {
    await adminAuthRepository.signOutAdmin();
    navigate('/login', { replace: true });
  }

  const qaPreviewParams =
    new URLSearchParams(
      location.search,
    );

  const isBillingQaPreview =
    import.meta.env.DEV &&
    qaPreviewParams.has(
      'billingPreview',
    );

  const isScheduleQaPreview =
    import.meta.env.DEV &&
    qaPreviewParams.has(
      'schedulePreview',
    );

  const hasDisabledQaPreview =
    !import.meta.env.DEV &&
    (
      qaPreviewParams.has(
        'billingPreview',
      ) ||
      qaPreviewParams.has(
        'schedulePreview',
      )
    );

  if (isBillingQaPreview) {
    return (
      <AdminQaPreview
        activeKey="billing"
        title="Billing"
      >
        <BillingPage />
      </AdminQaPreview>
    );
  }

  if (isScheduleQaPreview) {
    return (
      <AdminQaPreview
        activeKey="schedule"
        title="Schedule"
      >
        <SchedulePage />
      </AdminQaPreview>
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

  if (
    authState.user?.role ===
    ACCOUNT_ROLES.STUDIO_GUARD
  ) {
    return (
      <Navigate
        to="/guard/attendance"
        replace
      />
    );
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

  if (hasDisabledQaPreview) {
    qaPreviewParams.delete(
      'billingPreview',
    );
    qaPreviewParams.delete(
      'schedulePreview',
    );

    const remainingSearch =
      qaPreviewParams.toString();

    return (
      <Navigate
        replace
        to={
          location.pathname +
          (remainingSearch
            ? `?${remainingSearch}`
            : '') +
          location.hash
        }
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
        <main
          className={shellClassName}
          data-auth-surface="admin"
          data-admin-active={activeItem.key}
          data-admin-spatial-root="true"
        >
      {isOwnerAdminUser(authState.user) && (
        <GuardAttendanceApprovalModal
          currentUser={authState.user}
          onOpenPanel={() => goTo('/admin/operations/guard-attendance')}
        />
      )}
      <div
        className="admin-shell-layout"
        data-admin-spatial-phase="ui-0a"
      >
        <div
          aria-label="Navigasi utama admin"
          className="admin-navigation-zone"
        >
          <AdminSidebar
            isSidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={toggleSidebar}
            permittedNavItems={sidebarNavItems}
            activeItem={activeItem}
            goTo={goTo}
            user={authState.user}
            onLogout={handleLogout}
          />
        </div>

        <section
          aria-label="Workspace admin"
          className="admin-workspace"
        >
          <div className="admin-workspace-canvas">
            <section
              className="admin-stage"
              aria-labelledby="admin-title"
            >
              <AdminTopbar
                activeItem={activeItem}
                canOpenNotifications={canOpenNotifications}
                currentAdminPath={
                  location.pathname +
                  location.search +
                  location.hash
                }
                notificationBadgeLabel={notificationBadgeLabel}
                goTo={goTo}
                notificationSummary={notificationSummary}
                onLogout={handleLogout}
                user={authState.user}
              />

              <Suspense
                fallback={
                  <div
                    aria-live="polite"
                    className="admin-route-loading"
                    role="status"
                  >
                    <LoaderCircle
                      className="auth-spin admin-route-loading-icon"
                      size={24}
                    />

                    <span>
                      Memuat {activeItem.title}
                    </span>
                  </div>
                }
              >
                {renderAdminContent(
                  activeItem.key,
                  authState.user,
                )}
              </Suspense>
            </section>
          </div>
        </section>
      </div>

          <AdminBottomNav
            mobilePrimaryNavItems={mobilePrimaryNavItems}
            activeItem={activeItem}
            goTo={goTo}
            isMoreMenuOpen={isMoreMenuOpen}
            setIsMoreMenuOpen={setIsMoreMenuOpen}
            mobileMoreNavItems={mobileMoreNavItems}
            isMoreNavActive={isMoreNavActive}
            user={authState.user}
            onLogout={handleLogout}
          />
        </main>
  );
}
