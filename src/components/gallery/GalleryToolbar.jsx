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
  const actionMenuId = 'gallery-mobile-action-menu';

  const tabItems = [
    { key: 'photos', label: 'Foto', icon: ImageIcon },
    { key: 'albums', label: 'Album', icon: FolderIcon },
    { key: 'trash', label: 'Sampah', icon: TrashIcon },
  ];

  const closeActionMenu = () => {
    setIsActionMenuOpen(false);
  };

  const handleTabChange = (tabKey) => {
    setIsActionMenuOpen(false);
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
    <section className="customer-toolbar gallery-toolbar" aria-label="Toolbar galeri">
      <div className="customer-search-shell">
        <SearchIcon size={16} aria-hidden="true" />
        <input
          aria-label="Cari foto"
          placeholder="Cari judul, deskripsi, uploader..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
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
              className={`gallery-filter-pill ${isActive ? 'is-active' : ''}`}
              aria-pressed={isActive}
            >
              <Icon size={14} />
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

      <div className="gallery-mobile-action-shell">
        <button
          type="button"
          className={`gallery-mobile-action-toggle ${isActionMenuOpen ? 'is-open' : ''}`}
          aria-expanded={isActionMenuOpen}
          aria-controls={actionMenuId}
          onClick={() => setIsActionMenuOpen((current) => !current)}
        >
          {isActionMenuOpen ? <CloseIcon size={14} /> : <Menu size={14} />}
          <span>Aksi</span>
        </button>
      </div>

      <div
        id={actionMenuId}
        className={`gallery-actions flex items-center gap-2 w-full sm:w-auto justify-end ${isActionMenuOpen ? 'is-open' : ''}`}
      >
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--auth-border)] bg-[var(--auth-bg-control)] text-xs text-[var(--auth-text-muted)] mr-2">
          <GridIcon size={13} className="text-zinc-500" />
          <input
            type="range"
            min={2}
            max={6}
            value={gridColumns}
            onChange={(event) => onGridColumnsChange(parseInt(event.target.value, 10))}
            className="w-16 accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800"
            title="Kerapatan Grid"
          />
          <span className="text-[10px] font-bold text-zinc-400 w-4">{gridColumns}x</span>
        </div>

        <button
          type="button"
          onClick={handleToggleSelectMode}
          className={`customer-back-button ${isSelectMode ? 'border-orange-500 text-orange-400' : ''}`}
        >
          <CheckIcon size={14} />
          <span>{isSelectMode ? 'Selesai' : 'Pilih'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenUpload}
          className="customer-add-button"
        >
          <PlusIcon size={16} />
          <span>Unggah Foto</span>
        </button>
      </div>
    </section>
  );
}
