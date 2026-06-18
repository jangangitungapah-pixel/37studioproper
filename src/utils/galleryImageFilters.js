export function getFilteredActiveImages(rawImages = []) {
  return rawImages.filter((img) => !img.isDeleted);
}

export function getTrashedGalleryImages(rawImages = []) {
  return rawImages.filter((img) => img.isDeleted);
}

export function getDisplayedGalleryImages({
  activeTab,
  filteredActiveImages = [],
  searchQuery = '',
  selectedAlbum,
  selectedCategoryFilter,
  trashedImages = [],
}) {
  let list = [...filteredActiveImages];

  if (activeTab === 'albums' && selectedAlbum) {
    if (selectedAlbum === 'favorites') {
      list = list.filter((img) => img.isFavorite);
    } else if (selectedAlbum === 'recents') {
      list = list.slice(0, 8);
    } else {
      list = list.filter((img) => img.category === selectedAlbum);
    }
  } else if (activeTab === 'trash') {
    list = [...trashedImages];
  } else if (selectedCategoryFilter !== 'All') {
    list = list.filter((img) => img.category === selectedCategoryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();

    list = list.filter((img) =>
      (img.title && img.title.toLowerCase().includes(q)) ||
      (img.description && img.description.toLowerCase().includes(q)) ||
      (img.category && img.category.toLowerCase().includes(q)) ||
      (img.uploadedBy && img.uploadedBy.toLowerCase().includes(q))
    );
  }

  return list;
}

export function getGalleryTimelineGroups(displayedImages = [], activeTab) {
  if (activeTab !== 'photos') return [];

  const groups = {};

  displayedImages.forEach((img) => {
    const date = new Date(img.createdAt);
    const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }

    groups[monthYear].push(img);
  });

  return Object.keys(groups).map((monthYear) => ({
    title: monthYear,
    items: groups[monthYear],
  }));
}
