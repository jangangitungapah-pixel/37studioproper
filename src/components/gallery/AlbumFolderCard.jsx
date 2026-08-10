import {
  Folder,
} from 'lucide-react';

export default function AlbumFolderCard({
  title,
  count,
  coverUrl,
  onClick,
  icon: FolderIcon = Folder,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="gallery-album-card"
    >
      <span className="gallery-album-cover">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <span className="gallery-album-placeholder">
            <FolderIcon
              size={32}
              aria-hidden="true"
            />
          </span>
        )}

        <span
          className="gallery-album-cover-scrim"
          aria-hidden="true"
        />

        <span className="gallery-album-count">
          {count} item
        </span>

        <span className="gallery-album-icon">
          <FolderIcon
            size={17}
            aria-hidden="true"
          />
        </span>
      </span>

      <span className="gallery-album-copy">
        <strong>{title}</strong>
        <small>{count} foto</small>
      </span>
    </button>
  );
}
