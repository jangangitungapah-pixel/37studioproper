export default function GalleryLightbox({
  activePhoto,
  activePhotoIndex,
  audioVisualizerBarHeights,
  audioVolume,
  Calendar,
  Camera,
  canvasRef,
  categories,
  ChevronLeft,
  ChevronRight,
  closeLightbox,
  Crop,
  displayedImages,
  Download,
  editorAdjustments,
  editorCropPreset,
  editorFilterPreset,
  editorFlip,
  editorWatermark,
  exifDetails,
  handleDownloadEditedImage,
  handleNextPhoto,
  handlePermanentDelete,
  handlePrevPhoto,
  handleRestore,
  handleSaveEditedImage,
  handleSoftDelete,
  handleToggleFavorite,
  handleVolumeChange,
  Heart,
  imgElement,
  Info,
  isEditing,
  isInfoPanelOpen,
  isMusicPlaying,
  isSavingEdit,
  isSlideshowPlaying,
  LoaderCircle,
  MapPin,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  setEditorAdjustments,
  setEditorCropPreset,
  setEditorFilterPreset,
  setEditorFlip,
  setEditorRotation,
  setEditorWatermark,
  setIsEditing,
  setIsInfoPanelOpen,
  setIsMusicPlaying,
  setIsSlideshowPlaying,
  Trash,
  Trash2,
  Type,
  User,
  Volume2,
  VolumeX,
  X,
}) {
  const CATEGORIES = categories;
  const AUDIO_VISUALIZER_BAR_HEIGHTS = audioVisualizerBarHeights;

  return (
    <>
      {/* 7. CINEMATIC FULLSCREEN LIGHTBOX & MEDIA CENTER */}
      {activePhotoIndex !== null && activePhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300">
          
          {/* Lightbox Header Controls */}
          <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-white/5">
                {activePhotoIndex + 1} / {displayedImages.length}
              </span>
              <div>
                <h4 className="text-sm font-bold text-white line-clamp-1">{activePhoto.title}</h4>
                <p className="text-[10px] text-zinc-500">{CATEGORIES.find(c => c.value === activePhoto.category)?.label || 'Uncategorized'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Slideshow button */}
              <button
                type="button"
                onClick={() => setIsSlideshowPlaying(prev => !prev)}
                className={`p-2 rounded-xl transition-all border ${
                  isSlideshowPlaying
                    ? 'bg-orange-500 text-black border-transparent shadow-lg shadow-orange-500/25'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/5'
                }`}
                title={isSlideshowPlaying ? 'Hentikan Slideshow (Spasi)' : 'Putar Slideshow (Spasi)'}
              >
                {isSlideshowPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>

              {/* Ambient Music Button */}
              {isSlideshowPlaying && (
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-white/5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setIsMusicPlaying(!isMusicPlaying)}
                    className={`p-1 rounded-lg transition-colors ${isMusicPlaying ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    title="Musik Latar Slideshow"
                  >
                    {isMusicPlaying ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  </button>
                  {isMusicPlaying && (
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={audioVolume}
                      onChange={handleVolumeChange}
                      className="w-14 h-1 accent-orange-500 cursor-pointer rounded-lg bg-zinc-800"
                    />
                  )}
                </div>
              )}

              {/* Action Buttons for Normal vs Deleted Photos */}
              {!activePhoto.isDeleted ? (
                <>
                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 transition-all"
                    title="Edit Foto (E)"
                  >
                    <RotateCw size={15} />
                  </button>

                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(activePhoto)}
                    className={`p-2 rounded-xl transition-all border ${
                      activePhoto.isFavorite 
                        ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/5'
                    }`}
                    title="Favoritkan (F)"
                  >
                    <Heart size={15} className={activePhoto.isFavorite ? 'fill-current' : ''} />
                  </button>

                  {/* Move to Trash */}
                  <button
                    type="button"
                    onClick={() => handleSoftDelete(activePhoto.id)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all"
                    title="Buang ke Sampah"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <>
                  {/* Restore */}
                  <button
                    type="button"
                    onClick={() => handleRestore(activePhoto.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all"
                  >
                    <RefreshCw size={13} />
                    <span>Pulihkan</span>
                  </button>
                  {/* Permanent Delete */}
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(activePhoto.id)}
                    className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-all"
                    title="Hapus Permanen"
                  >
                    <Trash size={15} />
                  </button>
                </>
              )}

              {/* Info panel toggle */}
              <button
                type="button"
                onClick={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
                className={`p-2 rounded-xl transition-all border ${
                  isInfoPanelOpen
                    ? 'bg-white text-black border-transparent'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border-white/5'
                }`}
                title="Detail Info (I)"
              >
                <Info size={15} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeLightbox}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 transition-all"
                title="Keluar (Esc)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Lightbox Main Content Area */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            
            {/* Left Nav Button */}
            {displayedImages.length > 1 && !isEditing && (
              <button
                onClick={handlePrevPhoto}
                className="absolute left-6 z-10 p-3 rounded-full bg-zinc-900/60 hover:bg-zinc-900 text-white border border-white/5 backdrop-blur-md opacity-0 sm:opacity-100 hover:scale-105 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Main Image */}
            <div className="w-full h-full flex items-center justify-center p-4">
              {!isEditing ? (
                <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
                  <img
                    src={activePhoto.url}
                    alt={activePhoto.title}
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl select-none"
                    loading="eager"
                  />
                  {activePhoto.isFavorite && (
                    <div className="absolute top-4 left-4 p-2 rounded-xl bg-black/60 text-red-500 backdrop-blur-md">
                      <Heart size={16} className="fill-current" />
                    </div>
                  )}
                </div>
              ) : (
                /* PHOTO STUDIO EDITOR VIEW */
                <div className="w-full h-full flex flex-col lg:flex-row items-center justify-center gap-6 z-20 animate-in zoom-in-95 duration-200">
                  <div className="flex-1 flex items-center justify-center max-h-[60vh] lg:max-h-[80vh] relative">
                    {!imgElement ? (
                      <div className="flex flex-col items-center gap-2">
                        <LoaderCircle className="animate-spin text-orange-500" size={32} />
                        <span className="text-xs text-zinc-500">Memuat studio editor...</span>
                      </div>
                    ) : null}
                    <canvas 
                      ref={canvasRef} 
                      className={`max-w-full max-h-[55vh] lg:max-h-[75vh] object-contain rounded-xl shadow-2xl bg-zinc-900 border border-white/10 ${
                        !imgElement ? 'hidden' : 'block'
                      }`}
                    />
                  </div>

                  {/* Editor Control Sidebar */}
                  {imgElement && (
                    <div className="w-full lg:w-80 p-5 rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl space-y-5 overflow-y-auto max-h-[30vh] lg:max-h-[80vh] text-xs text-zinc-300">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <h4 className="font-bold text-white flex items-center gap-2">
                          <RotateCw size={14} className="text-orange-500" />
                          <span>Photo Studio Editor</span>
                        </h4>
                        <span className="px-2 py-0.5 rounded bg-orange-500/10 text-[9px] font-bold text-orange-500">Canvas v2</span>
                      </div>

                      {/* 1. Filter Presets */}
                      <div className="space-y-2">
                        <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[9px]">Preset Filter</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: 'original', label: 'Asli' },
                            { id: 'vivid', label: 'Vivid' },
                            { id: 'chrome', label: 'Chrome' },
                            { id: 'noir', label: 'B&W Mono' },
                            { id: 'vintage', label: 'Vintage' },
                            { id: 'cool', label: 'Cool' },
                            { id: 'sunset', label: 'Sunset' }
                          ].map(filt => (
                            <button
                              key={filt.id}
                              onClick={() => setEditorFilterPreset(filt.id)}
                              className={`p-2 rounded-lg border text-center transition-all font-semibold ${
                                editorFilterPreset === filt.id
                                  ? 'border-orange-500 bg-orange-500/15 text-white'
                                  : 'border-white/5 bg-white/5 hover:border-white/10'
                              }`}
                            >
                              {filt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Manual adjustments sliders */}
                      <div className="space-y-3">
                        <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[9px]">Penyesuaian Manual</span>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Kecerahan (Brightness)</span>
                            <span>{editorAdjustments.brightness}%</span>
                          </div>
                          <input
                            type="range" min={50} max={150} value={editorAdjustments.brightness}
                            onChange={(e) => setEditorAdjustments(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                            className="w-full accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Kontras (Contrast)</span>
                            <span>{editorAdjustments.contrast}%</span>
                          </div>
                          <input
                            type="range" min={50} max={150} value={editorAdjustments.contrast}
                            onChange={(e) => setEditorAdjustments(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                            className="w-full accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Saturasi (Saturation)</span>
                            <span>{editorAdjustments.saturation}%</span>
                          </div>
                          <input
                            type="range" min={0} max={200} value={editorAdjustments.saturation}
                            onChange={(e) => setEditorAdjustments(prev => ({ ...prev, saturation: parseInt(e.target.value) }))}
                            className="w-full accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Ketajaman / Blur</span>
                            <span>{editorAdjustments.blur} px</span>
                          </div>
                          <input
                            type="range" min={0} max={10} value={editorAdjustments.blur}
                            onChange={(e) => setEditorAdjustments(prev => ({ ...prev, blur: parseInt(e.target.value) }))}
                            className="w-full accent-orange-500 cursor-pointer h-1 rounded bg-zinc-800"
                          />
                        </div>
                      </div>

                      {/* 3. Crop presets */}
                      <div className="space-y-2">
                        <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <Crop size={10} />
                          <span>Pangkas Aspek Rasio (Center Crop)</span>
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 'free', label: 'Asli' },
                            { id: '1:1', label: '1:1' },
                            { id: '16:9', label: '16:9' },
                            { id: '4:3', label: '4:3' }
                          ].map(crop => (
                            <button
                              key={crop.id}
                              onClick={() => setEditorCropPreset(crop.id)}
                              className={`py-1.5 rounded-lg border text-center transition-all font-semibold text-[10px] ${
                                editorCropPreset === crop.id
                                  ? 'border-orange-500 bg-orange-500/10 text-white'
                                  : 'border-white/5 bg-white/5 hover:border-white/10'
                              }`}
                            >
                              {crop.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Transform Rotations */}
                      <div className="space-y-2">
                        <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[9px]">Transformasi</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditorRotation(prev => (prev + 90) % 360)}
                            className="flex-1 py-2 px-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 flex items-center justify-center gap-1.5 font-semibold"
                          >
                            <RotateCw size={12} />
                            <span>Putar 90°</span>
                          </button>
                          <button
                            onClick={() => setEditorFlip(prev => ({ ...prev, horizontal: !prev.horizontal }))}
                            className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-semibold ${
                              editorFlip.horizontal ? 'border-orange-500 text-white' : 'border-white/5 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <span>Balik H</span>
                          </button>
                          <button
                            onClick={() => setEditorFlip(prev => ({ ...prev, vertical: !prev.vertical }))}
                            className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-semibold ${
                              editorFlip.vertical ? 'border-orange-500 text-white' : 'border-white/5 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <span>Balik V</span>
                          </button>
                        </div>
                      </div>

                      {/* 5. Watermark Banner */}
                      <div className="space-y-2">
                        <span className="text-zinc-500 font-semibold block uppercase tracking-wider text-[9px] flex items-center gap-1">
                          <Type size={10} />
                          <span>Tambahkan Watermark Teks</span>
                        </span>
                        <input
                          type="text"
                          placeholder="Contoh: 37 Studio Proper..."
                          value={editorWatermark}
                          onChange={(e) => setEditorWatermark(e.target.value)}
                          maxLength={32}
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none text-white focus:border-orange-500 transition-all text-xs"
                        />
                      </div>

                      {/* 6. Save Actions inside Editor */}
                      <div className="pt-4 border-t border-white/5 space-y-2">
                        <button
                          type="button"
                          onClick={handleSaveEditedImage}
                          disabled={isSavingEdit}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-black font-bold text-xs tracking-wider transition-all disabled:opacity-40"
                        >
                          {isSavingEdit ? (
                            <>
                              <LoaderCircle className="animate-spin" size={14} />
                              <span>MENYIMPAN SALINAN...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>SIMPAN SEBAGAI SALINAN</span>
                            </>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadEditedImage}
                            className="flex-1 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-1.5"
                          >
                            <Download size={14} />
                            <span>UNDUH</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="flex-1 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs tracking-wider transition-all"
                          >
                            BATAL
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Nav Button */}
            {displayedImages.length > 1 && !isEditing && (
              <button
                onClick={handleNextPhoto}
                className="absolute right-6 z-10 p-3 rounded-full bg-zinc-900/60 hover:bg-zinc-900 text-white border border-white/5 backdrop-blur-md opacity-0 sm:opacity-100 hover:scale-105 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {/* Lightbox Sidebar Info Panel */}
          {isInfoPanelOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-950/95 border-l border-white/10 p-6 overflow-y-auto text-xs text-zinc-300 z-30 animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info size={15} className="text-orange-500" />
                  <span>Informasi Detail Media</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsInfoPanelOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Judul</span>
                  <p className="text-white font-semibold text-sm mt-0.5">{activePhoto.title}</p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Deskripsi</span>
                  <p className="text-zinc-400 mt-0.5 leading-relaxed">
                    {activePhoto.description || 'Tidak ada deskripsi.'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pengunggah</span>
                  <div className="flex items-center gap-2 mt-1">
                    <User size={13} className="text-orange-500" />
                    <span className="text-zinc-300 font-medium">{activePhoto.uploadedBy}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tanggal Diupload</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar size={13} className="text-orange-500" />
                    <span className="text-zinc-300 font-medium">
                      {new Date(activePhoto.createdAt).toLocaleDateString('id-ID', { 
                        weekday: 'long', 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {exifDetails && (
                <div className="border-t border-white/5 pt-5 space-y-4 mb-6">
                  <h5 className="font-bold text-white flex items-center gap-2">
                    <Camera size={13} className="text-orange-500" />
                    <span>Metadata Kamera (Simulasi)</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-3.5 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Perangkat</span>
                      <span className="text-white font-semibold text-[11px] truncate block">{exifDetails.camera}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Lensa</span>
                      <span className="text-white font-semibold text-[11px] truncate block">{exifDetails.lens}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Parameter</span>
                      <span className="text-white font-semibold text-[11px] block">
                        {exifDetails.focal}, {exifDetails.aperture}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Eksposur / ISO</span>
                      <span className="text-white font-semibold text-[11px] block">
                        {exifDetails.shutter}, ISO {exifDetails.iso}
                      </span>
                    </div>
                    <div className="col-span-2 border-t border-white/5 pt-2 flex justify-between text-[10px] text-zinc-400">
                      <span>Resolusi: {exifDetails.dimensions}</span>
                      <span>Ukuran: {exifDetails.size}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-white/5 pt-5 space-y-3">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <MapPin size={13} className="text-orange-500" />
                  <span>Lokasi Media</span>
                </h5>
                <p className="text-zinc-400 text-[10px]">Foto diambil di: <strong>37 Music Studio Proper, Jakarta</strong></p>
                
                <div className="h-28 w-full bg-zinc-900 border border-white/5 rounded-2xl relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px]" />
                  <div className="absolute inset-0 bg-radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)" />
                  
                  <div className="absolute w-24 h-24 rounded-full border border-orange-500/10 animate-ping duration-[3s]" />
                  <div className="absolute w-12 h-12 rounded-full border border-orange-500/20" />
                  <div className="absolute w-20 h-20 rounded-full border border-orange-500/10" />

                  <div className="relative">
                    <span className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-orange-500 rounded-full animate-ping" />
                    <span className="relative block w-2.5 h-2.5 bg-orange-500 border border-black rounded-full shadow-lg" />
                  </div>
                  
                  <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/60 border border-white/5 text-[9px] text-zinc-400">
                    -6.2088° S, 106.8456° E
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Slideshow audio visualizer footer */}
          {isSlideshowPlaying && isMusicPlaying && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 px-4 py-2 rounded-2xl bg-black/65 border border-white/5 backdrop-blur-md">
              <Music size={13} className="text-orange-500 animate-bounce" />
              <span className="text-[10px] text-zinc-400 mr-2 font-medium">Ambient Lofi Playing</span>
              <div className="flex items-end gap-0.5 h-3">
                {AUDIO_VISUALIZER_BAR_HEIGHTS.map((height, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-orange-500 rounded-full animate-pulse"
                    style={{
                      height: `${height}px`,
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '0.8s'
                    }}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}
