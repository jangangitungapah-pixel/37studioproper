import { useEffect, useState, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  X, 
  Upload, 
  LoaderCircle,
  FileImage,
  Calendar,
  User
} from 'lucide-react';
import { firestoreDb, firebaseAuth } from '../../lib/firebase.js';

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Load gallery images from Firestore
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(firestoreDb, 'gallery'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setImages(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching gallery items:', err);
        setError('Gagal memuat daftar foto galeri.');
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Handle File Input Change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { // limit 10MB
        setError('Ukuran file maksimal 10MB.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  // Upload to Cloudinary & Catalog in Firestore
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedFile) {
      setError('Harap pilih file foto terlebih dahulu.');
      return;
    }
    if (!title.trim()) {
      setError('Judul foto wajib diisi.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Prepare FormData for Cloudinary Upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('upload_preset', 'studio37_gallery_unsigned');

      // 2. Upload to Cloudinary
      const cloudName = 'dbvlmxvyd';
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      
      const response = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Gagal mengirim file ke Cloudinary.');
      }

      const data = await response.json();
      const secureUrl = data.secure_url;
      const publicId = data.public_id;

      // 3. Save Image Metadata in Firestore
      const currentUser = firebaseAuth?.currentUser;
      const docData = {
        title: title.trim(),
        description: description.trim(),
        url: secureUrl,
        publicId: publicId,
        uploadedBy: currentUser?.displayName || currentUser?.email || 'Admin',
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(firestoreDb, 'gallery'), docData);
      
      setSuccess('Foto berhasil diupload dan ditambahkan ke galeri!');
      
      // Reset Form State
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsModalOpen(false);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Gagal mengupload foto. Periksa koneksi atau file Anda.');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Image from Gallery Catalog
  const handleDeleteImage = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus foto ini dari galeri?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await deleteDoc(doc(firestoreDb, 'gallery', id));
      setSuccess('Foto berhasil dihapus dari galeri.');
    } catch (err) {
      console.error('Delete error:', err);
      setError('Gagal menghapus foto dari basis data.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ImageIcon className="text-[var(--ui-accent)] w-5 h-5" />
            <span>Katalog Galeri Foto Studio</span>
          </h2>
          <p className="text-xs text-[var(--ui-text-muted)] mt-1">
            Total {images.length} foto terdaftar di portal publik studio.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-strong)] text-black font-bold text-xs tracking-wider transition-colors shadow-lg shadow-orange-500/10"
        >
          <Plus size={16} />
          <span>TAMBAH FOTO BARU</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 text-green-400 text-xs flex items-center gap-2">
          <span>✅ {success}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <LoaderCircle className="animate-spin text-[var(--ui-accent)]" size={32} />
          <span className="text-xs text-[var(--ui-text-muted)]">Memuat galeri...</span>
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border-2 border-dashed border-[var(--ui-border)] space-y-4">
          <ImageIcon className="mx-auto text-[var(--ui-text-muted)] w-12 h-12 opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Galeri Foto Kosong</p>
            <p className="text-xs text-[var(--ui-text-muted)]">Belum ada foto yang diupload. Unggah foto pertamamu.</p>
          </div>
        </div>
      ) : (
        /* Gallery Image Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div 
              key={img.id}
              className="group rounded-2xl bg-[var(--ui-surface-card)] border border-[var(--ui-border)] overflow-hidden shadow-lg hover:border-[var(--ui-border-strong)] transition-all flex flex-col justify-between"
            >
              {/* Image Preview Container */}
              <div className="relative aspect-[4/3] bg-black overflow-hidden border-b border-[var(--ui-border)]">
                <img 
                  src={img.url} 
                  alt={img.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                {/* Delete button overlay */}
                <button
                  type="button"
                  title="Hapus foto"
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-[#ff6b6b]/10 hover:bg-[#ff6b6b]/30 text-[#ff6b6b] border border-[#ff6b6b]/20 hover:border-transparent transition-colors opacity-90 sm:opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Meta information */}
              <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white line-clamp-1">{img.title}</h3>
                  {img.description ? (
                    <p className="text-xs text-[var(--ui-text-muted)] line-clamp-2 leading-relaxed">
                      {img.description}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--ui-text-muted)] italic">Tidak ada deskripsi.</p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-[var(--ui-border)] flex items-center justify-between text-[10px] text-[var(--ui-text-muted)]">
                  <span className="flex items-center gap-1">
                    <User size={12} className="shrink-0" />
                    <span className="max-w-[70px] truncate">{img.uploadedBy.split('@')[0]}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="shrink-0" />
                    <span>{new Date(img.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Image Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Modal Backdrop with Blur */}
          <div 
            onClick={() => !isUploading && setIsModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md" 
          />

          {/* Modal Content Panel */}
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] shadow-2xl space-y-6 animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="text-[var(--ui-accent)] w-5 h-5" />
                <span>Upload Foto Galeri</span>
              </h3>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--ui-surface-soft)] text-[var(--ui-text-muted)] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              {/* File Input */}
              <div className="space-y-1.5">
                <span className="text-xs text-[var(--ui-text-muted)] font-medium">Pilih File Foto</span>
                <div 
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center space-y-2 ${
                    selectedFile 
                      ? 'border-[var(--ui-accent-strong)]/40 bg-[var(--ui-accent-soft)]/5' 
                      : 'border-[var(--ui-border)] hover:border-[var(--ui-border-strong)] bg-[var(--ui-surface-soft)]/5'
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
                      <FileImage className="text-[var(--ui-accent)] w-8 h-8" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white max-w-[240px] truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-[var(--ui-text-muted)]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="text-[var(--ui-text-muted)] w-8 h-8 opacity-60" />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-white">Klik untuk memilih file</p>
                        <p className="text-[10px] text-[var(--ui-text-muted)]">Format JPG, PNG, atau WEBP (Maks 10MB)</p>
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
                  placeholder="Contoh: Ruang Latihan Utama"
                  required
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              {/* Description Input */}
              <label className="space-y-1.5 block">
                <span className="text-xs text-[var(--ui-text-muted)] font-medium">Deskripsi (Opsional)</span>
                <textarea 
                  placeholder="Keterangan singkat mengenai foto..."
                  rows={3}
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--ui-surface-soft)] border border-[var(--ui-border)] focus:border-[var(--ui-accent)] outline-none text-white transition-colors resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              {/* Form Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--ui-surface-soft)] hover:bg-[var(--ui-control)] text-white text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-[var(--ui-accent)] hover:bg-[var(--ui-accent-strong)] text-black font-bold text-xs tracking-wider transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <LoaderCircle className="animate-spin" size={14} />
                      <span>Uploading...</span>
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
    </div>
  );
}
