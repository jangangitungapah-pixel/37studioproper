export default function GalleryHero({
  activeCount,
  favoriteCount,
  HeartIcon,
  ImageIcon,
  trashCount,
  TrashIcon,
}) {
  return (
    <section className="gallery-hero-grid" aria-label="Ringkasan galeri">
      <div className="gallery-stat-card">
        <span className="gallery-stat-icon">
          <ImageIcon size={16} />
        </span>
        <div className="gallery-stat-copy">
          <small>Total Foto</small>
          <strong>{activeCount}</strong>
          <em>Aktif di portofolio</em>
        </div>
      </div>

      <div className="gallery-stat-card">
        <span className="gallery-stat-icon">
          <HeartIcon size={16} className="text-red-400" />
        </span>
        <div className="gallery-stat-copy">
          <small>Favorit Saya</small>
          <strong>{favoriteCount}</strong>
          <em>Foto bertanda bintang</em>
        </div>
      </div>

      <div className="gallery-stat-card">
        <span className="gallery-stat-icon">
          <TrashIcon size={16} className="text-red-400" />
        </span>
        <div className="gallery-stat-copy">
          <small>Tempat Sampah</small>
          <strong>{trashCount}</strong>
          <em>Baru saja dihapus</em>
        </div>
      </div>
    </section>
  );
}
