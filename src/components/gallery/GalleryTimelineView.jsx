export default function GalleryTimelineView({
  displayedImages,
  EmptyGalleryState,
  gridColumns,
  isSelectMode,
  onDeleteClick,
  onFavoriteClick,
  onEditMetadata,
  onOpenPhoto,
  onSelectToggle,
  PhotoCard,
  selectedIds,
  categories,
  timelineGroups,
}) {
  if (timelineGroups.length === 0) {
    return (
      <EmptyGalleryState activeTab="photos" />
    );
  }

  return (
    <div className="gallery-timeline">
      {timelineGroups.map((group) => (
        <section
          key={group.title}
          className="gallery-timeline-group"
        >
          <header className="gallery-timeline-heading">
            <div>
              <span
                className="gallery-timeline-marker"
                aria-hidden="true"
              />

              <h3>{group.title}</h3>
            </div>

            <small>
              {group.items.length} foto
            </small>
          </header>

          <div
            className="gallery-photo-grid"
            style={{
              gridTemplateColumns:
                'repeat(' +
                gridColumns +
                ', minmax(0, 1fr))',
            }}
          >
            {group.items.map((img) => {
              const originalIndex =
                displayedImages.findIndex(
                  (item) => item.id === img.id,
                );

              return (
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
                      onOpenPhoto(
                        originalIndex,
                      );
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
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
