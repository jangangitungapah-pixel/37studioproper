import {
  Check,
  Heart,
  Pencil,
  RefreshCw,
  Trash,
  Trash2,
} from 'lucide-react';

export default function PhotoCard({
  categories = [],
  img,
  isDeletedTab = false,
  isSelectMode = false,
  isSelected = false,
  onSelectToggle,
  onCardClick,
  onFavoriteClick,
  onRestoreClick,
  onDeleteClick,
  onEditMetadata,
}) {
  const categoryLabel =
    categories.find(
      (category) =>
        category.value === img.category,
    )?.label || 'Lain-lain';

  const cardClassName = [
    'gallery-photo-card',
    isSelected ? 'is-selected' : '',
    isDeletedTab ? 'is-deleted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClassName}>
      <button
        type="button"
        className="gallery-photo-open"
        onClick={onCardClick}
        aria-label={
          'Buka foto ' +
          (img.title || 'tanpa judul')
        }
      >
        <img
          src={img.url}
          alt={img.title || 'Gallery photo'}
          loading="lazy"
        />

        <span
          className="gallery-photo-scrim"
          aria-hidden="true"
        />

        <span className="gallery-photo-category">
          {categoryLabel}
        </span>

        <span className="gallery-photo-caption">
          <strong>
            {img.title || 'Untitled media'}
          </strong>

          <small>
            {img.uploadedBy || 'Admin studio'}
          </small>
        </span>
      </button>

      {isSelectMode ? (
        <button
          type="button"
          className={
            'gallery-photo-select' +
            (isSelected ? ' is-selected' : '')
          }
          onClick={(event) => {
            event.stopPropagation();
            onSelectToggle(img.id);
          }}
          aria-label={
            isSelected
              ? 'Batalkan pilihan foto'
              : 'Pilih foto'
          }
          aria-pressed={isSelected}
        >
          <Check
            size={16}
            aria-hidden="true"
          />
        </button>
      ) : null}

      {!isSelectMode &&
      !isDeletedTab &&
      img.isFavorite ? (
        <span
          className="gallery-photo-favorite-badge"
          title="Favorit"
        >
          <Heart
            size={13}
            aria-hidden="true"
          />
        </span>
      ) : null}

      {!isSelectMode ? (
        <div
          className="gallery-photo-actions"
          aria-label="Aksi foto"
        >
          {!isDeletedTab ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditMetadata?.();
                }}
                title="Edit metadata"
                aria-label="Edit metadata foto"
              >
                <Pencil
                  size={13}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFavoriteClick();
                }}
                className={
                  img.isFavorite
                    ? 'is-favorite'
                    : ''
                }
                title="Favorit"
                aria-label={
                  img.isFavorite
                    ? 'Hapus dari favorit'
                    : 'Tambahkan ke favorit'
                }
              >
                <Heart
                  size={13}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteClick();
                }}
                className="is-danger"
                title="Pindahkan ke tempat sampah"
                aria-label="Pindahkan foto ke tempat sampah"
              >
                <Trash2
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRestoreClick();
                }}
                className="is-success"
                title="Pulihkan"
                aria-label="Pulihkan foto"
              >
                <RefreshCw
                  size={13}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteClick();
                }}
                className="is-danger"
                title="Hapus permanen"
                aria-label="Hapus foto permanen"
              >
                <Trash
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
