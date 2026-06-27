function resolveAlbumTitle(selectedAlbum, categories) {
  if (selectedAlbum === 'all') return 'Semua Foto';
  if (selectedAlbum === 'favorites') return 'Favorit Saya';
  if (selectedAlbum === 'recents') return '8 Foto Terbaru';

  return categories.find((category) => category.value === selectedAlbum)?.label || 'Album';
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
      <div className="gallery-album-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <AlbumFolderCard
          title="Semua Foto"
          count={filteredActiveImages.length}
          coverUrl={filteredActiveImages[0]?.url}
          onClick={() => onSelectAlbum('all')}
          icon={ImageIcon}
        />

        <AlbumFolderCard
          title="Favorit Saya"
          count={filteredActiveImages.filter((img) => img.isFavorite).length}
          coverUrl={filteredActiveImages.find((img) => img.isFavorite)?.url}
          onClick={() => onSelectAlbum('favorites')}
          icon={HeartIcon}
          iconColor="text-red-400"
        />

        {categories.map((cat) => {
          const catImages = filteredActiveImages.filter((img) => img.category === cat.value);

          return (
            <AlbumFolderCard
              key={cat.value}
              title={cat.label}
              count={catImages.length}
              coverUrl={catImages[0]?.url}
              onClick={() => onSelectAlbum(cat.value)}
              icon={FolderIcon}
            />
          );
        })}

        <AlbumFolderCard
          title="Terbaru"
          count={Math.min(filteredActiveImages.length, 8)}
          coverUrl={filteredActiveImages[0]?.url}
          onClick={() => onSelectAlbum('recents')}
          icon={SparklesIcon}
          iconColor="text-orange-400"
        />

        <AlbumFolderCard
          title="Baru Dihapus"
          count={trashedImages.length}
          coverUrl={trashedImages[0]?.url}
          onClick={onOpenTrash}
          icon={TrashIcon}
          iconColor="text-red-400"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--auth-border)] pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectAlbum(null)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
          >
            <BackIcon size={14} />
          </button>
          <div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Album</span>
            <h3 className="text-sm font-bold text-white leading-tight">
              {resolveAlbumTitle(selectedAlbum, categories)}
            </h3>
          </div>
        </div>
        <span className="text-xs text-zinc-500 font-bold">{displayedImages.length} Foto</span>
      </div>

      {displayedImages.length === 0 ? (
        <EmptyGalleryState activeTab="albums_detail" />
      ) : (
        <div
          className="gallery-photo-grid grid gap-[2px] sm:gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          }}
        >
          {displayedImages.map((img, index) => (
            <PhotoCard
              key={img.id}
              categories={categories}
              img={img}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(img.id)}
              onSelectToggle={onSelectToggle}
              onCardClick={() => {
                if (isSelectMode) {
                  onSelectToggle(img.id);
                } else {
                  onOpenPhoto(index);
                }
              }}
              onFavoriteClick={() => onFavoriteClick(img)}
              onDeleteClick={() => onDeleteClick(img.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
