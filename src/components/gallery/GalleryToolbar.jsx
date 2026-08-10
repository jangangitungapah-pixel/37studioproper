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
  const tabItems = [
    {
      key: 'photos',
      label: 'Photos',
      icon: ImageIcon,
    },
    {
      key: 'albums',
      label: 'Albums',
      icon: FolderIcon,
    },
    {
      key: 'trash',
      label: 'Trash',
      icon: TrashIcon,
    },
  ];

  return (
    <section
      className="gallery-command-shelf"
      aria-label="Perintah galeri"
    >
      <div className="gallery-command-search">
        <SearchIcon
          size={16}
          aria-hidden="true"
        />

        <input
          aria-label="Cari media gallery"
          placeholder="Cari judul, deskripsi, kategori, atau uploader"
          type="search"
          value={searchQuery}
          onChange={(event) =>
            onSearchChange(event.target.value)
          }
        />

        {searchQuery ? (
          <span className="gallery-search-state">
            Filtered
          </span>
        ) : null}
      </div>

      <div className="gallery-command-lower">
        <div
          className="gallery-primary-tabs"
          role="tablist"
          aria-label="Tampilan galeri"
        >
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
                className={
                  'gallery-clean-tab' +
                  (isActive ? ' is-active' : '')
                }
              >
                <Icon
                  size={14}
                  aria-hidden="true"
                />

                <span>{tab.label}</span>

                {tab.key === 'trash' &&
                trashCount > 0 ? (
                  <span className="gallery-trash-count">
                    {trashCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="gallery-command-actions">
          <label
            className="gallery-density-control"
            title="Kerapatan grid"
          >
            <GridIcon
              size={14}
              aria-hidden="true"
            />

            <span className="gallery-density-label">
              Density
            </span>

            <input
              type="range"
              min={2}
              max={6}
              value={gridColumns}
              onChange={(event) =>
                onGridColumnsChange(
                  parseInt(
                    event.target.value,
                    10,
                  ),
                )
              }
              aria-label="Kerapatan grid foto"
            />

            <strong>{gridColumns}</strong>
          </label>

          <button
            type="button"
            onClick={onToggleSelectMode}
            className={
              'gallery-command-button' +
              (isSelectMode
                ? ' is-active'
                : '')
            }
          >
            <CheckIcon
              size={14}
              aria-hidden="true"
            />

            <span>
              {isSelectMode
                ? 'Selesai pilih'
                : 'Pilih media'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="gallery-command-button is-primary"
          >
            <PlusIcon
              size={15}
              aria-hidden="true"
            />

            <span>Upload foto</span>
          </button>
        </div>
      </div>
    </section>
  );
}
