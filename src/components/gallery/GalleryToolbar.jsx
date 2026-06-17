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
  trashCount,
  TrashIcon,
}) {
  const tabItems = [
    { key: 'photos', label: 'Foto', icon: ImageIcon },
    { key: 'albums', label: 'Album', icon: FolderIcon },
    { key: 'trash', label: 'Sampah', icon: TrashIcon },
  ];

  return (
    <section className="customer-toolbar gallery-toolbar" aria-label="Toolbar galeri">
      <div className="customer-search-shell">
        <GridIcon size={0} aria-hidden="true" style={{ display: 'none' }} />
        <span aria-hidden="true" className="gallery-toolbar-search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          aria-label="Cari foto"
          placeholder="Cari judul, deskripsi, uploader..."
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="gallery-filter-row">
        {tabItems.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`gallery-filter-pill ${isActive ? 'is-active' : ''}`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.key === 'trash' && trashCount > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                  {trashCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="gallery-actions flex items-center gap-2 w-full sm:w-auto justify-end">
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
          onClick={onToggleSelectMode}
          className={`customer-back-button ${isSelectMode ? 'border-orange-500 text-orange-400' : ''}`}
        >
          <CheckIcon size={14} />
          <span>{isSelectMode ? 'Selesai' : 'Pilih'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenUpload}
          className="customer-add-button"
        >
          <PlusIcon size={16} />
          Unggah Foto
        </button>
      </div>
    </section>
  );
}
