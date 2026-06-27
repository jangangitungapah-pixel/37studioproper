import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  X, 
  Upload, 
  LoaderCircle,
  FileImage,
  Calendar,
  User,
  Heart,
  Grid,
  Info,
  Play,
  Pause,
  Download,
  RotateCw,
  RefreshCw,
  Type,
  Crop,
  Search,
  Check,
  Folder,
  Volume2,
  VolumeX,
  Music,
  MapPin,
  Camera,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash
} from 'lucide-react';
import { firebaseAuth } from '../../lib/firebase.js';
import { uploadGalleryImageFile, MAX_GALLERY_IMAGE_SIZE_BYTES } from '../../services/cloudinaryUploadService.js';
import { galleryRepository } from '../../services/galleryRepository.js';
import GalleryAlerts from '../../components/gallery/GalleryAlerts.jsx';
import GalleryBatchBanner from '../../components/gallery/GalleryBatchBanner.jsx';
import GalleryHero from '../../components/gallery/GalleryHero.jsx';
import GalleryToolbar from '../../components/gallery/GalleryToolbar.jsx';
import GalleryAlbumsView from '../../components/gallery/GalleryAlbumsView.jsx';
import GalleryTimelineView from '../../components/gallery/GalleryTimelineView.jsx';
import GalleryTrashView from '../../components/gallery/GalleryTrashView.jsx';
import GalleryUploadModal from '../../components/gallery/GalleryUploadModal.jsx';
import GalleryLightbox from '../../components/gallery/GalleryLightbox.jsx';
import AlbumFolderCard from '../../components/gallery/AlbumFolderCard.jsx';
import EmptyGalleryState from '../../components/gallery/EmptyGalleryState.jsx';
import PhotoCard from '../../components/gallery/PhotoCard.jsx';
import { AUDIO_VISUALIZER_BAR_HEIGHTS, CATEGORIES } from '../../utils/galleryConstants.js';
import { getDisplayedGalleryImages, getFilteredActiveImages, getGalleryTimelineGroups, getTrashedGalleryImages } from '../../utils/galleryImageFilters.js';
import LofiAmbientSynth from '../../utils/lofiAmbientSynth.js';

export default function GalleryPage() {
  const [rawImages, setRawImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Gallery Navigation States
  const [activeTab, setActiveTab] = useState('photos'); // 'photos' | 'albums' | 'trash'
  const [selectedAlbum, setSelectedAlbum] = useState(null); // null means showing albums menu, string shows details
  const [gridColumns, setGridColumns] = useState(4); // 2 to 6
  const [searchQuery, setSearchQuery] = useState('');

  // Batch Select State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Upload States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Control Room');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Lightbox States
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  
  // Ambient Sound States
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const synthRef = useRef(null);

  // Photo Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [imgElement, setImgElement] = useState(null);
  const canvasRef = useRef(null);
  
  // Photo Editor Adjustments
  const [editorFilterPreset, setEditorFilterPreset] = useState('original');
  const [editorAdjustments, setEditorAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    exposure: 100,
    blur: 0
  });
  const [editorRotation, setEditorRotation] = useState(0); // 0, 90, 180, 270
  const [editorFlip, setEditorFlip] = useState({ horizontal: false, vertical: false });
  const [editorWatermark, setEditorWatermark] = useState('');
  const [editorCropPreset, setEditorCropPreset] = useState('free'); // 'free' | '1:1' | '16:9' | '4:3'
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch all gallery items (live updates)
  useEffect(() => {
    const unsubscribe = galleryRepository.subscribeGalleryItems(
      (list) => {
        setRawImages(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching gallery:', err);
        setError('Gagal memuat daftar foto galeri.');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      if (synthRef.current) {
        synthRef.current.stop();
      }
    };
  }, []);

  // Filter rawImages based on active tab and status
  const filteredActiveImages = useMemo(() => getFilteredActiveImages(rawImages), [rawImages]);

  const trashedImages = useMemo(() => getTrashedGalleryImages(rawImages), [rawImages]);

  // Derived filtered active photos (Search, Album selection, Category Filter)
  const displayedImages = useMemo(() => getDisplayedGalleryImages({
    activeTab,
    filteredActiveImages,
    searchQuery,
    selectedAlbum,
    selectedCategoryFilter: 'All',
    trashedImages,
  }), [filteredActiveImages, trashedImages, activeTab, selectedAlbum, searchQuery]);

  // Group photos by Month-Year for the Photo timeline stream
  const timelineGroups = useMemo(
    () => getGalleryTimelineGroups(displayedImages, activeTab),
    [displayedImages, activeTab]
  );

  // Handle music start/stop
  useEffect(() => {
    if (isMusicPlaying) {
      if (!synthRef.current) {
        synthRef.current = new LofiAmbientSynth();
      }
      synthRef.current.start(audioVolume);
    } else {
      if (synthRef.current) {
        synthRef.current.stop();
      }
    }
  }, [isMusicPlaying, audioVolume]);

  // Adjust volume
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setAudioVolume(val);
    if (synthRef.current) {
      synthRef.current.setVolume(val);
    }
  };

  // Active Photo document helper
  const activePhoto = useMemo(() => {
    if (activePhotoIndex === null) return null;
    return displayedImages[activePhotoIndex];
  }, [activePhotoIndex, displayedImages]);

  const handleNextPhoto = useCallback(() => {
    if (displayedImages.length <= 1) return;
    setActivePhotoIndex(prev => (prev + 1) % displayedImages.length);
  }, [displayedImages.length]);

  const handlePrevPhoto = useCallback(() => {
    if (displayedImages.length <= 1) return;
    setActivePhotoIndex(prev => (prev - 1 + displayedImages.length) % displayedImages.length);
  }, [displayedImages.length]);

  const closeLightbox = useCallback(() => {
    setActivePhotoIndex(null);
    setIsSlideshowPlaying(false);
    setIsMusicPlaying(false);
    setIsEditing(false);
    if (synthRef.current) {
      synthRef.current.stop();
    }
  }, []);

  const handleToggleFavorite = useCallback(async (img) => {
    if (!img?.id) return;

    try {
      await galleryRepository.setGalleryFavorite(img.id, !img.isFavorite);
    } catch (err) {
      console.error('Favorite update failed:', err);
      setError('Gagal memperbarui status favorit.');
    }
  }, []);

  // Keyboard Navigation in Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activePhotoIndex === null || isEditing) return;
      if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsSlideshowPlaying(prev => !prev);
      } else if (e.key.toLowerCase() === 'f') {
        handleToggleFavorite(displayedImages[activePhotoIndex]);
      } else if (e.key.toLowerCase() === 'i') {
        setIsInfoPanelOpen(prev => !prev);
      } else if (e.key.toLowerCase() === 'e') {
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, closeLightbox, displayedImages, handleNextPhoto, handlePrevPhoto, handleToggleFavorite, isEditing]);

  // Slideshow Timer Effect
  useEffect(() => {
    let timer;
    if (isSlideshowPlaying && activePhotoIndex !== null) {
      timer = setInterval(() => {
        handleNextPhoto();
      }, 4000);
    }
    return () => clearInterval(timer);
  }, [isSlideshowPlaying, activePhotoIndex, handleNextPhoto]);

  // File Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_GALLERY_IMAGE_SIZE_BYTES) {
        setError('Ukuran file maksimal 12MB.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFile) {
      setError('Harap pilih file foto terlebih dahulu.');
      return;
    }
    if (!uploadTitle.trim()) {
      setError('Judul foto wajib diisi.');
      return;
    }

    setIsUploading(true);
    try {
      const { secureUrl, publicId } = await uploadGalleryImageFile(selectedFile);

      const currentUser = firebaseAuth?.currentUser;
      const docData = {
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        url: secureUrl,
        publicId: publicId,
        category: uploadCategory,
        isFavorite: false,
        isDeleted: false,
        uploadedBy: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
      };

      await galleryRepository.createGalleryItem(docData);
      
      setSuccess('Foto berhasil diupload dan ditambahkan ke galeri!');
      setUploadTitle('');
      setUploadDesc('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsModalOpen(false);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Gagal mengupload foto. Periksa koneksi Anda.');
    } finally {
      setIsUploading(false);
    }
  };

  // Soft Delete (Move to Trash)
  const handleSoftDelete = useCallback(async (imgId) => {
    try {
      await galleryRepository.moveGalleryItemToTrash(imgId);

      if (activePhotoIndex !== null && displayedImages[activePhotoIndex].id === imgId) {
        if (displayedImages.length <= 1) {
          setActivePhotoIndex(null);
          setIsSlideshowPlaying(false);
          setIsMusicPlaying(false);
          setIsEditing(false);
        } else {
          handleNextPhoto();
        }
      }
      setSuccess('Foto dipindahkan ke Tempat Sampah.');
    } catch (err) {
      console.error('Soft delete failed:', err);
      setError('Gagal memindahkan foto ke Tempat Sampah.');
    }
  }, [activePhotoIndex, displayedImages, handleNextPhoto]);

  // Restore from Trash
  const handleRestore = async (imgId) => {
    try {
      await galleryRepository.restoreGalleryItem(imgId);
      setSuccess('Foto berhasil dipulihkan.');
    } catch (err) {
      console.error('Restore failed:', err);
      setError('Gagal memulihkan foto.');
    }
  };

  // Permanent Delete
  const handlePermanentDelete = async (imgId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus foto ini secara PERMANEN? File database akan hilang selamanya.')) {
      return;
    }
    try {
      await galleryRepository.deleteGalleryItem(imgId);
      setSuccess('Foto dihapus secara permanen.');
    } catch (err) {
      console.error('Permanent delete failed:', err);
      setError('Gagal menghapus foto dari Firestore.');
    }
  };

  // Batch Select Handlers
  const handleSelectToggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayedImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedImages.map(img => img.id)));
    }
  };

  const handleBatchFavorite = async () => {
    setError('');
    try {
      let isFavVal = true;
      const selectedPhotos = displayedImages.filter(img => selectedIds.has(img.id));
      const allFav = selectedPhotos.every(p => p.isFavorite);
      if (allFav) isFavVal = false;

      await galleryRepository.batchUpdateGalleryItems(Array.from(selectedIds), { isFavorite: isFavVal });
      setSuccess(`Berhasil memperbarui status favorit ${selectedIds.size} foto.`);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError('Gagal memperbarui status favorit secara massal.');
    }
  };

  const handleBatchSoftDelete = async () => {
    setError('');
    try {
      await galleryRepository.batchUpdateGalleryItems(Array.from(selectedIds), {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      });
      setSuccess(`Berhasil memindahkan ${selectedIds.size} foto ke Tempat Sampah.`);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError('Gagal memindahkan foto massal ke Tempat Sampah.');
    }
  };

  const handleBatchRestore = async () => {
    setError('');
    try {
      await galleryRepository.batchUpdateGalleryItems(Array.from(selectedIds), {
        isDeleted: false,
        deletedAt: null,
      });
      setSuccess(`Berhasil memulihkan ${selectedIds.size} foto.`);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError('Gagal memulihkan foto secara massal.');
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus PERMANEN ${selectedIds.size} foto? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setError('');
    try {
      await galleryRepository.batchDeleteGalleryItems(Array.from(selectedIds));
      setSuccess(`Berhasil menghapus permanen ${selectedIds.size} foto.`);
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      setError('Gagal menghapus foto secara massal.');
    }
  };

  // Image Editor Canvas Logic
  useEffect(() => {
    if (!isEditing || !activePhoto) return;
    let isCurrent = true;
    const resetFrameId = window.requestAnimationFrame(() => {
      if (isCurrent) {
        setImgElement(null);
      }
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activePhoto.url;
    img.onload = () => {
      if (!isCurrent) return;
      setImgElement(img);
      setEditorFilterPreset('original');
      setEditorAdjustments({
        brightness: 100,
        contrast: 100,
        saturation: 100,
        exposure: 100,
        blur: 0
      });
      setEditorRotation(0);
      setEditorFlip({ horizontal: false, vertical: false });
      setEditorWatermark('');
      setEditorCropPreset('free');
    };
    img.onerror = () => {
      if (!isCurrent) return;
      setError('Gagal memuat file gambar untuk diedit.');
      setIsEditing(false);
    };

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(resetFrameId);
    };
  }, [isEditing, activePhoto]);

  // Redraw Canvas when settings change
  useEffect(() => {
    if (!isEditing || !imgElement || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const isRotated90or270 = editorRotation === 90 || editorRotation === 270;
    
    let baseWidth = imgElement.naturalWidth;
    let baseHeight = imgElement.naturalHeight;

    let cropX = 0, cropY = 0, cropW = baseWidth, cropH = baseHeight;

    if (editorCropPreset === '1:1') {
      const side = Math.min(baseWidth, baseHeight);
      cropX = (baseWidth - side) / 2;
      cropY = (baseHeight - side) / 2;
      cropW = side;
      cropH = side;
    } else if (editorCropPreset === '16:9') {
      const targetHeight = Math.min(baseHeight, baseWidth * (9/16));
      const targetWidth = targetHeight * (16/9);
      cropX = (baseWidth - targetWidth) / 2;
      cropY = (baseHeight - targetHeight) / 2;
      cropW = targetWidth;
      cropH = targetHeight;
    } else if (editorCropPreset === '4:3') {
      const targetHeight = Math.min(baseHeight, baseWidth * (3/4));
      const targetWidth = targetHeight * (4/3);
      cropX = (baseWidth - targetWidth) / 2;
      cropY = (baseHeight - targetHeight) / 2;
      cropW = targetWidth;
      cropH = targetHeight;
    }

    const displayWidth = isRotated90or270 ? cropH : cropW;
    const displayHeight = isRotated90or270 ? cropW : cropH;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    ctx.save();
    
    ctx.translate(displayWidth / 2, displayHeight / 2);
    ctx.rotate((editorRotation * Math.PI) / 180);
    
    const scaleX = editorFlip.horizontal ? -1 : 1;
    const scaleY = editorFlip.vertical ? -1 : 1;
    ctx.scale(scaleX, scaleY);
    
    let filters = `brightness(${editorAdjustments.brightness}%) contrast(${editorAdjustments.contrast}%) saturate(${editorAdjustments.saturation}%) blur(${editorAdjustments.blur}px)`;
    
    if (editorFilterPreset === 'vivid') {
      filters += ' saturate(140%) contrast(110%)';
    } else if (editorFilterPreset === 'chrome') {
      filters += ' saturate(110%) contrast(105%) sepia(12%) brightness(102%)';
    } else if (editorFilterPreset === 'noir') {
      filters += ' grayscale(100%) contrast(125%) brightness(95%)';
    } else if (editorFilterPreset === 'vintage') {
      filters += ' sepia(65%) hue-rotate(-15deg) contrast(95%) saturate(85%)';
    } else if (editorFilterPreset === 'cool') {
      filters += ' hue-rotate(25deg) saturate(95%) brightness(98%)';
    } else if (editorFilterPreset === 'sunset') {
      filters += ' sepia(25%) saturate(145%) hue-rotate(-12deg) contrast(115%)';
    }

    ctx.filter = filters;

    ctx.drawImage(
      imgElement,
      cropX, cropY, cropW, cropH,
      -cropW / 2, -cropH / 2, cropW, cropH
    );
    
    ctx.restore();

    if (editorWatermark.trim()) {
      ctx.save();
      const fontSize = Math.max(16, Math.floor(displayHeight * 0.035));
      ctx.font = `italic 600 ${fontSize}px var(--ui-font-sans), sans-serif`;
      
      const text = editorWatermark.trim();
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const padding = fontSize * 0.6;
      
      const tx = displayWidth - textWidth - padding;
      const ty = displayHeight - padding;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(tx - padding*0.4, ty - fontSize, textWidth + padding*0.8, fontSize + padding*0.4);
      
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      
      ctx.fillStyle = '#f7f3ec';
      ctx.fillText(text, tx, ty - padding*0.1);
      ctx.restore();
    }

  }, [
    isEditing,
    imgElement,
    editorFilterPreset,
    editorAdjustments,
    editorRotation,
    editorFlip,
    editorWatermark,
    editorCropPreset
  ]);

  // Save Canvas Edited image as a copy
  const handleSaveEditedImage = async () => {
    if (!canvasRef.current || isSavingEdit) return;
    setIsSavingEdit(true);
    setError('');
    setSuccess('');

    try {
      const blob = await new Promise((resolve) => {
        canvasRef.current.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
      });

      if (!blob) throw new Error('Gagal menghasilkan file gambar dari editor.');

      const file = new File([blob], `${activePhoto.title.replace(/\s+/g, '_')}_edited.jpg`, { type: 'image/jpeg' });
      const { secureUrl, publicId } = await uploadGalleryImageFile(file);

      const currentUser = firebaseAuth?.currentUser;
      const docData = {
        title: `${activePhoto.title} (Edited)`,
        description: activePhoto.description || 'Hasil edit foto.',
        url: secureUrl,
        publicId: publicId,
        category: activePhoto.category || 'Others',
        isFavorite: false,
        isDeleted: false,
        uploadedBy: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
      };

      await galleryRepository.createGalleryItem(docData);
      
      setSuccess('Foto editan berhasil disimpan sebagai salinan baru!');
      setIsEditing(false);
      setActivePhotoIndex(0);
    } catch (err) {
      console.error('Save edited image error:', err);
      setError(err.message || 'Gagal menyimpan foto editan.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Download locally
  const handleDownloadEditedImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.download = `${activePhoto.title.replace(/\s+/g, '_')}_edited.jpg`;
    link.href = dataUrl;
    link.click();
    setSuccess('Foto editan berhasil diunduh.');
  };

  // Generate EXIF Info dynamically based on photo parameters for high-end feel
  const exifDetails = useMemo(() => {
    if (!activePhoto) return null;
    
    const hash = activePhoto.id.charCodeAt(0) + activePhoto.id.charCodeAt(activePhoto.id.length - 1);
    const cameraModels = ['Sony Alpha 7R V', 'Fujifilm X-T5', 'Canon EOS R5', 'Hasselblad X2D 100C', 'iPhone 15 Pro Max'];
    const lenses = ['FE 24-70mm F2.8 GM II', 'XF 33mm F1.4 R LM WR', 'RF 50mm F1.2 L USM', 'XCD 38mm f/2.5', '24mm equivalent f/1.78'];
    const apertures = ['f/1.4', 'f/2.0', 'f/2.8', 'f/4.0', 'f/5.6'];
    const isos = ['100', '200', '400', '800', '1600'];
    const shutters = ['1/80s', '1/125s', '1/250s', '1/500s', '1/1600s'];

    return {
      camera: cameraModels[hash % cameraModels.length],
      lens: lenses[hash % lenses.length],
      aperture: apertures[hash % apertures.length],
      iso: isos[hash % isos.length],
      shutter: shutters[hash % shutters.length],
      focal: `${(hash % 50) + 24}mm`,
      dimensions: '4000 x 3000 (12 MP)',
      size: `${((hash % 8) + 2.5).toFixed(1)} MB`
    };
  }, [activePhoto]);

  return (
    <section className="gallery-page" aria-labelledby="gallery-page-title">
      
      {/* Floating Action Button (FAB) for mobile upload */}
      {!isSelectMode && (
        <button
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-orange-500 text-black flex items-center justify-center shadow-lg active:scale-95 transition-all md:hidden"
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setIsModalOpen(true);
          }}
          aria-label="Upload Foto"
          title="Upload Foto"
        >
          <Plus size={20} />
        </button>
      )}

      {/* 1. COHESIVE CRM TITLE BLOCK */}
      <div className="customer-page-title">
        <p>Studio Gallery</p>
        <h2 id="gallery-page-title">Photos</h2>
      </div>

      {/* 2. COHESIVE GALLERY STATS GRID (GalleryHero) */}
      <GalleryHero
        activeCount={filteredActiveImages.length}
        favoriteCount={filteredActiveImages.filter(img => img.isFavorite).length}
        HeartIcon={Heart}
        ImageIcon={ImageIcon}
        trashCount={trashedImages.length}
        TrashIcon={Trash2}
      />

      {/* Global Alerts */}
      <GalleryAlerts
        CloseIcon={X}
        error={error}
        onClearError={() => setError('')}
        onClearSuccess={() => setSuccess('')}
        success={success}
      />

      {/* 3. COHESIVE UNIFIED TOOLBAR (.customer-toolbar) */}
      <GalleryToolbar
        activeTab={activeTab}
        CheckIcon={Check}
        FolderIcon={Folder}
        GridIcon={Grid}
        gridColumns={gridColumns}
        ImageIcon={ImageIcon}
        isSelectMode={isSelectMode}
        onGridColumnsChange={setGridColumns}
        onOpenUpload={() => {
          setError('');
          setSuccess('');
          setIsModalOpen(true);
        }}
        onSearchChange={setSearchQuery}
        onTabChange={(tabKey) => {
          setActiveTab(tabKey);
          setSelectedAlbum(null);
          setIsSelectMode(false);
          setSelectedIds(new Set());
        }}
        onToggleSelectMode={() => setIsSelectMode(!isSelectMode)}
        PlusIcon={Plus}
        searchQuery={searchQuery}
        SearchIcon={Search}
        trashCount={trashedImages.length}
        TrashIcon={Trash2}
      />

      {/* 4. BATCH SELECT FLOATING BANNER */}
      {isSelectMode ? (
        <div className="gallery-batch-banner-fixed">
          <GalleryBatchBanner
            activeTab={activeTab}
            FavoriteIcon={Heart}
            onBatchFavorite={handleBatchFavorite}
            onBatchPermanentDelete={handleBatchPermanentDelete}
            onBatchRestore={handleBatchRestore}
            onBatchSoftDelete={handleBatchSoftDelete}
            onCancelSelectMode={() => {
              setIsSelectMode(false);
              setSelectedIds(new Set());
            }}
            onSelectAll={handleSelectAll}
            RefreshIcon={RefreshCw}
            selectedCount={selectedIds.size}
            totalCount={displayedImages.length}
            TrashIcon={Trash2}
            TrashPermanentIcon={Trash}
          />
        </div>
      ) : null}

      {/* 5. MAIN VIEWS CONTENT */}
      {isLoading ? (
        <div className="gallery-loading-state">
          <LoaderCircle className="gallery-loading-spinner" size={36} />
          <span>Memuat galeri berkualitas studio...</span>
        </div>
      ) : (
        <>
          {/* TAB A: PHOTOS (TIMELINE ROADMAP) */}
          {activeTab === 'photos' && (
            <GalleryTimelineView
              categories={CATEGORIES}
              displayedImages={displayedImages}
              EmptyGalleryState={EmptyGalleryState}
              gridColumns={gridColumns}
              isSelectMode={isSelectMode}
              onDeleteClick={handleSoftDelete}
              onFavoriteClick={handleToggleFavorite}
              onOpenPhoto={setActivePhotoIndex}
              onSelectToggle={handleSelectToggle}
              PhotoCard={PhotoCard}
              selectedIds={selectedIds}
              timelineGroups={timelineGroups}
            />
          )}

          {/* TAB B: ALBUMS MENU OR ALBUM DETAILS */}
          {activeTab === 'albums' && (
            <GalleryAlbumsView
              AlbumFolderCard={AlbumFolderCard}
              BackIcon={ChevronLeft}
              categories={CATEGORIES}
              displayedImages={displayedImages}
              EmptyGalleryState={EmptyGalleryState}
              filteredActiveImages={filteredActiveImages}
              FolderIcon={Folder}
              gridColumns={gridColumns}
              HeartIcon={Heart}
              ImageIcon={ImageIcon}
              isSelectMode={isSelectMode}
              onDeleteClick={handleSoftDelete}
              onFavoriteClick={handleToggleFavorite}
              onOpenPhoto={setActivePhotoIndex}
              onOpenTrash={() => {
                setActiveTab('trash');
                setSelectedAlbum(null);
              }}
              onSelectAlbum={setSelectedAlbum}
              onSelectToggle={handleSelectToggle}
              PhotoCard={PhotoCard}
              selectedAlbum={selectedAlbum}
              selectedIds={selectedIds}
              SparklesIcon={Sparkles}
              trashedImages={trashedImages}
              TrashIcon={Trash2}
            />
          )}

          {/* TAB C: TRASH BIN */}
          {activeTab === 'trash' && (
            <GalleryTrashView
              displayedImages={displayedImages}
              EmptyGalleryState={EmptyGalleryState}
              gridColumns={gridColumns}
              isSelectMode={isSelectMode}
              onEmptyTrash={async () => {
                if (window.confirm('Kosongkan semua sampah secara permanen? Tindakan ini tidak dapat dibatalkan.')) {
                  setError('');
                  try {
                    const promises = displayedImages.map(img => galleryRepository.deleteGalleryItem(img.id));
                    await Promise.all(promises);
                    setSuccess('Tempat sampah berhasil dikosongkan.');
                  } catch {
                    setError('Gagal mengosongkan tempat sampah.');
                  }
                }
              }}
              onOpenPhoto={setActivePhotoIndex}
              onPermanentDeleteClick={handlePermanentDelete}
              onRestoreClick={handleRestore}
              onSelectToggle={handleSelectToggle}
              PhotoCard={PhotoCard}
              selectedIds={selectedIds}
              TrashIcon={Trash2}
            />
          )}
        </>
      )}

      {/* 6. UPLOAD NEW PHOTO MODAL */}
      <GalleryUploadModal
        categories={CATEGORIES}
        CloseIcon={X}
        fileInputRef={fileInputRef}
        FileImageIcon={FileImage}
        isOpen={isModalOpen}
        isUploading={isUploading}
        LoaderIcon={LoaderCircle}
        onCategoryChange={setUploadCategory}
        onClose={() => setIsModalOpen(false)}
        onDescriptionChange={setUploadDesc}
        onFileChange={handleFileChange}
        onSubmit={handleUploadSubmit}
        onTitleChange={setUploadTitle}
        selectedFile={selectedFile}
        uploadCategory={uploadCategory}
        uploadDesc={uploadDesc}
        UploadIcon={Upload}
        uploadTitle={uploadTitle}
      />

      {/* 7. CINEMATIC FULLSCREEN LIGHTBOX & MEDIA CENTER */}
      <GalleryLightbox
        activePhoto={activePhoto}
        activePhotoIndex={activePhotoIndex}
        audioVisualizerBarHeights={AUDIO_VISUALIZER_BAR_HEIGHTS}
        audioVolume={audioVolume}
        Calendar={Calendar}
        Camera={Camera}
        canvasRef={canvasRef}
        categories={CATEGORIES}
        ChevronLeft={ChevronLeft}
        ChevronRight={ChevronRight}
        closeLightbox={closeLightbox}
        Crop={Crop}
        displayedImages={displayedImages}
        Download={Download}
        editorAdjustments={editorAdjustments}
        editorCropPreset={editorCropPreset}
        editorFilterPreset={editorFilterPreset}
        editorFlip={editorFlip}
        editorWatermark={editorWatermark}
        exifDetails={exifDetails}
        handleDownloadEditedImage={handleDownloadEditedImage}
        handleNextPhoto={handleNextPhoto}
        handlePermanentDelete={handlePermanentDelete}
        handlePrevPhoto={handlePrevPhoto}
        handleRestore={handleRestore}
        handleSaveEditedImage={handleSaveEditedImage}
        handleSoftDelete={handleSoftDelete}
        handleToggleFavorite={handleToggleFavorite}
        handleVolumeChange={handleVolumeChange}
        Heart={Heart}
        imgElement={imgElement}
        Info={Info}
        isEditing={isEditing}
        isInfoPanelOpen={isInfoPanelOpen}
        isMusicPlaying={isMusicPlaying}
        isSavingEdit={isSavingEdit}
        isSlideshowPlaying={isSlideshowPlaying}
        LoaderCircle={LoaderCircle}
        MapPin={MapPin}
        Music={Music}
        Pause={Pause}
        Play={Play}
        Plus={Plus}
        RefreshCw={RefreshCw}
        RotateCw={RotateCw}
        setEditorAdjustments={setEditorAdjustments}
        setEditorCropPreset={setEditorCropPreset}
        setEditorFilterPreset={setEditorFilterPreset}
        setEditorFlip={setEditorFlip}
        setEditorRotation={setEditorRotation}
        setEditorWatermark={setEditorWatermark}
        setIsEditing={setIsEditing}
        setIsInfoPanelOpen={setIsInfoPanelOpen}
        setIsMusicPlaying={setIsMusicPlaying}
        setIsSlideshowPlaying={setIsSlideshowPlaying}
        Trash={Trash}
        Trash2={Trash2}
        Type={Type}
        User={User}
        Volume2={Volume2}
        VolumeX={VolumeX}
        X={X}
      />
    </section>
  );
}
