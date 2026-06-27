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
  categories,
  timelineGroups,
}) {
  return (
    <div className="space-y-4">
      {timelineGroups.length === 0 ? (
        <EmptyGalleryState activeTab="photos" />
      ) : (
        timelineGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="sticky top-0 z-20 py-2 bg-gradient-to-b from-[var(--ui-bg-page)] via-[var(--ui-bg-page)]/90 to-transparent">
              <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-1 h-3 bg-orange-500 rounded-full" />
                <span>{group.title}</span>
                <span className="text-[9px] text-zinc-500 font-medium">({group.items.length} Foto)</span>
              </h3>
            </div>

            <div
              className="gallery-photo-grid grid gap-[2px] sm:gap-[3px]"
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
