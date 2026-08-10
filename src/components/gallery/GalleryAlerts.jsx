export default function GalleryAlerts({
  CloseIcon,
  error,
  onClearError,
  onClearSuccess,
  success,
}) {
  if (!error && !success) {
    return null;
  }

  return (
    <div
      className="gallery-alert-stack"
      aria-live="polite"
    >
      {error ? (
        <div
          className="gallery-alert is-error"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={onClearError}
            aria-label="Tutup pesan error"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="gallery-alert is-success">
          <span>{success}</span>

          <button
            type="button"
            onClick={onClearSuccess}
            aria-label="Tutup pesan sukses"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
