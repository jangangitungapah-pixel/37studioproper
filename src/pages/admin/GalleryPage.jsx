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

// Procedural Lo-fi Ambient Sound Generator using Web Audio API
class LofiAmbientSynth {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.nodes = [];
    this.chordTimer = null;
    this.droneOsc = null;
    this.noise = null;
    this.mainGain = null;
    this.filter = null;
  }

  start(volume = 0.5) {
    if (this.isPlaying) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Main output gain (lowered to be ambient and gentle)
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(volume * 0.12, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);
      
      // Lowpass filter for cozy muffled lofi sound
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.filter.connect(this.mainGain);
      
      // 1. Vinyl Crackle/Rain Noise Generator
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.noise = this.ctx.createBufferSource();
      this.noise.buffer = noiseBuffer;
      this.noise.loop = true;
      
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      
      this.noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.mainGain);
      this.noise.start();

      // 2. Mellow Bass Drone
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.setValueAtTime(73.42, this.ctx.currentTime); // D2 key
      
      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      
      this.droneOsc.connect(this.filter);
      this.droneOsc.connect(droneGain);
      droneGain.connect(this.mainGain);
      this.droneOsc.start();

      // 3. Relaxing Pentatonic Chord Arpeggiator (D Major Pentatonic)
      const scale = [146.83, 164.81, 220.00, 293.66, 329.63, 440.00, 587.33, 659.25];
      this.chordTimer = setInterval(() => {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const now = this.ctx.currentTime;
        
        // Randomly play 1 or 2 soft notes
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const freq = scale[Math.floor(Math.random() * scale.length)];
          const osc = this.ctx.createOscillator();
          const oscGain = this.ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          
          // Gentle lo-fi pluck envelope (fast attack, long release)
          oscGain.gain.setValueAtTime(0, now);
          oscGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
          oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
          
          osc.connect(this.filter);
          osc.connect(oscGain);
          oscGain.connect(this.mainGain);
          
          osc.start(now);
          osc.stop(now + 3.6);
        }
      }, 3500);

      this.isPlaying = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  setVolume(vol) {
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(vol * 0.12, this.ctx.currentTime);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    clearInterval(this.chordTimer);
    if (this.noise) {
      try { this.noise.stop(); } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }
    if (this.droneOsc) {
      try { this.droneOsc.stop(); } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }
    if (this.ctx) {
      this.ctx.close();
    }
    this.isPlaying = false;
  }
}

const CATEGORIES = [
  { value: 'Control Room', label: 'Ruang Kontrol', color: 'from-orange-500/20 to-amber-600/20' },
  { value: 'Recording Room', label: 'Ruang Rekaman', color: 'from-blue-500/20 to-indigo-600/20' },
  { value: 'Instruments', label: 'Instrumen / Alat', color: 'from-emerald-500/20 to-teal-600/20' },
  { value: 'Events', label: 'Kegiatan / Sesi', color: 'from-purple-500/20 to-pink-600/20' },
  { value: 'Others', label: 'Lain-lain', color: 'from-gray-500/20 to-slate-600/20' }
];

const AUDIO_VISUALIZER_BAR_HEIGHTS = [7, 11, 5, 12, 8, 10];

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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

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
  const filteredActiveImages = useMemo(() => {
    return rawImages.filter(img => !img.isDeleted);
  }, [rawImages]);

  const trashedImages = useMemo(() => {
    return rawImages.filter(img => img.isDeleted);
  }, [rawImages]);

  // Derived filtered active photos (Search, Album selection, Category Filter)
  const displayedImages = useMemo(() => {
    let list = [...filteredActiveImages];

    // Filter by Album menu selection
    if (activeTab === 'albums' && selectedAlbum) {
      if (selectedAlbum === 'favorites') {
        list = list.filter(img => img.isFavorite);
      } else if (selectedAlbum === 'recents') {
        // limit to 8 most recent
        list = list.slice(0, 8);
      } else {
        // category folder
        list = list.filter(img => img.category === selectedAlbum);
      }
    } else if (activeTab === 'trash') {
      list = [...trashedImages];
    } else {
      // main "Photos" tab: Category Filter pills
      if (selectedCategoryFilter !== 'All') {
        list = list.filter(img => img.category === selectedCategoryFilter);
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(img => 
        (img.title && img.title.toLowerCase().includes(q)) ||
        (img.description && img.description.toLowerCase().includes(q)) ||
        (img.category && img.category.toLowerCase().includes(q)) ||
        (img.uploadedBy && img.uploadedBy.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filteredActiveImages, trashedImages, activeTab, selectedAlbum, selectedCategoryFilter, searchQuery]);

  // Group photos by Month-Year for the Photo timeline stream
  const timelineGroups = useMemo(() => {
    if (activeTab !== 'photos') return [];
    
    const groups = {};
    displayedImages.forEach(img => {
      const date = new Date(img.createdAt);
      const monthYear = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(img);
    });

    return Object.keys(groups).map(monthYear => ({
      title: monthYear,
      items: groups[monthYear]
    }));
  }, [displayedImages, activeTab]);

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
        uploadedBy: currentUser?.displayName || currentUser?.email || 'Admin',
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
        uploadedBy: currentUser?.displayName || currentUser?.email || 'Admin',
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
    <section className="customer-page gallery-page pb-28 md:pb-8" aria-labelledby="gallery-page-title">
      
      {/* 1. COHESIVE CRM TITLE BLOCK */}
      <div className="customer-page-title">
        <p>Studio Portfolio</p>
        <h2 id="gallery-page-title">Studio Gallery</h2>
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
        trashCount={trashedImages.length}
        TrashIcon={Trash2}
      />

      {/* 4. BATCH SELECT FLOATING BANNER */}
      {isSelectMode ? (
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
      ) : null}

      {/* 5. MAIN VIEWS CONTENT */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <LoaderCircle className="animate-spin text-[var(--ui-accent)]" size={36} />
          <span className="text-xs text-[var(--ui-text-muted)] tracking-wider">Memuat galeri berkualitas studio...</span>
        </div>
      ) : (
        <>
          {/* TAB A: PHOTOS (TIMELINE ROADMAP) */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              
              {/* Category pills using system .gallery-filter-row & .gallery-filter-pill */}
              <div className="gallery-category-row gallery-filter-row">
                <button
                  onClick={() => setSelectedCategoryFilter('All')}
                  className={`gallery-filter-pill ${selectedCategoryFilter === 'All' ? 'is-active' : ''}`}
                >
                  Semua Kategori
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategoryFilter(cat.value)}
                    className={`gallery-filter-pill ${selectedCategoryFilter === cat.value ? 'is-active' : ''}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {timelineGroups.length === 0 ? (
                <EmptyGalleryState activeTab={activeTab} />
              ) : (
                timelineGroups.map(group => (
                  <div key={group.title} className="space-y-4">
                    
                    {/* Sticky Floating timeline date header */}
                    <div className="sticky top-0 z-20 py-2.5 bg-gradient-to-b from-[var(--ui-bg-page)] via-[var(--ui-bg-page)]/90 to-transparent">
                      <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2.5">
                        <span className="w-1.5 h-4 bg-orange-500 rounded-full" />
                        <span>{group.title}</span>
                        <span className="text-[10px] text-zinc-500 font-medium">({group.items.length} Foto)</span>
                      </h3>
                    </div>

                    {/* Responsive Grid layout */}
                    <div 
                      className="gallery-photo-grid grid gap-4 sm:gap-5"
                      style={{
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                      }}
                    >
                      {group.items.map(img => {
                        const originalIndex = displayedImages.findIndex(i => i.id === img.id);
                        return (
                          <PhotoCard
                            key={img.id}
                            img={img}
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.has(img.id)}
                            onSelectToggle={handleSelectToggle}
                            onCardClick={() => {
                              if (isSelectMode) {
                                handleSelectToggle(img.id);
                              } else {
                                setActivePhotoIndex(originalIndex);
                              }
                            }}
                            onFavoriteClick={() => handleToggleFavorite(img)}
                            onDeleteClick={() => handleSoftDelete(img.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB B: ALBUMS MENU OR ALBUM DETAILS */}
          {activeTab === 'albums' && (
            <div>
              {selectedAlbum === null ? (
                // Albums Menu
                <div className="gallery-album-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {/* Virtual Album: All Photos */}
                  <AlbumFolderCard
                    title="Semua Foto"
                    count={filteredActiveImages.length}
                    coverUrl={filteredActiveImages[0]?.url}
                    onClick={() => setSelectedAlbum('all')}
                    icon={ImageIcon}
                  />

                  {/* Virtual Album: Favorites */}
                  <AlbumFolderCard
                    title="Favorit Saya"
                    count={filteredActiveImages.filter(img => img.isFavorite).length}
                    coverUrl={filteredActiveImages.find(img => img.isFavorite)?.url}
                    onClick={() => setSelectedAlbum('favorites')}
                    icon={Heart}
                    iconColor="text-red-400"
                  />

                  {/* Predefined Categories */}
                  {CATEGORIES.map(cat => {
                    const catImages = filteredActiveImages.filter(img => img.category === cat.value);
                    return (
                      <AlbumFolderCard
                        key={cat.value}
                        title={cat.label}
                        count={catImages.length}
                        coverUrl={catImages[0]?.url}
                        onClick={() => setSelectedAlbum(cat.value)}
                        icon={Folder}
                      />
                    );
                  })}

                  {/* Virtual Album: Recently Added */}
                  <AlbumFolderCard
                    title="Terbaru"
                    count={Math.min(filteredActiveImages.length, 8)}
                    coverUrl={filteredActiveImages[0]?.url}
                    onClick={() => setSelectedAlbum('recents')}
                    icon={Sparkles}
                    iconColor="text-orange-400"
                  />

                  {/* Virtual Album: Recycle Bin / Sampah */}
                  <AlbumFolderCard
                    title="Baru Dihapus"
                    count={trashedImages.length}
                    coverUrl={trashedImages[0]?.url}
                    onClick={() => {
                      setActiveTab('trash');
                      setSelectedAlbum(null);
                    }}
                    icon={Trash2}
                    iconColor="text-red-400"
                  />
                </div>
              ) : (
                // Album details view
                <div className="space-y-6">
                  {/* Back banner */}
                  <div className="flex items-center justify-between border-b border-[var(--auth-border)] pb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedAlbum(null)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Album</span>
                        <h3 className="text-base font-bold text-white">
                          {selectedAlbum === 'all' && 'Semua Foto'}
                          {selectedAlbum === 'favorites' && 'Favorit Saya'}
                          {selectedAlbum === 'recents' && '8 Foto Terbaru'}
                          {CATEGORIES.find(c => c.value === selectedAlbum)?.label}
                        </h3>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500 font-bold">{displayedImages.length} Foto</span>
                  </div>

                  {displayedImages.length === 0 ? (
                    <EmptyGalleryState activeTab="albums_detail" />
                  ) : (
                    <div 
                      className="gallery-photo-grid grid gap-4 sm:gap-5"
                      style={{
                        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                      }}
                    >
                      {displayedImages.map((img, idx) => (
                        <PhotoCard
                          key={img.id}
                          img={img}
                          isSelectMode={isSelectMode}
                          isSelected={selectedIds.has(img.id)}
                          onSelectToggle={handleSelectToggle}
                          onCardClick={() => {
                            if (isSelectMode) {
                              handleSelectToggle(img.id);
                            } else {
                              setActivePhotoIndex(idx);
                            }
                          }}
                          onFavoriteClick={() => handleToggleFavorite(img)}
                          onDeleteClick={() => handleSoftDelete(img.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB C: TRASH BIN */}
          {activeTab === 'trash' && (
            <div className="space-y-6">
              {/* Trash info banner */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-[var(--auth-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trash2 size={16} className="text-red-400" />
                    <span>Baru Dihapus (Recycle Bin)</span>
                  </h4>
                  <p className="text-xs text-[var(--ui-text-muted)]">
                    Foto di bawah telah dihapus dari galeri publik. Anda dapat memulihkannya atau menghapusnya secara permanen.
                  </p>
                </div>
                {displayedImages.length > 0 && (
                  <button
                    onClick={async () => {
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
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-xs font-bold transition-all"
                  >
                    <Trash2 size={13} />
                    <span>KOSONGKAN SAMPAH</span>
                  </button>
                )}
              </div>

              {displayedImages.length === 0 ? (
                <EmptyGalleryState activeTab="trash" />
              ) : (
                <div 
                  className="gallery-photo-grid grid gap-4 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                  }}
                >
                  {displayedImages.map((img, idx) => (
                    <PhotoCard
                      key={img.id}
                      img={img}
                      isDeletedTab={true}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(img.id)}
                      onSelectToggle={handleSelectToggle}
                      onCardClick={() => {
                        if (isSelectMode) {
                          handleSelectToggle(img.id);
                        } else {
                          setActivePhotoIndex(idx);
                        }
                      }}
                      onRestoreClick={() => handleRestore(img.id)}
                      onDeleteClick={() => handlePermanentDelete(img.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 6. UPLOAD NEW PHOTO MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            onClick={() => !isUploading && setIsModalOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-md" 
          />

          <div className="relative w-full max-w-lg p-6 rounded-3xl bg-zinc-950 border border-[var(--auth-border)] shadow-2xl space-y-6 animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="text-[var(--ui-accent)] w-5 h-5" />
                <span>Upload Foto Portofolio</span>
              </h3>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-[var(--ui-text-muted)] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              {/* File Drop/Input Area */}
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
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <FileImage className="text-[var(--ui-accent)] w-9 h-9" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white max-w-[280px] truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="text-zinc-500 w-8 h-8 opacity-60" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-white">Klik untuk memilih gambar</p>
                        <p className="text-[10px] text-[var(--ui-text-muted)]">Format JPG, PNG, WEBP (Maks 12MB)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Title input */}
              <label className="space-y-1.5 block">
                <span className="text-xs text-[var(--ui-text-muted)] font-medium">Judul Foto *</span>
                <input 
                  type="text" 
                  placeholder="Contoh: Console Mixing A"
                  required
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500 outline-none text-white transition-all text-xs"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </label>

              {/* Category Select Radio Grid */}
              <div className="space-y-1.5 block">
                <span className="text-xs text-[var(--ui-text-muted)] font-medium">Pilih Kategori / Album</span>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setUploadCategory(cat.value)}
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

              {/* Description Input */}
              <label className="space-y-1.5 block">
                <span className="text-xs text-[var(--ui-text-muted)] font-medium">Deskripsi Singkat (Opsional)</span>
                <textarea 
                  placeholder="Keterangan singkat mengenai foto..."
                  rows={2}
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500 outline-none text-white transition-all text-xs resize-none"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                />
              </label>

              {/* Form Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsModalOpen(false)}
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
                      <LoaderCircle className="animate-spin" size={14} />
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload & Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </section>
  );
}

// Subcomponent: Card represent an image
function PhotoCard({ 
  img, 
  isDeletedTab = false, 
  isSelectMode = false, 
  isSelected = false, 
  onSelectToggle, 
  onCardClick, 
  onFavoriteClick, 
  onRestoreClick,
  onDeleteClick 
}) {
  return (
    <div 
      onClick={onCardClick}
      className={`group rounded-[22px] bg-[var(--auth-bg-soft)] border overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative ${
        isSelected 
          ? 'border-orange-500 ring-2 ring-orange-500/20' 
          : 'border-[var(--auth-border)] hover:border-[var(--auth-border-strong)]'
      }`}
    >
      {/* Selection checkbox overlay */}
      {isSelectMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle(img.id);
          }}
          className="absolute top-3.5 left-3.5 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all shadow-md"
          style={{
            backgroundColor: isSelected ? 'var(--ui-accent)' : 'rgba(0, 0, 0, 0.6)',
            borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
            color: isSelected ? '#000000' : '#ffffff'
          }}
        >
          <Check size={11} className="stroke-[3px]" />
        </button>
      )}

      {/* Image Preview Container */}
      <div className="relative aspect-[4/3] bg-zinc-950 overflow-hidden border-b border-[var(--auth-border)]">
        <img 
          src={img.url} 
          alt={img.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />

        {/* Favorite marker badge */}
        {!isDeletedTab && img.isFavorite && (
          <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-red-500 backdrop-blur-md border border-[var(--auth-border)]">
            <Heart size={12} className="fill-current" />
          </div>
        )}

        {/* Categories tag overlay */}
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/5 text-[9px] text-zinc-300 font-bold uppercase tracking-wide">
          {CATEGORIES.find(c => c.value === img.category)?.label || 'Lain-lain'}
        </div>
      </div>

      {/* Meta information */}
      <div className="p-4 space-y-2.5 flex-grow flex flex-col justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[var(--ui-accent)] transition-colors">{img.title}</h4>
          {img.description ? (
            <p className="text-[10px] text-[var(--ui-text-muted)] line-clamp-2 leading-relaxed">
              {img.description}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-600 italic">Tidak ada deskripsi.</p>
          )}
        </div>

        {/* Card bottom footer */}
        <div className="pt-2 border-t border-[var(--auth-border)] flex items-center justify-between text-[9px] text-[var(--auth-text-muted)]">
          <span className="flex items-center gap-1 font-medium">
            <User size={10} className="text-orange-500" />
            <span className="max-w-[70px] truncate">{img.uploadedBy?.split('@')[0]}</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Calendar size={10} className="text-orange-500" />
            <span>{new Date(img.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
          </span>
        </div>
      </div>

      {/* Action buttons overlay */}
      {!isSelectMode && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
          {!isDeletedTab ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavoriteClick();
                }}
                className={`p-1.5 rounded-lg border backdrop-blur-md transition-all ${
                  img.isFavorite
                    ? 'bg-red-500 text-white border-transparent'
                    : 'bg-black/60 text-zinc-300 hover:text-white border-white/10'
                }`}
                title="Favorit"
              >
                <Heart size={12} className={img.isFavorite ? 'fill-current' : ''} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick();
                }}
                className="p-1.5 rounded-lg bg-red-500/25 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-black hover:border-transparent transition-all backdrop-blur-md"
                title="Pindahkan ke Tempat Sampah"
              >
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestoreClick();
                }}
                className="p-1.5 rounded-lg bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black hover:border-transparent transition-all backdrop-blur-md"
                title="Pulihkan"
              >
                <RefreshCw size={12} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick();
                }}
                className="p-1.5 rounded-lg bg-red-500/25 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-transparent transition-all backdrop-blur-md"
                title="Hapus Permanen"
              >
                <Trash size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Subcomponent: Folder-like icon represent Album
function AlbumFolderCard({ title, count, coverUrl, onClick, icon: FolderIcon = Folder, iconColor = "text-orange-500" }) {
  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer space-y-3"
    >
      <div className="aspect-[4/3] rounded-[22px] bg-[var(--auth-bg-soft)] border border-[var(--auth-border)] p-2 relative overflow-hidden group-hover:border-[var(--auth-border-strong)] group-hover:-translate-y-1 transition-all duration-300 flex flex-col justify-end shadow-md">
        
        {coverUrl ? (
          <div className="absolute inset-0 z-0">
            <img 
              src={coverUrl} 
              alt={title} 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 blur-[1px] group-hover:blur-0"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-zinc-950/40 flex items-center justify-center">
            <FolderIcon className={`w-12 h-12 ${iconColor} opacity-20`} />
          </div>
        )}

        <div className="absolute top-3.5 right-3.5 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/5 text-[9px] font-bold text-zinc-300">
          {count} Item
        </div>

        <div className="relative z-10 p-2.5 rounded-2xl bg-black/60 backdrop-blur-md w-fit border border-white/5 mb-1 text-white group-hover:text-[var(--ui-accent)] transition-colors">
          <FolderIcon size={16} className={iconColor} />
        </div>
      </div>

      <div className="px-1 text-left">
        <h4 className="text-xs font-bold text-white group-hover:text-[var(--ui-accent)] transition-colors line-clamp-1">{title}</h4>
        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{count} Foto</p>
      </div>
    </div>
  );
}

// Subcomponent: Empty status placeholder
function EmptyGalleryState({ activeTab }) {
  return (
    <div className="gallery-empty-state text-center py-24 rounded-[22px] border border-dashed border-[var(--auth-border)] bg-[var(--auth-bg-soft)]/50 p-6 space-y-4 max-w-lg mx-auto">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
        <ImageIcon className="text-zinc-600 w-8 h-8 opacity-65" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white">
          {activeTab === 'trash' && 'Tempat Sampah Kosong'}
          {activeTab === 'albums_detail' && 'Album Ini Kosong'}
          {activeTab === 'photos' && 'Katalog Galeri Foto Kosong'}
          {activeTab === 'albums' && 'Belum Ada Album'}
        </h4>
        <p className="text-xs text-[var(--ui-text-muted)] max-w-sm mx-auto leading-relaxed">
          {activeTab === 'trash' && 'Tidak ada item baru-baru ini yang dibuang ke sampah.'}
          {activeTab === 'albums_detail' && 'Belum ada foto yang masuk ke kategori/album ini.'}
          {activeTab === 'photos' && 'Silakan unggah foto portofolio pertama Anda dengan mengeklik tombol "Unggah Foto" di kanan atas.'}
        </p>
      </div>
    </div>
  );
}
