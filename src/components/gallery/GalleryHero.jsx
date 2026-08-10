export default function GalleryHero({
  activeCount,
  favoriteCount,
  HeartIcon,
  ImageIcon,
  trashCount,
  TrashIcon,
}) {
  return (
    <section
      className="gallery-overview"
      aria-label="Ringkasan galeri"
    >
      <article className="gallery-overview-primary">
        <span
          className="gallery-overview-primary-icon"
          aria-hidden="true"
        >
          <ImageIcon size={20} />
        </span>

        <div className="gallery-overview-primary-copy">
          <small>Published media</small>
          <strong>{activeCount}</strong>
          <p>
            Foto aktif yang tersedia di library studio.
          </p>
        </div>

        <span className="gallery-overview-primary-note">
          Portfolio ready
        </span>
      </article>

      <div className="gallery-overview-support">
        <article className="gallery-overview-metric">
          <span
            className="gallery-overview-metric-icon is-favorite"
            aria-hidden="true"
          >
            <HeartIcon size={16} />
          </span>

          <div>
            <small>Favorites</small>
            <strong>{favoriteCount}</strong>
            <p>Kurasi pilihan cepat.</p>
          </div>
        </article>

        <article className="gallery-overview-metric">
          <span
            className="gallery-overview-metric-icon is-trash"
            aria-hidden="true"
          >
            <TrashIcon size={16} />
          </span>

          <div>
            <small>Recycle bin</small>
            <strong>{trashCount}</strong>
            <p>Item menunggu keputusan.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
