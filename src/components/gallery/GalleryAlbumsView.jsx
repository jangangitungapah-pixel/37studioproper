function resolveAlbumTitle(
  selectedAlbum,
  categories,
) {
  if (selectedAlbum === 'all') {
    return 'Semua Foto';
  }

  if (selectedAlbum === 'favorites') {
    return 'Favorit Saya';
  }

  if (selectedAlbum === 'recents') {
    return '8 Foto Terbaru';
  }

  return (
    categories.find(
      (category) =>
        category.value === selectedAlbum,
    )?.label || 'Album'
  );
}

export default function GalleryAlbumsView({
  AlbumFolderCard,
  categories,
  displayedImages,
  EmptyGalleryState,
  filteredActiveImages,
  FolderIcon,
  gridColumns,
  HeartIcon,
  ImageIcon,
  isSelectMode,
  onDeleteClick,
  onFavoriteClick,
  onEditMetadata,
  onOpenPhoto,
  onOpenTrash,
  onSelectAlbum,
  onSelectToggle,
  PhotoCard,
  selectedAlbum,
  selectedIds,
  SparklesIcon,
  trashedImages,
  TrashIcon,
  BackIcon,
}) {
  if (selectedAlbum === null) {
    return (
      <section
        className="gallery-album-library"
        aria-label="Album gallery"
      >
        <div className="gallery-section-heading">
          <div>
            <small>Collections</small>
            <h3>Browse by album</h3>
          </div>

          <span>
            {filteredActiveImages.length}
            {' '}media aktif
          </span>
        </div>

        <div className="gallery-album-grid">
          <AlbumFolderCard
            title="Semua Foto"
            count={
              filteredActiveImages.length
            }
            coverUrl={
              filteredActiveImages[0]?.url
            }
            onClick={() =>
              onSelectAlbum('all')
            }
            icon={ImageIcon}
          />

          <AlbumFolderCard
            title="Favorit Saya"
            count={
              filteredActiveImages.filter(
                (img) => img.isFavorite,
              ).length
            }
            coverUrl={
              filteredActiveImages.find(
                (img) => img.isFavorite,
              )?.url
            }
            onClick={() =>
              onSelectAlbum('favorites')
            }
            icon={HeartIcon}
          />

          {categories.map((cat) => {
            const catImages =
              filteredActiveImages.filter(
                (img) =>
                  img.category === cat.value,
              );

            return (
              <AlbumFolderCard
                key={cat.value}
                title={cat.label}
                count={catImages.length}
                coverUrl={
                  catImages[0]?.url
                }
                onClick={() =>
                  onSelectAlbum(cat.value)
                }
                icon={FolderIcon}
              />
            );
          })}

          <AlbumFolderCard
            title="Terbaru"
            count={Math.min(
              filteredActiveImages.length,
              8,
            )}
            coverUrl={
              filteredActiveImages[0]?.url
            }
            onClick={() =>
              onSelectAlbum('recents')
            }
            icon={SparklesIcon}
          />

          <AlbumFolderCard
            title="Baru Dihapus"
            count={trashedImages.length}
            coverUrl={trashedImages[0]?.url}
            onClick={onOpenTrash}
            icon={TrashIcon}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="gallery-album-detail">
      <header className="gallery-album-detail-header">
        <button
          type="button"
          onClick={() =>
            onSelectAlbum(null)
          }
          className="gallery-back-button"
          aria-label="Kembali ke daftar album"
        >
          <BackIcon
            size={15}
            aria-hidden="true"
          />
        </button>

        <div>
          <small>Album</small>

          <h3>
            {resolveAlbumTitle(
              selectedAlbum,
              categories,
            )}
          </h3>
        </div>

        <span>
          {displayedImages.length} foto
        </span>
      </header>

      {displayedImages.length === 0 ? (
        <EmptyGalleryState
          activeTab="albums_detail"
        />
      ) : (
        <div
          className="gallery-photo-grid"
          style={{
            gridTemplateColumns:
              'repeat(' +
              gridColumns +
              ', minmax(0, 1fr))',
          }}
        >
          {displayedImages.map(
            (img, index) => (
              <PhotoCard
                key={img.id}
                categories={categories}
                img={img}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(
                  img.id,
                )}
                onSelectToggle={
                  onSelectToggle
                }
                onCardClick={() => {
                  if (isSelectMode) {
                    onSelectToggle(img.id);
                  } else {
                    onOpenPhoto(index);
                  }
                }}
                onFavoriteClick={() =>
                  onFavoriteClick(img)
                }
                onEditMetadata={() =>
                  onEditMetadata(img)
                }
                onDeleteClick={() =>
                  onDeleteClick(img.id)
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}
