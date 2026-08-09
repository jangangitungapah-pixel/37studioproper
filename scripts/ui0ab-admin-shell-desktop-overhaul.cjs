const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  adminPage: path.join(
    ROOT,
    'src',
    'pages',
    'AdminPage.jsx',
  ),

  sidebar: path.join(
    ROOT,
    'src',
    'components',
    'admin',
    'AdminSidebar.jsx',
  ),

  topbar: path.join(
    ROOT,
    'src',
    'components',
    'admin',
    'AdminTopbar.jsx',
  ),

  bottomNav: path.join(
    ROOT,
    'src',
    'components',
    'admin',
    'AdminBottomNav.jsx',
  ),

  navigation: path.join(
    ROOT,
    'src',
    'config',
    'adminNavigation.js',
  ),

  css: path.join(
    ROOT,
    'src',
    'styles',
    'modules',
    'admin-shell.css',
  ),

  oldContract: path.join(
    ROOT,
    'scripts',
    'admin-shell-navigation-ux-test.mjs',
  ),

  newContract: path.join(
    ROOT,
    'scripts',
    'admin-shell-ui0-desktop-contract-test.mjs',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),
};

const staged = new Map();

const CSS_MARKER =
  '/* UI-0A/B — Admin Shell Foundation + Desktop Overhaul */';

function fail(message) {
  console.error('');
  console.error(
    '❌ [ui-0a-b] ' +
      message,
  );
  console.error('');

  process.exit(1);
}

function normalize(value) {
  return String(
    value,
  ).replace(
    /\r\n/g,
    '\n',
  );
}

function readDisk(file) {
  if (
    !fs.existsSync(
      file,
    )
  ) {
    fail(
      'File tidak ditemukan: ' +
        path.relative(
          ROOT,
          file,
        ),
    );
  }

  return normalize(
    fs.readFileSync(
      file,
      'utf8',
    ),
  );
}

function read(file) {
  if (
    staged.has(
      file,
    )
  ) {
    return staged.get(
      file,
    );
  }

  return readDisk(
    file,
  );
}

function stage(
  file,
  content,
) {
  staged.set(
    file,
    normalize(
      content,
    ),
  );
}

function stageExact(
  file,
  content,
  label,
) {
  const normalized =
    normalize(
      content,
    );

  if (
    fs.existsSync(
      file,
    ) &&
    readDisk(
      file,
    ) ===
      normalized
  ) {
    console.log(
      'ℹ️ Already correct: ' +
        label,
    );

    return;
  }

  stage(
    file,
    normalized,
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function replaceOnceOrAlready({
  file,
  before,
  after,
  afterMarker,
  label,
}) {
  const source =
    read(
      file,
    );

  if (
    afterMarker &&
    source.includes(
      afterMarker,
    )
  ) {
    console.log(
      'ℹ️ Already applied: ' +
        label,
    );

    return;
  }

  const firstIndex =
    source.indexOf(
      before,
    );

  if (
    firstIndex < 0
  ) {
    fail(
      label +
        ': anchor tidak ditemukan.',
    );
  }

  const secondIndex =
    source.indexOf(
      before,
      firstIndex +
        before.length,
    );

  if (
    secondIndex >= 0
  ) {
    fail(
      label +
        ': anchor ditemukan lebih dari sekali.',
    );
  }

  stage(
    file,
    source.replace(
      before,
      after,
    ),
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function appendOnce({
  file,
  marker,
  content,
  label,
}) {
  const source =
    read(
      file,
    );

  if (
    source.includes(
      marker,
    )
  ) {
    console.log(
      'ℹ️ Already applied: ' +
        label,
    );

    return;
  }

  stage(
    file,
    source.trimEnd() +
      '\n\n' +
      normalize(
        content,
      ).trim() +
      '\n',
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function assertIncludes(
  source,
  values,
  context,
) {
  for (
    const value
    of values
  ) {
    if (
      !source.includes(
        value,
      )
    ) {
      fail(
        context +
          ' kehilangan: ' +
          value,
      );
    }
  }
}

function assertExcludes(
  source,
  values,
  context,
) {
  for (
    const value
    of values
  ) {
    if (
      source.includes(
        value,
      )
    ) {
      fail(
        context +
          ' masih mengandung: ' +
          value,
      );
    }
  }
}

/**
 * ============================================================
 * BASELINE VALIDATION
 * ============================================================
 */

const baselineNavigation =
  read(
    FILES.navigation,
  );

assertIncludes(
  baselineNavigation,
  [
    'ADMIN_MOBILE_PRIMARY_KEYS',
    "'dashboard'",
    "'requests'",
    "'schedule'",
    "'billing'",
    "key: 'notifications'",
    'sidebar: false',
  ],
  'Canonical navigation baseline',
);

const baselineBottomNav =
  read(
    FILES.bottomNav,
  );

assertIncludes(
  baselineBottomNav,
  [
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    'admin-more-section-label',
    "event.key === 'Escape'",
  ],
  'Mobile navigation baseline',
);

const baselineOldContract =
  read(
    FILES.oldContract,
  );

assertIncludes(
  baselineOldContract,
  [
    'Admin shell navigation UX contract passed.',
    'admin-topbar-context',
    'admin-nav-section-label',
  ],
  'Existing shell contract',
);

/**
 * ============================================================
 * 1. DESKTOP SIDEBAR
 * ============================================================
 */

const sidebarSource = `import {
  LogOut,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

function groupSidebarItems(
  items = [],
) {
  return items.reduce(
    (
      sections,
      item,
    ) => {
      const sectionKey =
        item.group ||
        'single:' +
          item.key;

      let section =
        sections.find(
          (
            candidate,
          ) =>
            candidate.key ===
            sectionKey,
        );

      if (!section) {
        section = {
          key:
            sectionKey,

          label:
            item.groupLabel ||
            '',

          items:
            [],
        };

        sections.push(
          section,
        );
      }

      section.items.push(
        item,
      );

      return sections;
    },
    [],
  );
}

function getAccountInitial(
  user,
) {
  const identity =
    String(
      user?.displayName ||
        user?.email ||
        'A',
    ).trim();

  return (
    identity
      .charAt(0)
      .toUpperCase() ||
    'A'
  );
}

function getAccountRoleLabel(
  user,
) {
  const rawRole =
    String(
      user?.role ||
        'admin',
    )
      .trim()
      .replace(
        /_/g,
        ' ',
      );

  return rawRole.replace(
    /\\b\\w/g,
    (
      character,
    ) =>
      character.toUpperCase(),
  );
}

export default function AdminSidebar({
  isSidebarCollapsed,
  toggleSidebar,
  permittedNavItems,
  activeItem,
  goTo,
  user,
  onLogout,
}) {
  const navigationSections =
    groupSidebarItems(
      permittedNavItems,
    );

  const accountName =
    user?.displayName ||
    user?.email ||
    'Admin';

  const accountRole =
    getAccountRoleLabel(
      user,
    );

  return (
    <aside
      aria-label="Navigasi admin desktop"
      className="admin-sidebar"
      data-admin-shell-ui="ui-0b-desktop"
    >
      <div className="admin-sidebar-brand">
        <div
          aria-hidden="true"
          className="admin-sidebar-logo"
        >
          <Music2
            size={21}
            strokeWidth={2.1}
          />
        </div>

        <div className="admin-sidebar-copy">
          <span className="admin-sidebar-brand-eyebrow">
            37 Music Studio
          </span>

          <strong>
            Admin Console
          </strong>
        </div>

        <button
          aria-expanded={
            !isSidebarCollapsed
          }
          aria-label={
            isSidebarCollapsed
              ? 'Buka sidebar'
              : 'Tutup sidebar'
          }
          className="admin-sidebar-collapse"
          title={
            isSidebarCollapsed
              ? 'Buka sidebar'
              : 'Tutup sidebar'
          }
          type="button"
          onClick={
            toggleSidebar
          }
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen
              size={17}
            />
          ) : (
            <PanelLeftClose
              size={17}
            />
          )}
        </button>
      </div>

      <nav
        aria-label="Menu admin"
        className="admin-sidebar-nav"
      >
        {navigationSections.map(
          (
            section,
          ) => (
            <div
              className="admin-nav-section"
              key={
                section.key
              }
            >
              {section.label ? (
                <span className="admin-nav-section-label">
                  {section.label}
                </span>
              ) : null}

              {section.items.map(
                (
                  item,
                ) => {
                  const Icon =
                    item.icon;

                  const isActive =
                    activeItem.key ===
                    item.key;

                  return (
                    <button
                      aria-current={
                        isActive
                          ? 'page'
                          : undefined
                      }
                      className={
                        isActive
                          ? 'admin-nav-item is-active'
                          : 'admin-nav-item'
                      }
                      key={
                        item.key
                      }
                      title={
                        isSidebarCollapsed
                          ? item.label
                          : undefined
                      }
                      type="button"
                      onClick={() =>
                        goTo(
                          item.path,
                        )
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="admin-nav-icon"
                      >
                        <Icon
                          size={18}
                          strokeWidth={2}
                        />
                      </span>

                      <span className="admin-nav-label">
                        {item.label}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          ),
        )}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-account">
          <span
            aria-hidden="true"
            className="admin-account-avatar"
          >
            {getAccountInitial(
              user,
            )}
          </span>

          <span className="admin-account-copy">
            <strong>
              {accountName}
            </strong>

            <small>
              {accountRole}
            </small>
          </span>

          <button
            aria-label="Keluar dari Admin Portal"
            className="admin-account-logout"
            title="Keluar"
            type="button"
            onClick={
              onLogout
            }
          >
            <LogOut
              size={16}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
`;

stageExact(
  FILES.sidebar,
  sidebarSource,
  'premium desktop sidebar',
);

/**
 * ============================================================
 * 2. DESKTOP TOPBAR
 * ============================================================
 */

const topbarSource = `import {
  useEffect,
  useState,
} from 'react';

import {
  BellRing,
  ChevronRight,
  Clock,
  LogOut,
  Wifi,
  WifiOff,
} from 'lucide-react';

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
  const [
    isOnline,
    setIsOnline,
  ] =
    useState(
      typeof navigator !==
        'undefined'
        ? navigator.onLine
        : true,
    );

  useEffect(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return undefined;
    }

    function handleOnline() {
      setIsOnline(
        true,
      );
    }

    function handleOffline() {
      setIsOnline(
        false,
      );
    }

    window.addEventListener(
      'online',
      handleOnline,
    );

    window.addEventListener(
      'offline',
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      );

      window.removeEventListener(
        'offline',
        handleOffline,
      );
    };
  }, []);

  const isGuardEligible =
    Boolean(
      user &&
      (
        user.role ===
          'studio_guard' ||
        (
          user.role ===
            'admin' &&
          user.isGuard ===
            true
        )
      ),
    );

  const contextLabel =
    activeItem.groupLabel ||
    (
      activeItem.key ===
        'settings' ||
      activeItem.key ===
        'notifications'
        ? 'System'
        : activeItem.key ===
            'dashboard'
          ? 'Overview'
          : 'Admin'
    );

  return (
    <header
      className="admin-topbar"
      data-admin-shell-ui="ui-0b-desktop"
    >
      <div className="admin-topbar-heading">
        <div
          aria-label="Lokasi halaman admin"
          className="admin-topbar-context"
        >
          <span className="admin-topbar-context-studio">
            Admin
          </span>

          <ChevronRight
            aria-hidden="true"
            size={11}
          />

          <strong>
            {contextLabel}
          </strong>
        </div>

        <h1 id="admin-title">
          {activeItem.title}
        </h1>
      </div>

      <div className="admin-topbar-actions">
        {isGuardEligible ? (
          <a
            className="admin-notification-shortcut admin-topbar-guard-shortcut"
            href="/guard/attendance"
            title="Buka Portal Guard"
          >
            <Clock
              size={16}
            />

            <span>
              Portal Guard
            </span>
          </a>
        ) : null}

        {canOpenNotifications ? (
          <button
            aria-label={
              notificationBadgeLabel ||
              'Buka notifikasi'
            }
            className="admin-notification-shortcut"
            title={
              notificationBadgeLabel ||
              'Buka notifikasi'
            }
            type="button"
            onClick={() =>
              goTo(
                '/admin/notifications',
              )
            }
          >
            <BellRing
              size={17}
            />

            <span>
              Notifikasi
            </span>

            <AdminNotificationBadge
              summary={
                notificationSummary
              }
              variant="shortcut"
            />
          </button>
        ) : null}

        <span
          aria-live="polite"
          className={
            'admin-topbar-status-chip ' +
            (
              isOnline
                ? 'is-online'
                : 'is-offline'
            )
          }
          title={
            isOnline
              ? 'Database tersambung'
              : 'Database terputus'
          }
        >
          {isOnline ? (
            <Wifi
              size={12}
            />
          ) : (
            <WifiOff
              size={12}
            />
          )}

          <span>
            {isOnline
              ? 'Online'
              : 'Offline'}
          </span>
        </span>

        <button
          aria-label="Keluar dari Admin Portal"
          className="admin-shell-icon-button admin-topbar-logout"
          title="Keluar"
          type="button"
          onClick={
            onLogout
          }
        >
          <LogOut
            size={16}
          />

          <span>
            Keluar
          </span>
        </button>
      </div>
    </header>
  );
}
`;

stageExact(
  FILES.topbar,
  topbarSource,
  'premium desktop topbar',
);

/**
 * ============================================================
 * 3. SHELL ROUTE LOADING
 * ============================================================
 */

const oldLoading = `            <div className="admin-page-loading" style={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
              <LoaderCircle className="auth-spin" size={32} style={{ color: 'var(--auth-accent)' }} />
            </div>`;

const newLoading = `            <div
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
            </div>`;

replaceOnceOrAlready({
  file:
    FILES.adminPage,

  before:
    oldLoading,

  after:
    newLoading,

  afterMarker:
    'className="admin-route-loading"',

  label:
    'shell route loading state',
});

/**
 * ============================================================
 * 4. DESKTOP CSS
 * ============================================================
 */

const desktopCss = `
${CSS_MARKER}

.admin-shell {
  --admin-sidebar-expanded:
    264px;

  --admin-sidebar-collapsed:
    78px;

  --admin-shell-desktop-gutter:
    24px;
}

.admin-route-loading {
  min-height:
    clamp(
      260px,
      42vh,
      440px
    );

  display:
    grid;

  place-items:
    center;

  align-content:
    center;

  gap:
    10px;

  color:
    var(--auth-text-muted);

  font-size:
    var(--studio-text-xs);

  font-weight:
    650;
}

.admin-route-loading-icon {
  color:
    var(--auth-accent);
}

.admin-topbar-guard-shortcut {
  text-decoration:
    none;
}

@media (min-width: 768px) {
  .admin-shell {
    grid-template-columns:
      var(--admin-sidebar-expanded)
      minmax(0, 1fr);

    background:
      var(--auth-bg-page);

    transition:
      grid-template-columns
      190ms
      ease;
  }

  .admin-shell.is-sidebar-collapsed {
    grid-template-columns:
      var(--admin-sidebar-collapsed)
      minmax(0, 1fr);
  }

  .admin-sidebar {
    padding:
      14px
      12px;

    border-right:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        92%,
        transparent
      );

    background:
      color-mix(
        in srgb,
        var(--auth-bg-card)
        96%,
        var(--auth-bg-page)
      );
  }

  .admin-sidebar-brand {
    min-height:
      60px;

    grid-template-columns:
      42px
      minmax(0, 1fr)
      34px;

    gap:
      10px;

    padding:
      2px
      2px
      14px;

    border-bottom:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        82%,
        transparent
      );
  }

  .admin-sidebar-logo {
    width:
      42px;

    height:
      42px;

    border:
      1px solid
      color-mix(
        in srgb,
        var(--auth-accent)
        30%,
        var(--auth-border)
      );

    border-radius:
      13px;

    background:
      color-mix(
        in srgb,
        var(--auth-accent-soft)
        84%,
        var(--auth-bg-card)
      );

    color:
      var(--auth-accent-strong);
  }

  .admin-sidebar-copy {
    min-width:
      0;

    display:
      grid;

    align-content:
      center;

    gap:
      2px;
  }

  .admin-sidebar-brand-eyebrow {
    overflow:
      hidden;

    color:
      var(--auth-text-muted);

    font-size:
      0.625rem;

    font-weight:
      720;

    letter-spacing:
      0.075em;

    line-height:
      1.1;

    text-overflow:
      ellipsis;

    text-transform:
      uppercase;

    white-space:
      nowrap;
  }

  .admin-sidebar-copy strong {
    overflow:
      hidden;

    color:
      var(--auth-text-strong);

    font-size:
      0.9rem;

    font-weight:
      760;

    letter-spacing:
      -0.025em;

    text-overflow:
      ellipsis;

    white-space:
      nowrap;
  }

  .admin-sidebar-collapse {
    width:
      34px;

    min-width:
      34px;

    min-height:
      34px;

    border-color:
      transparent;

    background:
      transparent;

    color:
      var(--auth-text-muted);

    padding:
      0;
  }

  .admin-sidebar-collapse:hover {
    border-color:
      var(--auth-border);

    background:
      var(--auth-bg-soft);

    color:
      var(--auth-text-strong);
  }

  .admin-sidebar-nav {
    min-height:
      0;

    gap:
      2px;

    margin-top:
      12px;

    padding:
      0
      2px
      10px;

    overscroll-behavior:
      contain;
  }

  .admin-nav-section {
    display:
      grid;

    gap:
      2px;
  }

  .admin-nav-section +
  .admin-nav-section {
    margin-top:
      10px;

    padding-top:
      10px;

    border-top:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        66%,
        transparent
      );
  }

  .admin-nav-section-label {
    min-height:
      21px;

    display:
      flex;

    align-items:
      center;

    padding:
      0
      9px
      4px;

    color:
      var(--auth-text-muted);

    font-size:
      0.61rem;

    font-weight:
      760;

    letter-spacing:
      0.105em;

    opacity:
      0.86;

    text-transform:
      uppercase;
  }

  .admin-nav-section:has(
    .admin-nav-item.is-active
  )
  .admin-nav-section-label {
    color:
      var(--auth-text-muted);
  }

  .admin-nav-item {
    min-height:
      42px;

    gap:
      10px;

    border:
      1px solid
      transparent;

    border-radius:
      10px;

    color:
      var(--auth-text-muted);

    padding:
      0
      10px;

    font-size:
      0.79rem;

    font-weight:
      630;
  }

  .admin-nav-icon {
    width:
      20px;

    height:
      20px;

    display:
      grid;

    flex:
      0 0
      20px;

    place-items:
      center;

    opacity:
      0.9;
  }

  .admin-nav-label {
    min-width:
      0;

    overflow:
      hidden;

    text-overflow:
      ellipsis;

    white-space:
      nowrap;
  }

  .admin-nav-item:hover {
    border-color:
      color-mix(
        in srgb,
        var(--auth-border)
        82%,
        transparent
      );

    background:
      color-mix(
        in srgb,
        var(--auth-bg-soft)
        78%,
        transparent
      );

    color:
      var(--auth-text-strong);
  }

  .admin-nav-item.is-active {
    border-color:
      color-mix(
        in srgb,
        var(--auth-accent)
        20%,
        var(--auth-border)
      );

    background:
      color-mix(
        in srgb,
        var(--auth-accent-soft)
        74%,
        var(--auth-bg-card)
      );

    color:
      var(--auth-accent-strong);

    font-weight:
      710;
  }

  .admin-nav-item.is-active::before {
    left:
      4px;

    width:
      3px;

    height:
      18px;

    border-radius:
      999px;

    background:
      var(--auth-accent);
  }

  .admin-nav-item.is-active
  .admin-nav-icon {
    color:
      var(--auth-accent-strong);

    opacity:
      1;
  }

  .admin-sidebar-footer {
    display:
      grid;

    gap:
      0;

    margin-top:
      auto;

    padding-top:
      12px;

    border-top:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        76%,
        transparent
      );
  }

  .admin-sidebar-account {
    min-width:
      0;

    min-height:
      54px;

    display:
      grid;

    grid-template-columns:
      34px
      minmax(0, 1fr)
      32px;

    align-items:
      center;

    gap:
      9px;

    border:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        86%,
        transparent
      );

    border-radius:
      12px;

    background:
      color-mix(
        in srgb,
        var(--auth-bg-soft)
        52%,
        var(--auth-bg-card)
      );

    padding:
      7px;
  }

  .admin-account-avatar {
    width:
      34px;

    height:
      34px;

    display:
      grid;

    place-items:
      center;

    border:
      1px solid
      color-mix(
        in srgb,
        var(--auth-accent)
        22%,
        var(--auth-border)
      );

    border-radius:
      10px;

    background:
      var(--auth-accent-soft);

    color:
      var(--auth-accent-strong);

    font-size:
      0.76rem;

    font-weight:
      780;
  }

  .admin-account-copy {
    min-width:
      0;

    display:
      grid;

    gap:
      2px;
  }

  .admin-account-copy strong,
  .admin-account-copy small {
    overflow:
      hidden;

    text-overflow:
      ellipsis;

    white-space:
      nowrap;
  }

  .admin-account-copy strong {
    color:
      var(--auth-text-strong);

    font-size:
      0.74rem;

    font-weight:
      690;
  }

  .admin-account-copy small {
    color:
      var(--auth-text-muted);

    font-size:
      0.64rem;

    font-weight:
      570;
  }

  .admin-account-logout {
    width:
      32px;

    height:
      32px;

    display:
      grid;

    place-items:
      center;

    border:
      0;

    border-radius:
      9px;

    background:
      transparent;

    color:
      var(--auth-text-muted);

    padding:
      0;

    cursor:
      pointer;
  }

  .admin-account-logout:hover,
  .admin-account-logout:focus-visible {
    background:
      var(--auth-danger-soft);

    color:
      var(--auth-danger);
  }

  .admin-stage {
    min-width:
      0;

    padding:
      0
      var(--admin-shell-desktop-gutter)
      28px;
  }

  .admin-topbar {
    min-height:
      76px;

    gap:
      24px;

    margin:
      0
      calc(
        var(--admin-shell-desktop-gutter)
        * -1
      )
      24px;

    padding:
      0
      var(--admin-shell-desktop-gutter);

    border-bottom:
      1px solid
      color-mix(
        in srgb,
        var(--auth-border)
        88%,
        transparent
      );

    background:
      color-mix(
        in srgb,
        var(--auth-bg-page)
        88%,
        var(--auth-bg-card)
      );

    backdrop-filter:
      blur(16px);
  }

  .admin-topbar-heading {
    min-width:
      0;

    display:
      grid;

    align-content:
      center;

    gap:
      3px;
  }

  .admin-topbar-context {
    gap:
      5px;

    margin:
      0;

    color:
      var(--auth-text-muted);

    font-size:
      0.65rem;

    font-weight:
      620;
  }

  .admin-topbar-context-studio {
    color:
      var(--auth-text-muted);
  }

  .admin-topbar-context strong {
    color:
      var(--auth-text-muted);

    font-weight:
      700;
  }

  .admin-topbar h1 {
    max-width:
      none;

    font-size:
      clamp(
        1.25rem,
        1.35vw,
        1.48rem
      );

    font-weight:
      760;

    letter-spacing:
      -0.04em;

    line-height:
      1.05;
  }

  .admin-topbar-actions {
    flex:
      0 0
      auto;

    gap:
      7px;
  }

  .admin-notification-shortcut,
  .admin-shell-icon-button {
    min-height:
      36px;

    border-radius:
      9px;

    padding:
      0
      10px;

    font-size:
      0.7rem;

    font-weight:
      650;
  }

  .admin-notification-shortcut {
    border-color:
      color-mix(
        in srgb,
        var(--auth-border)
        84%,
        transparent
      );

    background:
      color-mix(
        in srgb,
        var(--auth-bg-card)
        84%,
        transparent
      );
  }

  .admin-topbar-guard-shortcut {
    color:
      var(--auth-accent-strong);
  }

  .admin-topbar-status-chip {
    min-height:
      30px;

    gap:
      5px;

    border-radius:
      999px;

    padding:
      0
      9px;

    font-size:
      0.62rem;

    font-weight:
      650;

    letter-spacing:
      0;

    text-transform:
      none;
  }

  .admin-topbar-status-chip.is-online {
    border-color:
      color-mix(
        in srgb,
        var(--auth-success)
        18%,
        var(--auth-border)
      );

    background:
      color-mix(
        in srgb,
        var(--auth-success-soft)
        54%,
        var(--auth-bg-card)
      );
  }

  .admin-topbar-status-chip.is-offline {
    border-color:
      color-mix(
        in srgb,
        var(--auth-danger)
        28%,
        var(--auth-border)
      );

    background:
      var(--auth-danger-soft);
  }

  .admin-topbar-logout {
    border-color:
      transparent;

    background:
      transparent;

    color:
      var(--auth-text-muted);
  }

  .admin-topbar-logout:hover,
  .admin-topbar-logout:focus-visible {
    border-color:
      var(--auth-border);

    background:
      var(--auth-bg-soft);

    color:
      var(--auth-text-strong);
  }

  .admin-sidebar :focus-visible,
  .admin-topbar :focus-visible {
    outline:
      2px solid
      color-mix(
        in srgb,
        var(--auth-accent)
        70%,
        transparent
      );

    outline-offset:
      2px;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar {
    align-items:
      center;

    padding-inline:
      10px;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-brand {
    position:
      relative;

    width:
      100%;

    grid-template-columns:
      42px;

    justify-items:
      center;

    padding-inline:
      0;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-copy,
  .admin-shell.is-sidebar-collapsed
  .admin-nav-label,
  .admin-shell.is-sidebar-collapsed
  .admin-nav-section-label,
  .admin-shell.is-sidebar-collapsed
  .admin-account-copy {
    display:
      none;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-collapse {
    position:
      absolute;

    top:
      62px;

    left:
      50%;

    width:
      32px;

    min-width:
      32px;

    min-height:
      32px;

    border:
      1px solid
      var(--auth-border);

    background:
      var(--auth-bg-card);

    transform:
      translateX(-50%);

    z-index:
      2;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-nav {
    width:
      100%;

    margin-top:
      46px;

    padding-inline:
      0;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-nav-section {
    justify-items:
      center;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-nav-section +
  .admin-nav-section {
    width:
      42px;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-nav-item {
    width:
      42px;

    min-width:
      42px;

    min-height:
      42px;

    justify-content:
      center;

    padding:
      0;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-nav-item.is-active::before {
    left:
      3px;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-footer {
    width:
      100%;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-sidebar-account {
    width:
      42px;

    min-height:
      auto;

    display:
      grid;

    grid-template-columns:
      1fr;

    justify-items:
      center;

    gap:
      6px;

    border:
      0;

    background:
      transparent;

    padding:
      0;
  }

  .admin-shell.is-sidebar-collapsed
  .admin-account-avatar,
  .admin-shell.is-sidebar-collapsed
  .admin-account-logout {
    width:
      36px;

    height:
      36px;
  }
}

@media (min-width: 1280px) {
  .admin-shell {
    --admin-shell-desktop-gutter:
      32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-topbar-status-chip.is-offline {
    animation:
      none;
  }
}
`;

appendOnce({
  file:
    FILES.css,

  marker:
    CSS_MARKER,

  content:
    desktopCss,

  label:
    'desktop shell CSS',
});

/**
 * ============================================================
 * 5. UI-0 DESKTOP CONTRACT
 * ============================================================
 */

const contractSource = `import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  ADMIN_MOBILE_PRIMARY_KEYS,
} from '../src/config/adminNavigation.js';

assert.deepEqual(
  ADMIN_MOBILE_PRIMARY_KEYS,
  [
    'dashboard',
    'requests',
    'schedule',
    'billing',
  ],
  'UI-0A/B must preserve mobile primary IA.',
);

const adminPageSource =
  readFileSync(
    resolve(
      'src/pages/AdminPage.jsx',
    ),
    'utf8',
  );

assert.equal(
  adminPageSource.includes(
    'admin-route-loading'
  ),
  true,
  'Admin shell must expose the new route loading state.',
);

assert.equal(
  adminPageSource.includes(
    'Memuat {activeItem.title}'
  ),
  true,
);

const sidebarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminSidebar.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'data-admin-shell-ui="ui-0b-desktop"',
    'admin-sidebar-brand-eyebrow',
    'admin-sidebar-account',
    'admin-account-avatar',
    'admin-account-logout',
    'admin-nav-icon',
    'aria-expanded={',
  ]
) {
  assert.equal(
    sidebarSource.includes(
      required,
    ),
    true,
    'Desktop sidebar missing: ' +
      required,
  );
}

assert.equal(
  sidebarSource.includes(
    'AdminNotificationBadge'
  ),
  false,
  'Notifications must remain topbar-only.',
);

const topbarSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminTopbar.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'data-admin-shell-ui="ui-0b-desktop"',
    'activeItem.groupLabel',
    '/admin/notifications',
    'admin-topbar-guard-shortcut',
    'admin-topbar-status-chip',
    'admin-topbar-logout',
    'aria-live="polite"',
  ]
) {
  assert.equal(
    topbarSource.includes(
      required,
    ),
    true,
    'Desktop topbar missing: ' +
      required,
  );
}

assert.equal(
  topbarSource.includes(
    'style={{'
  ),
  false,
  'AdminTopbar must not contain inline visual styling.',
);

const bottomNavSource =
  readFileSync(
    resolve(
      'src/components/admin/AdminBottomNav.jsx',
    ),
    'utf8',
  );

for (
  const required
  of [
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    'admin-more-section-label',
    "event.key === 'Escape'",
  ]
) {
  assert.equal(
    bottomNavSource.includes(
      required,
    ),
    true,
    'Mobile baseline changed unexpectedly: ' +
      required,
  );
}

const cssSource =
  readFileSync(
    resolve(
      'src/styles/modules/admin-shell.css',
    ),
    'utf8',
  );

for (
  const required
  of [
    'UI-0A/B — Admin Shell Foundation + Desktop Overhaul',
    '--admin-sidebar-expanded:',
    '264px',
    '--admin-sidebar-collapsed:',
    '78px',
    '.admin-sidebar-account',
    '.admin-account-avatar',
    '.admin-route-loading',
    '.admin-topbar-guard-shortcut',
    '.admin-shell.is-sidebar-collapsed',
  ]
) {
  assert.equal(
    cssSource.includes(
      required,
    ),
    true,
    'Desktop shell CSS missing: ' +
      required,
  );
}

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'admin-shell-navigation-ux-test.mjs'
  ),
  true,
  'Existing Admin Shell contract must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'admin-shell-ui0-desktop-contract-test.mjs'
  ),
  true,
  'UI-0 desktop contract must be registered.',
);

process.stdout.write(
  '✅ Admin Shell UI-0A/B Desktop contract passed.\\n',
);
`;

stageExact(
  FILES.newContract,
  contractSource,
  'UI-0A/B desktop contract',
);

/**
 * ============================================================
 * 6. REGISTER CONTRACT
 * ============================================================
 */

let packageJson;

try {
  packageJson =
    JSON.parse(
      read(
        FILES.packageJson,
      ),
    );
} catch (error) {
  fail(
    'package.json invalid: ' +
      error.message,
  );
}

const oldGate =
  'node scripts/admin-shell-navigation-ux-test.mjs';

const newGate =
  'node scripts/admin-shell-ui0-desktop-contract-test.mjs';

const testCommands =
  String(
    packageJson
      ?.scripts
      ?.test ||
      '',
  )
    .split(
      '&&',
    )
    .map(
      (
        command,
      ) =>
        command.trim(),
    )
    .filter(
      Boolean,
    );

if (
  !testCommands.includes(
    oldGate,
  )
) {
  fail(
    'Existing shell contract hilang dari npm test.',
  );
}

if (
  !testCommands.includes(
    newGate,
  )
) {
  packageJson.scripts.test =
    [
      ...testCommands,
      newGate,
    ].join(
      ' && ',
    );

  stage(
    FILES.packageJson,
    JSON.stringify(
      packageJson,
      null,
      2,
    ) +
      '\n',
  );

  console.log(
    '✅ Staged: register UI-0A/B contract',
  );
} else {
  console.log(
    'ℹ️ UI-0A/B contract already registered.',
  );
}

/**
 * ============================================================
 * 7. FINAL VALIDATION
 * ============================================================
 */

const finalSidebar =
  read(
    FILES.sidebar,
  );

assertIncludes(
  finalSidebar,
  [
    'Admin Console',
    'admin-sidebar-brand-eyebrow',
    'admin-sidebar-account',
    'admin-account-avatar',
    'admin-account-logout',
    'admin-nav-icon',
    'aria-current={',
  ],
  'Sidebar final validation',
);

assertExcludes(
  finalSidebar,
  [
    'AdminNotificationBadge',
  ],
  'Sidebar final validation',
);

const finalTopbar =
  read(
    FILES.topbar,
  );

assertIncludes(
  finalTopbar,
  [
    'activeItem.groupLabel',
    '/admin/notifications',
    'admin-topbar-guard-shortcut',
    'admin-topbar-status-chip',
    'admin-topbar-logout',
    'aria-live="polite"',
  ],
  'Topbar final validation',
);

assertExcludes(
  finalTopbar,
  [
    'style={{',
  ],
  'Topbar final validation',
);

const finalAdminPage =
  read(
    FILES.adminPage,
  );

assertIncludes(
  finalAdminPage,
  [
    'admin-route-loading',
    'Memuat {activeItem.title}',
  ],
  'AdminPage final validation',
);

const finalCss =
  read(
    FILES.css,
  );

assertIncludes(
  finalCss,
  [
    CSS_MARKER,
    '--admin-sidebar-expanded:',
    '264px',
    '--admin-sidebar-collapsed:',
    '78px',
    '.admin-sidebar-account',
    '.admin-route-loading',
    '.admin-topbar-guard-shortcut',
  ],
  'CSS final validation',
);

const finalBottomNav =
  read(
    FILES.bottomNav,
  );

assertIncludes(
  finalBottomNav,
  [
    'groupMobileMoreItems',
    'admin-bottom-more-backdrop',
    "event.key === 'Escape'",
  ],
  'Mobile untouched guard',
);

/**
 * This phase must never modify these files.
 */
if (
  staged.has(
    FILES.bottomNav,
  )
) {
  fail(
    'AdminBottomNav tidak boleh diubah pada UI-0A/B.',
  );
}

if (
  staged.has(
    FILES.navigation,
  )
) {
  fail(
    'adminNavigation.js tidak boleh diubah pada UI-0A/B.',
  );
}

const firestoreRules =
  path.join(
    ROOT,
    'firestore.rules',
  );

if (
  staged.has(
    firestoreRules,
  )
) {
  fail(
    'firestore.rules tidak boleh diubah pada UI-0A/B.',
  );
}

/**
 * ============================================================
 * 8. WRITE LAST
 * ============================================================
 */

console.log('');
console.log(
  '✅ UI-0A/B validations passed.',
);
console.log(
  'Writing staged files...',
);
console.log('');

for (
  const [
    file,
    content,
  ]
  of staged.entries()
) {
  fs.mkdirSync(
    path.dirname(
      file,
    ),
    {
      recursive:
        true,
    },
  );

  fs.writeFileSync(
    file,
    content,
    'utf8',
  );

  console.log(
    '✅ Written: ' +
      path.relative(
        ROOT,
        file,
      ),
  );
}

console.log('');
console.log(
  '✅ UI-0A/B Admin Shell Desktop Overhaul prepared.',
);
console.log('');
console.log('Implemented:');
console.log('  Shell foundation ✓');
console.log('  Desktop Sidebar ✓');
console.log('  Desktop Topbar ✓');
console.log('  Account identity block ✓');
console.log('  Collapsed desktop shell ✓');
console.log('  Route loading state ✓');
console.log('');
console.log('Untouched:');
console.log('  Mobile Bottom Nav ✓');
console.log('  Mobile More ✓');
console.log('  Canonical IA ✓');
console.log('  Firestore rules ✓');
console.log('  Business logic ✓');
console.log('');
console.log(
  'Next after desktop QA: UI-0C Mobile Shell.',
);