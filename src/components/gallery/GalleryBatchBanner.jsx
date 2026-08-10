export default function GalleryBatchBanner({
  activeTab,
  FavoriteIcon,
  onBatchFavorite,
  onBatchPermanentDelete,
  onBatchRestore,
  onBatchSoftDelete,
  onCancelSelectMode,
  onSelectAll,
  RefreshIcon,
  selectedCount,
  totalCount,
  TrashIcon,
  TrashPermanentIcon,
}) {
  const hasSelection =
    selectedCount > 0;

  const isAllSelected =
    totalCount > 0 &&
    selectedCount === totalCount;

  return (
    <div className="gallery-batch-banner">
      <div className="gallery-batch-context">
        <button
          type="button"
          onClick={onSelectAll}
          className="gallery-batch-select-all"
        >
          {isAllSelected
            ? 'Batalkan semua'
            : 'Pilih semua'}
        </button>

        <div>
          <strong>
            {selectedCount} media
          </strong>

          <small>
            terpilih dari {totalCount}
          </small>
        </div>
      </div>

      <div className="gallery-batch-actions">
        {activeTab !== 'trash' ? (
          <>
            <button
              type="button"
              onClick={onBatchFavorite}
              disabled={!hasSelection}
              className="is-attention"
            >
              <FavoriteIcon
                size={13}
                aria-hidden="true"
              />

              <span>Favoritkan</span>
            </button>

            <button
              type="button"
              onClick={onBatchSoftDelete}
              disabled={!hasSelection}
              className="is-danger"
            >
              <TrashIcon
                size={13}
                aria-hidden="true"
              />

              <span>Buang</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onBatchRestore}
              disabled={!hasSelection}
              className="is-success"
            >
              <RefreshIcon
                size={13}
                aria-hidden="true"
              />

              <span>Pulihkan</span>
            </button>

            <button
              type="button"
              onClick={
                onBatchPermanentDelete
              }
              disabled={!hasSelection}
              className="is-danger"
            >
              <TrashPermanentIcon
                size={13}
                aria-hidden="true"
              />

              <span>
                Hapus permanen
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onCancelSelectMode}
          className="gallery-batch-cancel"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
