import {
  Pencil,
  X,
} from 'lucide-react';

export default function GalleryMetadataModal({
  categories,
  category,
  description,
  isOpen,
  isSaving,
  onCategoryChange,
  onClose,
  onDescriptionChange,
  onSubmit,
  onTitleChange,
  photo,
  title,
}) {
  if (!isOpen || !photo) {
    return null;
  }

  return (
    <div
      className="gallery-modal-layer"
      data-gallery-metadata-ui="ui-11-spatial"
    >
      <button
        type="button"
        className="gallery-modal-backdrop"
        aria-label="Tutup editor metadata"
        onClick={onClose}
        disabled={isSaving}
      />

      <section
        className="gallery-modal-panel gallery-metadata-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-metadata-title"
      >
        <header className="gallery-modal-header">
          <div className="gallery-modal-title">
            <span aria-hidden="true">
              <Pencil size={17} />
            </span>

            <div>
              <small>Media details</small>

              <h3 id="gallery-metadata-title">
                Edit metadata
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="gallery-modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Tutup editor metadata"
          >
            <X size={17} />
          </button>
        </header>

        <div className="gallery-metadata-preview">
          <img
            src={photo.url}
            alt=""
          />

          <div>
            <small>Editing</small>

            <strong>
              {photo.title ||
                'Untitled media'}
            </strong>

            <span>
              Asset gambar tidak diubah.
              Hanya metadata Firestore
              yang diperbarui.
            </span>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="gallery-modal-form"
        >
          <label className="gallery-field">
            <span className="gallery-field-label">
              Judul *
            </span>

            <input
              type="text"
              required
              disabled={isSaving}
              value={title}
              onChange={(event) =>
                onTitleChange(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="gallery-field">
            <span className="gallery-field-label">
              Kategori
            </span>

            <select
              value={category}
              disabled={isSaving}
              onChange={(event) =>
                onCategoryChange(
                  event.target.value,
                )
              }
            >
              {categories.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="gallery-field">
            <span className="gallery-field-label">
              Deskripsi
            </span>

            <textarea
              rows={4}
              disabled={isSaving}
              value={description}
              onChange={(event) =>
                onDescriptionChange(
                  event.target.value,
                )
              }
            />
          </label>

          <footer className="gallery-modal-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="gallery-secondary-button"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="gallery-primary-button"
            >
              <Pencil
                size={14}
                aria-hidden="true"
              />

              <span>
                {isSaving
                  ? 'Menyimpan...'
                  : 'Simpan metadata'}
              </span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
