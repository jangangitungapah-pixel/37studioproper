export default function GalleryAlerts({
  CloseIcon,
  error,
  onClearError,
  onClearSuccess,
  success,
}) {
  if (!error && !success) return null;

  return (
    <>
      {error ? (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs flex items-center justify-between gap-2 animate-in fade-in-50 slide-in-from-top-3">
          <span className="flex items-center gap-2">⚠️ {error}</span>
          <button onClick={onClearError} className="p-1 text-red-400 hover:text-red-200"><CloseIcon size={14} /></button>
        </div>
      ) : null}

      {success ? (
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex items-center justify-between gap-2 animate-in fade-in-50 slide-in-from-top-3">
          <span className="flex items-center gap-2">✨ {success}</span>
          <button onClick={onClearSuccess} className="p-1 text-emerald-400 hover:text-emerald-200"><CloseIcon size={14} /></button>
        </div>
      ) : null}
    </>
  );
}
