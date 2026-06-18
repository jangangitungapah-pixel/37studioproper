export default function GalleryTimelineView({
  displayedImages,
  EmptyGalleryState,
  gridColumns,
  isSelectMode,
  onDeleteClick,
  onFavoriteClick,
  onOpenPhoto,
  onSelectToggle,
  PhotoCard,
  selectedIds,
  selectedCategoryFilter,
  categories,
  onCategoryFilterChange,
  timelineGroups,
}) {
  return (
    <div className="space-y-6">
      <div className="gallery-category-row gallery-filter-row">
        <button
          onClick={() => onCategoryFilterChange('All')}
          className={`gallery-filter-pill ${selectedCategoryFilter === 'All' ? 'is-active' : ''}`}
        >
          Semua Kategori
        </button>
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryFilterChange(cat.value)}
            className={`gallery-filter-pill ${selectedCategoryFilter === cat.value ? 'is-active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {timelineGroups.length === 0 ? (
        <EmptyGalleryState activeTab="photos" />
      ) : (
        timelineGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <div className="sticky top-0 z-20 py-2.5 bg-gradient-to-b from-[var(--ui-bg-page)] via-[var(--ui-bg-page)]/90 to-transparent">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2.5">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full" />
                <span>{group.title}</span>
                <span className="text-[10px] text-zinc-500 font-medium">({group.items.length} Foto)</span>
              </h3>
            </div>

            <div
              className="gallery-photo-grid grid gap-4 sm:gap-5"
              style={{
                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
              }}
            >
              {group.items.map((img) => {
                const originalIndex = displayedImages.findIndex((item) => item.id === img.id);

                return (
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
                        onOpenPhoto(originalIndex);
                      }
                    }}
                    onFavoriteClick={() => onFavoriteClick(img)}
                    onDeleteClick={() => onDeleteClick(img.id)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
