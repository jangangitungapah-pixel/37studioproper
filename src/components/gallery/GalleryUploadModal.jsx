export default function GalleryUploadModal({
  categories,
  CloseIcon,
  fileInputRef,
  FileImageIcon,
  isOpen,
  isUploading,
  LoaderIcon,
  onCategoryChange,
  onClose,
  onDescriptionChange,
  onFileChange,
  onSubmit,
  onTitleChange,
  selectedFile,
  uploadCategory,
  uploadDesc,
  UploadIcon,
  uploadTitle,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="gallery-modal-layer"
      data-gallery-upload-ui="ui-11-spatial"
    >
      <button
        type="button"
        className="gallery-modal-backdrop"
        aria-label="Tutup dialog upload"
        onClick={() => {
          if (!isUploading) {
            onClose();
          }
        }}
      />

      <section
        className="gallery-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-upload-title"
      >
        <header className="gallery-modal-header">
          <div className="gallery-modal-title">
            <span aria-hidden="true">
              <UploadIcon size={18} />
            </span>

            <div>
              <small>Publish media</small>

              <h3 id="gallery-upload-title">
                Upload foto
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="gallery-modal-close"
            aria-label="Tutup dialog upload"
          >
            <CloseIcon size={17} />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="gallery-modal-form"
        >
          <div className="gallery-field">
            <span className="gallery-field-label">
              File foto
            </span>

            <button
              type="button"
              className={
                'gallery-upload-dropzone' +
                (selectedFile
                  ? ' has-file'
                  : '')
              }
              disabled={isUploading}
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={onFileChange}
                disabled={isUploading}
                className="gallery-hidden-input"
                tabIndex={-1}
              />

              {selectedFile ? (
                <>
                  <FileImageIcon
                    size={30}
                    aria-hidden="true"
                  />

                  <strong>
                    {selectedFile.name}
                  </strong>

                  <small>
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}
                    {' '}MB
                  </small>
                </>
              ) : (
                <>
                  <UploadIcon
                    size={28}
                    aria-hidden="true"
                  />

                  <strong>
                    Pilih gambar dari perangkat
                  </strong>

                  <small>
                    JPG, PNG, WEBP, AVIF,
                    GIF, HEIC/HEIF · maksimum
                    12 MB
                  </small>
                </>
              )}
            </button>
          </div>

          <label className="gallery-field">
            <span className="gallery-field-label">
              Judul foto *
            </span>

            <input
              type="text"
              placeholder="Contoh: Control Room — Night Session"
              required
              disabled={isUploading}
              value={uploadTitle}
              onChange={(event) =>
                onTitleChange(
                  event.target.value,
                )
              }
            />
          </label>

          <fieldset className="gallery-field">
            <legend className="gallery-field-label">
              Kategori / album
            </legend>

            <div className="gallery-category-grid">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  disabled={isUploading}
                  onClick={() =>
                    onCategoryChange(
                      cat.value,
                    )
                  }
                  className={
                    'gallery-category-option' +
                    (uploadCategory ===
                    cat.value
                      ? ' is-active'
                      : '')
                  }
                  aria-pressed={
                    uploadCategory ===
                    cat.value
                  }
                >
                  <strong>
                    {cat.label}
                  </strong>

                  <small>
                    {cat.value}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="gallery-field">
            <span className="gallery-field-label">
              Deskripsi
            </span>

            <textarea
              placeholder="Tambahkan konteks singkat mengenai foto..."
              rows={3}
              disabled={isUploading}
              value={uploadDesc}
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
              disabled={isUploading}
              onClick={onClose}
              className="gallery-secondary-button"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isUploading}
              className="gallery-primary-button"
            >
              {isUploading ? (
                <LoaderIcon
                  className="gallery-inline-spinner"
                  size={14}
                />
              ) : (
                <UploadIcon size={14} />
              )}

              <span>
                {isUploading
                  ? 'Mengupload...'
                  : 'Upload & simpan'}
              </span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
