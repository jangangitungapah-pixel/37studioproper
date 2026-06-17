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
  const hasSelection = selectedCount > 0;
  const isAllSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onSelectAll}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10"
        >
          {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
        </button>
        <span className="text-xs font-bold text-white">
          {selectedCount} file terpilih
        </span>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {activeTab !== 'trash' ? (
          <>
            <button
              onClick={onBatchFavorite}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/20 disabled:opacity-40 transition-all"
            >
              <FavoriteIcon size={13} className="fill-current" />
              <span>Favoritkan</span>
            </button>
            <button
              onClick={onBatchSoftDelete}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 disabled:opacity-40 transition-all"
            >
              <TrashIcon size={13} />
              <span>Buang ke Sampah</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onBatchRestore}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 disabled:opacity-40 transition-all"
            >
              <RefreshIcon size={13} />
              <span>Pulihkan</span>
            </button>
            <button
              onClick={onBatchPermanentDelete}
              disabled={!hasSelection}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 disabled:opacity-40 transition-all"
            >
              <TrashPermanentIcon size={13} />
              <span>Hapus Permanen</span>
            </button>
          </>
        )}
        <button
          onClick={onCancelSelectMode}
          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
