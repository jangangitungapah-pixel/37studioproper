import { useState } from 'react';
import { Menu, X as CloseIcon } from 'lucide-react';

export default function GalleryToolbar({
  activeTab,
  CheckIcon,
  FolderIcon,
  GridIcon,
  gridColumns,
  ImageIcon,
  isSelectMode,
  onGridColumnsChange,
  onOpenUpload,
  onSearchChange,
  onTabChange,
  onToggleSelectMode,
  PlusIcon,
  searchQuery,
  SearchIcon,
  trashCount,
  TrashIcon,
}) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const tabItems = [
    { key: 'photos', label: 'Photos', icon: ImageIcon },
    { key: 'albums', label: 'Albums', icon: FolderIcon },
    { key: 'trash', label: 'Trash', icon: TrashIcon },
  ];

  const closeActionMenu = () => {
    setIsActionMenuOpen(false);
  };

  const handleTabChange = (tabKey) => {
    closeActionMenu();
    onTabChange(tabKey);
  };

  const handleOpenUpload = () => {
    closeActionMenu();
    onOpenUpload();
  };

  const handleToggleSelectMode = () => {
    closeActionMenu();
    onToggleSelectMode();
  };

  return (
    <section className="customer-toolbar gallery-toolbar gallery-clean-toolbar" aria-label="Toolbar galeri">
      <div className="gallery-clean-topbar">
        <div className="customer-search-shell gallery-clean-search">
          <SearchIcon size={14} aria-hidden="true" />
          <input
            aria-label="Cari foto"
            placeholder="Search"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="gallery-mobile-action-shell">
          <button
            type="button"
            className={`gallery-mobile-action-toggle ${isActionMenuOpen ? 'is-open' : ''}`}
            aria-expanded={isActionMenuOpen}
            onClick={() => setIsActionMenuOpen((current) => !current)}
            title="Gallery actions"
          >
            {isActionMenuOpen ? <CloseIcon size={15} /> : <Menu size={15} />}
            <span className="gallery-action-label">Actions</span>
          </button>

          {isActionMenuOpen ? (
            <div className="gallery-action-popover" role="menu" aria-label="Gallery actions">
              <button
                type="button"
                onClick={handleToggleSelectMode}
                className={isSelectMode ? 'is-active' : ''}
                role="menuitem"
              >
                <CheckIcon size={14} />
                <span>{isSelectMode ? 'Done' : 'Select'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenUpload}
                role="menuitem"
              >
                <PlusIcon size={14} />
                <span>Upload</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="gallery-filter-row gallery-primary-tabs" role="tablist" aria-label="Filter tampilan galeri">
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`gallery-filter-pill gallery-clean-tab ${isActive ? 'is-active' : ''}`}
              aria-pressed={isActive}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              {tab.key === 'trash' && trashCount > 0 ? (
                <span className="gallery-trash-count">
                  {trashCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="gallery-desktop-actions">
        <div className="gallery-density-control">
          <GridIcon size={13} />
          <input
            type="range"
            min={2}
            max={6}
            value={gridColumns}
            onChange={(event) => onGridColumnsChange(parseInt(event.target.value, 10))}
            title="Kerapatan Grid"
          />
          <span>{gridColumns}x</span>
        </div>

        <button
          type="button"
          onClick={handleToggleSelectMode}
          className={isSelectMode ? 'is-active' : ''}
        >
          <CheckIcon size={14} />
          <span>{isSelectMode ? 'Done' : 'Select'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenUpload}
        >
          <PlusIcon size={14} />
          <span>Upload</span>
        </button>
      </div>
    </section>
  );
}
