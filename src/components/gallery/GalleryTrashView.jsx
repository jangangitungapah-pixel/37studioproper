export default function GalleryTrashView({
  categories,
  displayedImages,
  EmptyGalleryState,
  gridColumns,
  isSelectMode,
  onEmptyTrash,
  onOpenPhoto,
  onPermanentDeleteClick,
  onRestoreClick,
  onSelectToggle,
  PhotoCard,
  selectedIds,
  TrashIcon,
}) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-[var(--auth-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <TrashIcon size={16} className="text-red-400" />
            <span>Baru Dihapus (Recycle Bin)</span>
          </h4>
          <p className="text-xs text-[var(--ui-text-muted)]">
            Foto di bawah telah dihapus dari galeri publik. Anda dapat memulihkannya atau menghapusnya secara permanen.
          </p>
        </div>

        {displayedImages.length > 0 ? (
          <button
            onClick={onEmptyTrash}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-xs font-bold transition-all"
          >
            <TrashIcon size={13} />
            <span>KOSONGKAN SAMPAH</span>
          </button>
        ) : null}
      </div>

      {displayedImages.length === 0 ? (
        <EmptyGalleryState activeTab="trash" />
      ) : (
        <div
          className="gallery-photo-grid grid gap-4 sm:gap-5"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          }}
        >
          {displayedImages.map((img, index) => (
            <PhotoCard
              key={img.id}
              categories={categories}
              img={img}
              isDeletedTab={true}
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
              onRestoreClick={() => onRestoreClick(img.id)}
              onDeleteClick={() => onPermanentDeleteClick(img.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
