import {
  LogOut,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import {
  motion,
} from 'motion/react';

import StudioTooltip from '../ui/StudioTooltip.jsx';

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

function getCollapseLabel(
  isSidebarCollapsed,
) {
  return isSidebarCollapsed
    ? 'Buka navigation rail'
    : 'Tutup navigation rail';
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

  const collapseLabel =
    getCollapseLabel(
      isSidebarCollapsed,
    );

  return (
    <aside
      aria-label="Navigasi admin desktop"
      className="admin-sidebar"
      data-admin-shell-ui="ui-0b-desktop"
      data-admin-spatial-rail="ui-0b"
      data-collapsed={
        isSidebarCollapsed
          ? 'true'
          : 'false'
      }
    >
      <div className="admin-sidebar-brand">
        <div
          aria-hidden="true"
          className="admin-sidebar-logo"
        >
          <span className="admin-sidebar-logo-halo" />

          <Music2
            size={20}
            strokeWidth={2.15}
          />
        </div>

        <div className="admin-sidebar-copy">
          <span className="admin-sidebar-brand-eyebrow">
            37 Music
          </span>

          <strong>
            Studio Ops
          </strong>
        </div>

        <StudioTooltip
          content={
            isSidebarCollapsed
              ? collapseLabel
              : null
          }
          side="right"
          sideOffset={10}
        >
          <button
            aria-expanded={
              !isSidebarCollapsed
            }
            aria-label={
              collapseLabel
            }
            className="admin-sidebar-collapse"
            title={
              isSidebarCollapsed
                ? undefined
                : collapseLabel
            }
            type="button"
            onClick={
              toggleSidebar
            }
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen
                size={17}
                strokeWidth={2}
              />
            ) : (
              <PanelLeftClose
                size={17}
                strokeWidth={2}
              />
            )}
          </button>
        </StudioTooltip>
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

              <div className="admin-nav-section-items">
                {section.items.map(
                  (
                    item,
                  ) => {
                    const Icon =
                      item.icon;

                    const isActive =
                      activeItem.key ===
                      item.key;

                    const navigationButton = (
                      <button
                        aria-current={
                          isActive
                            ? 'page'
                            : undefined
                        }
                        aria-label={
                          isSidebarCollapsed
                            ? item.label
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
                        type="button"
                        onClick={() =>
                          goTo(
                            item.path,
                          )
                        }
                      >
                        {isActive ? (
                          <motion.span
                            aria-hidden="true"
                            className="admin-nav-active-plate"
                            layoutId="admin-nav-active-plate"
                            transition={{
                              type:
                                'spring',

                              stiffness:
                                470,

                              damping:
                                38,

                              mass:
                                0.7,
                            }}
                          />
                        ) : null}

                        <span
                          aria-hidden="true"
                          className="admin-nav-icon"
                        >
                          <Icon
                            size={18}
                            strokeWidth={
                              isActive
                                ? 2.25
                                : 1.9
                            }
                          />
                        </span>

                        <span className="admin-nav-label">
                          {item.label}
                        </span>

                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className="admin-nav-active-dot"
                          />
                        ) : null}
                      </button>
                    );

                    return (
                      <StudioTooltip
                        content={
                          isSidebarCollapsed
                            ? item.label
                            : null
                        }
                        key={
                          item.key
                        }
                        side="right"
                        sideOffset={12}
                      >
                        {navigationButton}
                      </StudioTooltip>
                    );
                  },
                )}
              </div>
            </div>
          ),
        )}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-account">
          <StudioTooltip
            content={
              isSidebarCollapsed
                ? accountName
                : null
            }
            side="right"
            sideOffset={12}
          >
            <span
              aria-hidden="true"
              className="admin-account-avatar"
            >
              {getAccountInitial(
                user,
              )}
            </span>
          </StudioTooltip>

          <span className="admin-account-copy">
            <strong>
              {accountName}
            </strong>

            <small>
              {accountRole}
            </small>
          </span>

          <StudioTooltip
            content="Keluar"
            side="right"
            sideOffset={12}
          >
            <button
              aria-label="Keluar dari Admin Portal"
              className="admin-account-logout"
              type="button"
              onClick={
                onLogout
              }
            >
              <LogOut
                size={16}
                strokeWidth={2}
              />
            </button>
          </StudioTooltip>
        </div>
      </div>
    </aside>
  );
}
