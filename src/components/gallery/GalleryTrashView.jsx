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
    <section className="gallery-trash-view">
      <header className="gallery-trash-header">
        <div className="gallery-trash-heading">
          <span
            className="gallery-trash-heading-icon"
            aria-hidden="true"
          >
            <TrashIcon size={17} />
          </span>

          <div>
            <small>Recycle bin</small>

            <h3>
              Media yang baru dihapus
            </h3>

            <p>
              Restore bila masih dibutuhkan,
              atau hapus permanen bila
              sudah final.
            </p>
          </div>
        </div>

        {displayedImages.length > 0 ? (
          <button
            type="button"
            onClick={onEmptyTrash}
            className="gallery-danger-button"
          >
            <TrashIcon
              size={13}
              aria-hidden="true"
            />

            <span>
              Kosongkan sampah
            </span>
          </button>
        ) : null}
      </header>

      {displayedImages.length === 0 ? (
        <EmptyGalleryState
          activeTab="trash"
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
                isDeletedTab={true}
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
                onRestoreClick={() =>
                  onRestoreClick(img.id)
                }
                onDeleteClick={() =>
                  onPermanentDeleteClick(
                    img.id,
                  )
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}
