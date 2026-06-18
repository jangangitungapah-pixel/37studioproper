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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        onClick={() => {
          if (!isUploading) onClose();
        }}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div className="relative w-full max-w-lg p-6 rounded-3xl bg-zinc-950 border border-[var(--auth-border)] shadow-2xl space-y-6 animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UploadIcon className="text-[var(--ui-accent)] w-5 h-5" />
            <span>Upload Foto Portofolio</span>
          </h3>
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-[var(--ui-text-muted)] hover:text-white transition-colors"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <span className="text-xs text-[var(--ui-text-muted)] font-medium">Pilih File Foto</span>
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                selectedFile
                  ? 'border-orange-500/40 bg-orange-500/5'
                  : 'border-white/10 hover:border-white/20 bg-white/5'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={onFileChange}
                disabled={isUploading}
                className="hidden"
              />
              {selectedFile ? (
                <>
                  <FileImageIcon className="text-[var(--ui-accent)] w-9 h-9" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white max-w-[280px] truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </>
              ) : (
                <>
                  <UploadIcon className="text-zinc-500 w-8 h-8 opacity-60" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Klik untuk memilih gambar</p>
                    <p className="text-[10px] text-[var(--ui-text-muted)]">Format JPG, PNG, WEBP (Maks 12MB)</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[var(--ui-text-muted)] font-medium">Judul Foto *</span>
            <input
              type="text"
              placeholder="Contoh: Console Mixing A"
              required
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500 outline-none text-white transition-all text-xs"
              value={uploadTitle}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </label>

          <div className="space-y-1.5 block">
            <span className="text-xs text-[var(--ui-text-muted)] font-medium">Pilih Kategori / Album</span>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => onCategoryChange(cat.value)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-16 ${
                    uploadCategory === cat.value
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <span className="text-[11px] font-bold block">{cat.label}</span>
                  <span className="text-[9px] opacity-65 font-medium">{cat.value}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs text-[var(--ui-text-muted)] font-medium">Deskripsi Singkat (Opsional)</span>
            <textarea
              placeholder="Keterangan singkat mengenai foto..."
              rows={2}
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500 outline-none text-white transition-all text-xs resize-none"
              value={uploadDesc}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </label>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
            <button
              type="button"
              disabled={isUploading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-strong)] text-black font-bold text-xs tracking-wider transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <LoaderIcon className="animate-spin" size={14} />
                  <span>Mengupload...</span>
                </>
              ) : (
                <>
                  <UploadIcon size={14} />
                  <span>Upload & Simpan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
