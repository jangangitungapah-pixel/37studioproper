import { useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

function groupMobileMoreItems(items = []) {
  return items.reduce(
    (sections, item) => {
      const sectionKey =
        item.group ||
        'single:' + item.key;

      let section =
        sections.find(
          (candidate) =>
            candidate.key ===
            sectionKey,
        );

      if (!section) {
        section = {
          key: sectionKey,
          label:
            item.groupLabel ||
            (
              item.key === 'settings'
                ? 'System'
                : 'Lainnya'
            ),
          items: [],
        };

        sections.push(section);
      }

      section.items.push(item);

      return sections;
    },
    [],
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
}) {
  const moreSections =
    groupMobileMoreItems(
      mobileMoreNavItems,
    );

  useEffect(() => {
    if (
      !isMoreMenuOpen ||
      typeof window === 'undefined'
    ) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    isMoreMenuOpen,
    setIsMoreMenuOpen,
  ]);

  return (
    <>
      {isMoreMenuOpen ? (
        <button
          aria-label="Tutup menu lainnya"
          className="admin-bottom-more-backdrop"
          type="button"
          onClick={() =>
            setIsMoreMenuOpen(false)
          }
        />
      ) : null}

      <nav
        className="admin-bottom-nav"
        aria-label="Navigasi admin mobile"
      >
        {mobilePrimaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeItem.key === item.key;

          return (
            <button
              aria-current={
                isActive
                  ? 'page'
                  : undefined
              }
              className={
                isActive
                  ? 'admin-bottom-item is-active'
                  : 'admin-bottom-item'
              }
              key={item.key}
              type="button"
              onClick={() =>
                goTo(item.path)
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div
          className={
            isMoreMenuOpen
              ? 'admin-bottom-more is-open'
              : 'admin-bottom-more'
          }
        >
          {isMoreMenuOpen ? (
            <div
              className="admin-bottom-more-menu"
              role="menu"
              aria-label="Menu admin tambahan"
            >
              <div className="admin-bottom-more-header">
                <strong>
                  Menu lainnya
                </strong>

                <span>
                  {mobileMoreNavItems.length} menu
                </span>
              </div>

              {moreSections.map((section) => (
                <div
                  className="admin-more-section"
                  key={section.key}
                >
                  <span className="admin-more-section-label">
                    {section.label}
                  </span>

                  <div className="admin-more-grid">
                    {section.items.map((item) => {
                      const Icon = item.icon;
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
                          key={item.key}
                          role="menuitem"
                          type="button"
                          onClick={() =>
                            goTo(item.path)
                          }
                        >
                          <Icon size={17} />

                          <span>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <button
            aria-expanded={isMoreMenuOpen}
            aria-haspopup="menu"
            className={
              isMoreNavActive ||
              isMoreMenuOpen
                ? 'admin-bottom-item is-active'
                : 'admin-bottom-item'
            }
            title={
              isMoreMenuOpen
                ? 'Tutup menu lainnya'
                : 'Buka menu lainnya'
            }
            type="button"
            onClick={() =>
              setIsMoreMenuOpen(
                (current) => !current,
              )
            }
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
