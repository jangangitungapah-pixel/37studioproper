import {
  useEffect,
} from 'react';

import {
  LogOut,
  MoreHorizontal,
  X,
} from 'lucide-react';

import {
  Dialog,
} from 'radix-ui';

function groupMobileMoreItems(
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
            (
              item.key ===
                'settings'
                ? 'System'
                : 'Lainnya'
            ),

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
      .charAt(
        0,
      )
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

export default function AdminBottomNav({
  mobilePrimaryNavItems,
  activeItem,
  goTo,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
  mobileMoreNavItems,
  isMoreNavActive,
  user,
  onLogout,
}) {
  const moreSections =
    groupMobileMoreItems(
      mobileMoreNavItems,
    );

  const accountName =
    user?.displayName ||
    user?.email ||
    'Admin';

  const accountRole =
    getAccountRoleLabel(
      user,
    );

  useEffect(() => {
    if (
      !isMoreMenuOpen ||
      typeof window ===
        'undefined' ||
      !window.matchMedia
    ) {
      return undefined;
    }

    const desktopMedia =
      window.matchMedia(
        '(min-width: 768px)',
      );

    function closeSheetOnDesktop(
      event,
    ) {
      if (
        event.matches
      ) {
        setIsMoreMenuOpen(
          false,
        );
      }
    }

    desktopMedia.addEventListener?.(
      'change',
      closeSheetOnDesktop,
    );

    return () => {
      desktopMedia.removeEventListener?.(
        'change',
        closeSheetOnDesktop,
      );
    };
  }, [
    isMoreMenuOpen,
    setIsMoreMenuOpen,
  ]);

  function openRoute(
    path,
  ) {
    setIsMoreMenuOpen(
      false,
    );

    goTo(
      path,
    );
  }

  async function handleMobileLogout() {
    setIsMoreMenuOpen(
      false,
    );

    if (
      typeof onLogout ===
      'function'
    ) {
      await onLogout();
    }
  }

  return (
    <Dialog.Root
      modal={true}
      open={
        isMoreMenuOpen
      }
      onOpenChange={
        setIsMoreMenuOpen
      }
    >
      <nav
        aria-label="Navigasi admin mobile"
        className="admin-bottom-nav"
        data-admin-mobile-dock="ui-0d"
      >
        {mobilePrimaryNavItems.map(
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
                aria-label={
                  item.label
                }
                className={
                  isActive
                    ? 'admin-bottom-item is-active'
                    : 'admin-bottom-item'
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
                <span
                  aria-hidden="true"
                  className="admin-mobile-nav-icon"
                >
                  <Icon
                    size={19}
                    strokeWidth={
                      isActive
                        ? 2.2
                        : 1.9
                    }
                  />
                </span>

                <span className="admin-mobile-nav-label">
                  {item.label}
                </span>
              </button>
            );
          },
        )}

        <div className="admin-bottom-more">
          <Dialog.Trigger
            asChild
          >
            <button
              aria-expanded={
                isMoreMenuOpen
              }
              aria-haspopup="dialog"
              aria-label={
                isMoreMenuOpen
                  ? 'Tutup menu lainnya'
                  : 'Buka menu lainnya'
              }
              className={
                isMoreNavActive ||
                isMoreMenuOpen
                  ? 'admin-bottom-item is-active'
                  : 'admin-bottom-item'
              }
              title="Menu lainnya"
              type="button"
            >
              <span
                aria-hidden="true"
                className="admin-mobile-nav-icon"
              >
                <MoreHorizontal
                  size={19}
                  strokeWidth={2}
                />
              </span>

              <span className="admin-mobile-nav-label">
                More
              </span>
            </button>
          </Dialog.Trigger>
        </div>
      </nav>

      <Dialog.Portal>
        <Dialog.Overlay
          className="admin-bottom-more-backdrop admin-mobile-more-overlay"
        />

        <Dialog.Content
          aria-describedby="admin-mobile-more-description"
          className="admin-bottom-more-menu admin-mobile-more-sheet"
        >
          <span
            aria-hidden="true"
            className="admin-mobile-sheet-handle"
          />

          <header className="admin-mobile-more-header">
            <div className="admin-mobile-more-heading">
              <Dialog.Title
                asChild
              >
                <h2>
                  Menu lainnya
                </h2>
              </Dialog.Title>

              <Dialog.Description
                asChild
              >
                <p id="admin-mobile-more-description">
                  Akses cepat ke seluruh workspace admin yang tersedia.
                </p>
              </Dialog.Description>
            </div>

            <Dialog.Close
              asChild
            >
              <button
                aria-label="Tutup menu lainnya"
                className="admin-mobile-sheet-close"
                type="button"
              >
                <X
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2}
                />
              </button>
            </Dialog.Close>
          </header>

          <div className="admin-mobile-more-scroll">
            {moreSections.length ? (
              moreSections.map(
                (
                  section,
                ) => (
                  <section
                    className="admin-more-section"
                    key={
                      section.key
                    }
                  >
                    <span className="admin-more-section-label">
                      {section.label}
                    </span>

                    <div className="admin-more-grid">
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
                                  ? 'admin-more-item is-active'
                                  : 'admin-more-item'
                              }
                              key={
                                item.key
                              }
                              type="button"
                              onClick={() =>
                                openRoute(
                                  item.path,
                                )
                              }
                            >
                              <span
                                aria-hidden="true"
                                className="admin-more-item-icon"
                              >
                                <Icon
                                  size={17}
                                  strokeWidth={
                                    isActive
                                      ? 2.2
                                      : 1.9
                                  }
                                />
                              </span>

                              <span>
                                {item.label}
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>
                ),
              )
            ) : (
              <div className="admin-mobile-more-empty">
                Tidak ada menu tambahan untuk akun ini.
              </div>
            )}
          </div>

          <footer className="admin-mobile-account">
            <span
              aria-hidden="true"
              className="admin-mobile-account-avatar"
            >
              {getAccountInitial(
                user,
              )}
            </span>

            <span className="admin-mobile-account-copy">
              <strong>
                {accountName}
              </strong>

              <small>
                {accountRole}
              </small>
            </span>

            <button
              aria-label="Keluar dari Admin Portal"
              className="admin-mobile-logout"
              type="button"
              onClick={
                handleMobileLogout
              }
            >
              <LogOut
                aria-hidden="true"
                size={17}
                strokeWidth={2}
              />

              <span>
                Keluar
              </span>
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
