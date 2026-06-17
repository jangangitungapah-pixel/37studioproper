export default function GalleryHero({
  activeCount,
  favoriteCount,
  HeartIcon,
  ImageIcon,
  trashCount,
  TrashIcon,
}) {
  return (
    <section className="customer-hero-grid" aria-label="Ringkasan galeri">
      <article className="customer-hero-card">
        <span className="customer-hero-icon">
          <ImageIcon size={18} />
        </span>
        <span className="customer-hero-copy">
          <small>Total Foto</small>
          <strong>{activeCount}</strong>
          <em>Aktif di portofolio</em>
        </span>
      </article>

      <article className="customer-hero-card">
        <span className="customer-hero-icon">
          <HeartIcon size={18} className="text-red-400" />
        </span>
        <span className="customer-hero-copy">
          <small>Favorit Saya</small>
          <strong>{favoriteCount}</strong>
          <em>Foto bertanda bintang</em>
        </span>
      </article>

      <article className="customer-hero-card">
        <span className="customer-hero-icon">
          <TrashIcon size={18} className="text-red-400" />
        </span>
        <span className="customer-hero-copy">
          <small>Tempat Sampah</small>
          <strong>{trashCount}</strong>
          <em>Baru saja dihapus</em>
        </span>
      </article>
    </section>
  );
}
