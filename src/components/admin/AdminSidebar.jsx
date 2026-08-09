import {
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
    /\b\w/g,
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
